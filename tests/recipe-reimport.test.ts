import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp, createError, createRouter, toWebHandler } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { fileURLToPath } from 'node:url'
import { db } from '../server/db'
import { recipes } from '../server/db/schema'
import { getRecipe, saveRecipe } from '../server/utils/recipes'
import reimport from '../server/api/recipes/[id]/reimport.post'
import csrf from '../server/middleware/csrf'
import { safeFetch } from '../server/utils/ai/safe-fetch'
import { extractPageRecipe } from '../server/utils/ai/normalize'
import { cinnamonBunsPage } from './fixtures/cinnamon-buns-page'

vi.mock('../server/db', async () => {
  vi.stubEnv('DATABASE_URL', ':memory:')
  return vi.importActual('../server/db')
})
vi.mock('../server/utils/ai/safe-fetch', () => ({ safeFetch: vi.fn() }))
migrate(db, { migrationsFolder: fileURLToPath(new URL('../server/db/migrations', import.meta.url)) })
const handle = toWebHandler(createApp().use(csrf).use(createRouter().post('/api/recipes/:id/reimport', reimport)))
function request(id: string, body: unknown = {}, origin = 'http://localhost') {
  return handle(new Request(`http://localhost/api/recipes/${id}/reimport`, {
    method: 'POST', headers: { Host: 'localhost', Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }))
}
function sample(sourceUrl: string | null = 'https://recipes.example/buns') {
  return saveRecipe({ title: 'Truncated buns', description: '', sourceUrl, sourceType: 'video', recipeType: 'baking', cuisine: 'Scandinavian', difficulty: 'intermediate',
    isFavorite: true, rating: 4, heirloomNotes: 'Grandma’s notes', storageReheating: 'Freeze leftovers.',
    originalSaltType: 'table_salt', ingredients: [{ name: 'flour', amount: 1, unit: 'cup' }],
    steps: [{ stepNumber: 1, instruction: 'An incomplete method.' }], equipment: [{ name: 'Stand mixer' }]
  })
}
beforeEach(() => { db.delete(recipes).run(); vi.mocked(safeFetch).mockResolvedValue(cinnamonBunsPage) })
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals() })
afterAll(() => { db.$client.close(); vi.unstubAllEnvs() })

it('supplements metadata-only JSON-LD with all 12 sectioned steps and 21 ingredient lines', () => {
  const draft = extractPageRecipe(cinnamonBunsPage)!
  expect(draft).toMatchObject({ servings: 24, prepTimeMinutes: 20, cookTimeMinutes: 60, totalTimeMinutes: 180 })
  expect(draft.steps).toHaveLength(12)
  expect(draft.steps!.map(row => row.stepNumber)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1))
  expect(draft.steps!.map(row => row.instruction.split(':')[0])).toEqual([
    'Dough', 'Dough', 'Dough', 'Filling', ...Array(5).fill('Shaping'), ...Array(3).fill('Proof and Bake')
  ])
  expect(draft.steps![2]).toMatchObject({ durationMinutes: 53, timerRequired: true })
  expect(draft.steps![11]).toMatchObject({ durationMinutes: 25, timerRequired: true })
  expect(draft.steps![11]!.instruction).not.toMatch(/related recipe|Comments|baking sheet may/)
  expect(draft.ingredients).toHaveLength(21)
  expect(draft.ingredients![0]).toMatchObject({ name: 'whole milk', amount: 250, unit: 'g', gramsEquivalent: 250, notes: expect.stringContaining('For the dough') })
  expect(draft.ingredients![7]).toMatchObject({ name: 'unsalted butter', amount: 190, unit: 'g' })
  expect(draft.ingredients![10]).toMatchObject({ name: 'unsalted butter', amount: 200, unit: 'g', notes: expect.stringContaining('For the filling') })
  expect(draft.ingredients![20]).toMatchObject({ amount: 0, unit: 'as needed' })
})
it('rejects empty metadata as a complete extracted recipe', () => {
  expect(extractPageRecipe('<script type="application/ld+json">{"@type":"Recipe","name":"Buns"}</script>')).toBeNull()
})
it('refreshes the same recipe while retaining personal metadata and equipment absent from the source', async () => {
  const original = sample()
  const response = await request(original.id)
  expect(response.status).toBe(200)
  const { recipe } = await response.json()
  expect(recipe).toMatchObject({ id: original.id, createdAt: original.createdAt, isFavorite: true, rating: 4,
    heirloomNotes: 'Grandma’s notes', storageReheating: 'Freeze leftovers.', originalSaltType: 'table_salt', sourceType: 'url',
    recipeType: 'baking', cuisine: 'Scandinavian', difficulty: 'intermediate'
  })
  expect(recipe.steps).toHaveLength(12)
  expect(recipe.ingredients).toHaveLength(21)
  expect(recipe.equipment).toEqual(original.equipment)
  expect(db.select().from(recipes).all()).toHaveLength(1)
  expect(safeFetch).toHaveBeenCalledWith(original.sourceUrl, expect.any(AbortSignal))
})
it('supports an edited source URL and saves it for future refreshes', async () => {
  const original = sample()
  const response = await request(original.id, { url: 'https://recipes.example/canonical' })
  expect(response.status).toBe(200)
  expect(getRecipe(original.id).sourceUrl).toBe('https://recipes.example/canonical')
})
it('does not fetch for missing recipes, missing sources, or invalid input', async () => {
  expect((await request('missing')).status).toBe(404)
  const original = sample(null)
  expect((await request(original.id)).status).toBe(400)
  for (const body of [{ url: '' }, { url: 'file:///etc/passwd' }, { url: 2 }, { url: 'https://recipes.example', extra: true }]) {
    expect((await request(original.id, body)).status).toBe(400)
  }
  expect(safeFetch).not.toHaveBeenCalled()
  expect(getRecipe(original.id)).toEqual(original)
})
it('leaves the recipe intact on fetch failure or placeholder-only parsing', async () => {
  const original = sample()
  vi.mocked(safeFetch).mockRejectedValueOnce(createError({ statusCode: 422, statusMessage: 'Source unavailable' }))
  expect((await request(original.id)).status).toBe(422)
  expect(getRecipe(original.id)).toEqual(original)
  vi.mocked(safeFetch).mockResolvedValue('<main>No recipe here</main>')
  expect((await request(original.id)).status).toBe(422)
  expect(getRecipe(original.id)).toEqual(original)
  vi.mocked(safeFetch).mockResolvedValue('<main><h1>Buns</h1><h2>Ingredients</h2><p>200 g flour</p><p>50 g sugar</p></main>')
  expect((await request(original.id)).status).toBe(422)
  expect(getRecipe(original.id)).toEqual(original)
})
it('does not overwrite edits made while the source is being fetched', async () => {
  const original = sample()
  vi.mocked(safeFetch).mockImplementationOnce(async () => {
    saveRecipe({ title: 'New personal edit' }, original.id)
    return cinnamonBunsPage
  })
  expect((await request(original.id)).status).toBe(409)
  expect(getRecipe(original.id).title).toBe('New personal edit')
  expect(getRecipe(original.id).steps).toEqual(original.steps)
})
it('blocks cross-origin re-import before fetching or writing', async () => {
  const original = sample()
  expect((await request(original.id, {}, 'https://attacker.example')).status).toBe(403)
  expect(safeFetch).not.toHaveBeenCalled()
  expect(getRecipe(original.id)).toEqual(original)
})
