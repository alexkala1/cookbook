import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, createRouter, toWebHandler } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { fileURLToPath } from 'node:url'
import { db } from '../server/db'
import * as schema from '../server/db/schema'
import list from '../server/api/recipes/index.get'
import create from '../server/api/recipes/index.post'
import get from '../server/api/recipes/[id].get'
import update from '../server/api/recipes/[id].put'
import remove from '../server/api/recipes/[id].delete'
import getKitchen from '../server/api/settings/kitchen.get'
import putKitchen from '../server/api/settings/kitchen.put'
import csrf from '../server/middleware/csrf'
import { getRecipe, saveRecipe } from '../server/utils/recipes'

vi.mock('../server/db', async () => {
  // Exercise the production connection setup, including its custom SQL functions.
  vi.stubEnv('DATABASE_URL', ':memory:')
  return await vi.importActual('../server/db')
})

migrate(db, { migrationsFolder: fileURLToPath(new URL('../server/db/migrations', import.meta.url)) })
const app = createApp()
app.use(csrf)
const router = createRouter()
router.get('/api/recipes', list).post('/api/recipes', create)
router.get('/api/recipes/:id', get).put('/api/recipes/:id', update).delete('/api/recipes/:id', remove)
router.get('/api/settings/kitchen', getKitchen).put('/api/settings/kitchen', putKitchen)
app.use(router)
const handle = toWebHandler(app)
async function request(path: string, method = 'GET', body?: unknown) {
  return handle(new Request('http://localhost' + path, { method, headers: { Host: 'localhost', Origin: 'http://localhost', 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }))
}
const sample = () => ({
  title: 'Lemon soup', description: 'Sunday soup', servings: 4, cuisine: 'Greek',
  ingredients: [{ name: 'Salt', amount: 1, unit: 'tsp' }],
  steps: [{ stepNumber: 2, instruction: 'Serve', sensoryVisual: 'Silky' }, { stepNumber: 1, instruction: 'Simmer' }],
  equipment: [{ name: 'Pot', isEssential: true }]
})
beforeEach(() => {
  db.delete(schema.recipes).run()
  db.delete(schema.userKitchenProfile).run()
})
afterAll(() => { db.$client.close(); vi.unstubAllEnvs() })

describe('recipe HTTP endpoints', () => {
  it('filters recipes by curated collection (quick, feast, easy) and rejects invalid collections', async () => {
    const quick = await (await request('/api/recipes', 'POST', { ...sample(), title: 'Quick soup', totalTimeMinutes: 20, servings: 2, difficulty: 'easy' })).json()
    const feast = await (await request('/api/recipes', 'POST', { ...sample(), title: 'Family feast', totalTimeMinutes: 90, servings: 8, difficulty: 'advanced' })).json()
    expect(quick.id).toEqual(expect.any(String))
    expect(feast.id).toEqual(expect.any(String))
    for (const [collection, recipe] of [['quick', quick], ['feast', feast], ['easy', quick]] as const) {
      const response = await request('/api/recipes?collection=' + collection)
      expect(response.status).toBe(200)
      expect((await response.json()).map((row: { id: string }) => row.id)).toEqual([recipe.id])
    }
    expect((await request('/api/recipes?collection=invalid')).status).toBe(400)
  })

  it('includes collection boundaries and combines collections with existing filters', async () => {
    for (const recipe of [
      { title: 'Boundary', totalTimeMinutes: 30, servings: 6, difficulty: 'easy' },
      { title: 'Outside', totalTimeMinutes: 31, servings: 5, difficulty: 'advanced' }
    ]) {
      expect((await request('/api/recipes', 'POST', { ...sample(), ...recipe })).status).toBe(201)
    }
    for (const collection of ['quick', 'feast', 'easy']) {
      const response = await request('/api/recipes?collection=' + collection)
      expect(response.status).toBe(200)
      expect((await response.json()).map((row: { title: string }) => row.title)).toEqual(['Boundary'])
      expect(await (await request('/api/recipes?collection=' + collection + '&search=Outside')).json()).toEqual([])
    }
    expect(await (await request('/api/recipes?collection=easy&difficulty=advanced')).json()).toEqual([])
    expect(await (await request('/api/recipes')).json()).toHaveLength(2)
  })

  it('round-trips original salt and leaves unspecified originals unknown', async () => {
    const recipe = await (await request('/api/recipes', 'POST', sample())).json()
    expect(recipe.originalSaltType).toBeNull()
    const path = '/api/recipes/' + recipe.id
    expect(await (await request(path, 'PUT', { originalSaltType: 'greek_fine_sea_salt' })).json()).toMatchObject({ originalSaltType: 'greek_fine_sea_salt' })
    expect(await (await request(path)).json()).toMatchObject({ originalSaltType: 'greek_fine_sea_salt' })
    expect((await request(path, 'PUT', { originalSaltType: 'garlic_salt' })).status).toBe(400)
    expect(await (await request(path, 'PUT', { originalSaltType: null })).json()).toMatchObject({ originalSaltType: null })
    const known = await (await request('/api/recipes', 'POST', { ...sample(), originalSaltType: 'morton_kosher' })).json()
    expect(known.originalSaltType).toBe('morton_kosher')
  })

  it('searches Greek titles and cuisines case-insensitively with canonical Unicode equivalence', async () => {
    await request('/api/recipes', 'POST', { ...sample(), title: 'Φασολάδα', cuisine: 'Ελληνική', description: 'Κυριακή' })
    for (const search of ['φασολάδα', 'ΦΑΣΟΛΆΔΑ', 'ΦΑΣΟΛΑΔΑ', 'φασολαδα', 'φασολάδα'.normalize('NFD'), 'κυριακή', 'κυριακη']) {
      const response = await request('/api/recipes?search=' + encodeURIComponent(search) + '&cuisine=' + encodeURIComponent('ελληνική'))
      expect(response.status).toBe(200)
      expect(await response.json()).toHaveLength(1)
    }
    expect(db.$client.prepare('SELECT greek_lower(NULL) AS value').get()).toEqual({ value: null })
  })

  it('uses transaction-scoped reads even when the global select method is unavailable', () => {
    const spy = vi.spyOn(db, 'select').mockImplementation(() => { throw new Error('Global read escaped transaction') })
    try {
      const recipe = saveRecipe(sample())
      expect(recipe.ingredients).toHaveLength(1)
      expect(recipe.steps).toHaveLength(2)
      const updated = saveRecipe({ title: 'Changed in transaction' }, recipe.id)
      expect(updated.title).toBe('Changed in transaction')
      expect(spy).not.toHaveBeenCalled()
    } finally { spy.mockRestore() }
    expect(getRecipe(db.select().from(schema.recipes).get()!.id).title).toBe('Changed in transaction')
  })

  it('blocks cross-origin mutations before database writes and accepts same-origin Referer fallback', async () => {
    const rejected = await handle(new Request('http://localhost/api/recipes', { method: 'POST', headers: { Host: 'localhost', Origin: 'https://attacker.example', 'Content-Type': 'application/json' }, body: JSON.stringify(sample()) }))
    expect(rejected.status).toBe(403)
    expect(db.select().from(schema.recipes).all()).toEqual([])
    const allowed = await handle(new Request('http://localhost/api/recipes', { method: 'POST', headers: { Host: 'localhost', Referer: 'http://localhost/recipes/new', 'Content-Type': 'application/json' }, body: JSON.stringify(sample()) }))
    expect(allowed.status).toBe(201)
  })

  it('preserves long instructions and refreshes timestamps for direct ORM updates', async () => {
    const instruction = 'Stir gently until combined. '.repeat(20)
    const recipe = await (await request('/api/recipes', 'POST', { ...sample(), steps: [{ stepNumber: 1, instruction }] })).json()
    expect(recipe.steps[0].instruction).toBe(instruction.trim())
    db.update(schema.recipes).set({ updatedAt: '2000-01-01T00:00:00.000Z' }).run()
    db.update(schema.recipes).set({ title: 'Updated directly' }).run()
    expect(db.select().from(schema.recipes).get()?.updatedAt).not.toBe('2000-01-01T00:00:00.000Z')
    expect(db.select().from(schema.recipes).get()?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('creates, reads ordered children, partially updates, replaces arrays, and deletes', async () => {
    const created = await request('/api/recipes', 'POST', sample())
    expect(created.status).toBe(201)
    const recipe = await created.json()
    expect(recipe).toMatchObject({ title: 'Lemon soup', rating: null, isFavorite: false, totalTimeMinutes: 45 })
    expect(recipe.steps.map((step: { stepNumber: number }) => step.stepNumber)).toEqual([1, 2])
    const path = '/api/recipes/' + recipe.id
    expect((await request(path)).status).toBe(200)
    const updated = await (await request(path, 'PUT', { isFavorite: true, prepTimeMinutes: 20 })).json()
    expect(updated.ingredients).toEqual(recipe.ingredients)
    expect(updated.equipment).toEqual(recipe.equipment)
    expect(updated.totalTimeMinutes).toBe(50)
    expect(updated.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(updated.isFavorite).toBe(true)
    const replaced = await (await request(path, 'PUT', { ingredients: [{ name: 'Lemon', amount: 2, unit: 'piece' }], steps: [], equipment: [] })).json()
    expect(replaced.ingredients).toHaveLength(1)
    expect(replaced.ingredients[0].name).toBe('Lemon')
    expect(replaced.steps).toEqual([])
    expect(replaced.equipment).toEqual([])
    db.insert(schema.cookingSessions).values({ id: 'session', recipeId: recipe.id }).run()
    expect((await request(path, 'DELETE')).status).toBe(204)
    expect((await request(path)).status).toBe(404)
    for (const table of [schema.ingredients, schema.steps, schema.recipeEquipment, schema.cookingSessions]) expect(db.select().from(table).all()).toEqual([])
  })

  it('filters combinations, groups cocktails with drinks, and searches literals safely', async () => {
    await request('/api/recipes', 'POST', { ...sample(), isFavorite: true, difficulty: 'easy' })
    await request('/api/recipes', 'POST', { title: 'Lemon 100% cooler', description: '', recipeType: 'drink' })
    await request('/api/recipes', 'POST', { title: 'Cocktail', description: '', recipeType: 'cocktail' })
    expect(await (await request('/api/recipes?search=LEMON&type=food&difficulty=easy&cuisine=greek&isFavorite=true')).json()).toHaveLength(1)
    expect(await (await request('/api/recipes?type=drinks')).json()).toHaveLength(2)
    expect(await (await request('/api/recipes?type=cocktail')).json()).toHaveLength(1)
    expect(await (await request('/api/recipes?isFavorite=false')).json()).toHaveLength(2)
    expect(await (await request('/api/recipes?search=%25')).json()).toHaveLength(1)
    expect(await (await request('/api/recipes?search=%27%20OR%201%3D1--')).json()).toEqual([])
  })

  it.each([
    { title: '', description: '' }, { ...sample(), servings: 0 }, { ...sample(), rating: 6 },
    { ...sample(), imageUrl: 'javascript:alert(1)' }, { ...sample(), id: 'owned-id' },
    { ...sample(), ingredients: [{ name: 'Salt', amount: -1, unit: 'g' }] },
    { ...sample(), steps: [{ stepNumber: 1, instruction: 'A' }, { stepNumber: 1, instruction: 'B' }] }
  ])('rejects invalid creation without writes: %j', async body => {
    expect((await request('/api/recipes', 'POST', body)).status).toBe(400)
    expect(db.select().from(schema.recipes).all()).toEqual([])
  })

  it('rejects malformed requests and query values', async () => {
    for (const query of ['type=invalid', 'isFavorite=1', 'difficulty=invalid', 'search=a&search=b']) expect((await request('/api/recipes?' + query)).status).toBe(400)
    expect((await request('/api/recipes/missing', 'PUT', {})).status).toBe(400)
    const response = await handle(new Request('http://localhost/api/recipes', { method: 'POST', headers: { Host: 'localhost', Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: '{' }))
    expect(response.status).toBe(400)
  })

  it('returns 404 on missing update and delete', async () => {
    expect((await request('/api/recipes/missing', 'PUT', { title: 'Missing' })).status).toBe(404)
    expect((await request('/api/recipes/missing', 'DELETE')).status).toBe(404)
  })

  it('invalid update leaves parent and nested records untouched', async () => {
    const recipe = await (await request('/api/recipes', 'POST', sample())).json()
    const response = await request('/api/recipes/' + recipe.id, 'PUT', { title: 'Changed', ingredients: [{ name: '', amount: 2, unit: 'g' }] })
    expect(response.status).toBe(400)
    expect(await (await request('/api/recipes/' + recipe.id)).json()).toEqual(recipe)
  })

  it('rolls back parent and child replacements if a database write fails', async () => {
    const recipe = await (await request('/api/recipes', 'POST', sample())).json()
    db.$client.exec("CREATE TRIGGER reject_step BEFORE INSERT ON steps WHEN NEW.instruction = 'reject' BEGIN SELECT RAISE(ABORT, 'test write failure'); END")
    try {
      const body = { title: 'Changed', ingredients: [], steps: [{ stepNumber: 1, instruction: 'reject' }] }
      expect((await request('/api/recipes/' + recipe.id, 'PUT', body)).status).toBe(500)
      expect(await (await request('/api/recipes/' + recipe.id)).json()).toEqual(recipe)
      expect((await request('/api/recipes', 'POST', { ...sample(), ...body })).status).toBe(500)
      expect(db.select().from(schema.recipes).all()).toHaveLength(1)
    } finally { db.$client.exec('DROP TRIGGER reject_step') }
  })
})

describe('singleton kitchen profile HTTP endpoints', () => {
  it('creates default on first read and updates the same row', async () => {
    expect(await (await request('/api/settings/kitchen')).json()).toMatchObject({ id: 'default', stoveType: 'gas', hasCastIron: true })
    expect(await (await request('/api/settings/kitchen', 'PUT', { stoveType: 'induction', preferredSaltType: 'greek_fine_sea_salt', hasMicrowave: false })).json()).toMatchObject({ id: 'default', stoveType: 'induction', preferredSaltType: 'greek_fine_sea_salt', hasMicrowave: false, hasCastIron: true })
    await request('/api/settings/kitchen')
    expect(db.select().from(schema.userKitchenProfile).all()).toHaveLength(1)
  })
  it('supports PUT before GET, and rejects a caller-selected ID or invalid fields', async () => {
    expect((await request('/api/settings/kitchen', 'PUT', { hasAirFryer: true })).status).toBe(200)
    for (const body of [{ id: 'other' }, { stoveType: 'campfire' }, { hasAirFryer: 'true' }, {}]) expect((await request('/api/settings/kitchen', 'PUT', body)).status).toBe(400)
    expect(db.select().from(schema.userKitchenProfile).all()).toHaveLength(1)
  })
})
