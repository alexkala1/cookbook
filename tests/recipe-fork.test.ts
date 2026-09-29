import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import { createApp, createRouter, toWebHandler } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { fileURLToPath } from 'node:url'
import { readFileSync, readdirSync } from 'node:fs'
import Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { db } from '../server/db'
import { recipes, ingredients, steps, recipeEquipment } from '../server/db/schema'
import fork from '../server/api/recipes/[id]/fork.post'
import csrf from '../server/middleware/csrf'
import { forkRecipe, getRecipe, saveRecipe } from '../server/utils/recipes'
import { exportBackup, importBackup } from '../server/utils/backup'

vi.mock('../server/db', async () => {
  vi.stubEnv('DATABASE_URL', ':memory:')
  return await vi.importActual('../server/db')
})
migrate(db, { migrationsFolder: fileURLToPath(new URL('../server/db/migrations', import.meta.url)) })
const handle = toWebHandler(createApp().use(csrf).use(createRouter().post('/api/recipes/:id/fork', fork)))
const request = (id: string, body?: unknown, origin = 'http://localhost') => handle(new Request(`http://localhost/api/recipes/${id}/fork`, {
  method: 'POST', headers: { Host: 'localhost', Origin: origin, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
}))
beforeEach(() => db.delete(recipes).run())
afterAll(() => { db.$client.close(); vi.unstubAllEnvs() })
const sample = () => saveRecipe({
  title: 'Yiayia’s soup', description: 'Family lunch', cuisine: 'Greek', heirloomNotes: 'Sunday tradition',
  originalSaltType: 'greek_fine_sea_salt', imageUrl: 'data:image/png;base64,YQ==',
  servings: 6, rating: 4.5, isFavorite: true, storageReheating: 'Refrigerate promptly',
  ingredients: [{ name: 'Beans', amount: 250, unit: 'g', gramsEquivalent: 250, category: 'pantry', notes: 'Soaked', sortOrder: 4 }],
  steps: [{ stepNumber: 1, instruction: 'Simmer', durationMinutes: 30, timerRequired: true, heatLevel: 'low', scienceWhy: 'Soften beans', sensoryVisual: 'Creamy', sensoryAudio: 'Bubbling', sensoryAroma: 'Herbs', sensoryTexture: 'Tender', failurePrevention: 'Keep moist', internalTempTargetC: 74, sortOrder: 2 }],
  equipment: [{ name: 'Pot', isEssential: false, substituteTool: 'Dutch oven' }]
})

it('migrates a populated legacy database without changing existing rows', () => {
  const legacy = new Database(':memory:')
  const folder = new URL('../server/db/migrations/', import.meta.url)
  try {
    for (const filename of readdirSync(folder).filter(name => name.endsWith('.sql') && name < '0005_').sort()) {
      legacy.exec(readFileSync(new URL(filename, folder), 'utf8'))
    }
    legacy.prepare('INSERT INTO recipes (id, title, description) VALUES (?, ?, ?)').run('old', 'Family soup', 'Keep me')
    const before = legacy.prepare('SELECT * FROM recipes').get()
    legacy.exec(readFileSync(new URL('0005_noisy_wolfpack.sql', folder), 'utf8'))
    expect(legacy.prepare('SELECT * FROM recipes').get()).toEqual({ ...before!, parent_recipe_id: null, variation_name: null })
  } finally { legacy.close() }
})

it('deep copies every persisted recipe and child field with fresh IDs through HTTP', async () => {
  const original = sample()
  const response = await request(original.id)
  expect(response.status).toBe(201)
  const copy = await response.json()
  expect(copy.id).not.toBe(original.id)
  expect(copy.id).toMatch(/^[\da-f-]{36}$/)
  const { ingredients: _ingredients, steps: _steps, equipment: _equipment, parent: _parent, variations: _variations, ...fields } = original
  expect(copy).toMatchObject({ ...fields, id: copy.id, title: `${original.title} (My Twist)`, parentRecipeId: original.id, variationName: 'My Twist', parent: { id: original.id, title: original.title }, variations: [] })
  for (const key of ['ingredients', 'steps', 'equipment'] as const) {
    expect(copy[key]).toHaveLength(original[key].length)
    for (const [index, row] of original[key].entries()) {
      expect(copy[key][index].id).not.toBe(row.id)
      expect(copy[key][index]).toEqual({ ...row, id: copy[key][index].id, recipeId: copy.id })
    }
  }
  expect(getRecipe(original.id).variations).toEqual([{ id: copy.id, title: copy.title, variationName: 'My Twist' }])
})

it.each([
  [{}, 'Yiayia’s soup (My Twist)', 'My Twist'],
  [{ variationName: 'Lemon & dill' }, 'Yiayia’s soup (Lemon & dill)', 'Lemon & dill'],
  [{ title: 'My soup' }, 'My soup', 'My Twist'],
  [{ title: 'My soup', variationName: 'Summer' }, 'My soup', 'Summer'],
  [{ title: '', variationName: '' }, 'Yiayia’s soup (My Twist)', 'My Twist']
])('supports default and custom naming %j', async (options, title, variationName) => {
  const original = sample()
  const response = await request(original.id, options)
  expect(response.status).toBe(201)
  expect(await response.json()).toMatchObject({ title, variationName, parentRecipeId: original.id })
})

it('isolates edits to both parent and fork, including all child collections', () => {
  const original = sample()
  const copy = forkRecipe(original.id, {})
  saveRecipe({ title: 'Different', ingredients: [{ name: 'Rice', amount: 10, unit: 'g' }], steps: [{ stepNumber: 1, instruction: 'Steam' }], equipment: [{ name: 'Steamer' }] }, copy.id)
  expect(getRecipe(original.id)).toEqual({ ...original, variations: [{ id: copy.id, title: 'Different', variationName: 'My Twist' }] })
  const changedCopy = getRecipe(copy.id)
  saveRecipe({ ingredients: [], steps: [], equipment: [] }, original.id)
  expect(getRecipe(copy.id)).toEqual(changedCopy)
})

it('uses the immediate parent for nested variations and tolerates a deleted parent', () => {
  const root = sample()
  expect(root.parent).toBeNull()
  expect(root.parentRecipeId).toBeNull()
  expect(root.variationName).toBeNull()
  const child = forkRecipe(root.id, { variationName: 'A' })
  const grandchild = forkRecipe(child.id, { variationName: 'B' })
  expect(grandchild.parent).toEqual({ id: child.id, title: child.title })
  expect(getRecipe(root.id).variations.map(row => row.id)).toEqual([child.id])
  db.delete(recipes).where(eq(recipes.id, child.id)).run()
  expect(getRecipe(grandchild.id)).toMatchObject({ parent: null, parentRecipeId: child.id })
  expect(getRecipe(grandchild.id).ingredients).toHaveLength(1)
})

it('reads the original and returned metadata through the same transaction', () => {
  const original = sample()
  const spy = vi.spyOn(db, 'select').mockImplementation(() => { throw new Error('Outside transaction') })
  try {
    expect(forkRecipe(original.id, {}).parent?.id).toBe(original.id)
    expect(spy).not.toHaveBeenCalled()
  } finally { spy.mockRestore() }
})

it('rolls back parent and every copied child when a later insert fails', async () => {
  const original = sample()
  db.$client.exec("CREATE TRIGGER reject_fork BEFORE INSERT ON recipe_equipment BEGIN SELECT RAISE(ABORT, 'fork failed'); END")
  try {
    expect((await request(original.id, {})).status).toBe(500)
    expect(getRecipe(original.id)).toEqual(original)
    for (const table of [recipes, ingredients, steps, recipeEquipment]) expect(db.select().from(table).all()).toHaveLength(1)
  } finally { db.$client.exec('DROP TRIGGER reject_fork') }
})

it('returns 404 for a missing parent and rejects invalid options or cross-origin writes', async () => {
  const original = sample()
  expect((await request('missing', {})).status).toBe(404)
  for (const body of [null, [], { title: 123 }, { variationName: 1 }, { title: 'x'.repeat(201) }, { variationName: 'x'.repeat(201) }, { parentRecipeId: 'other' }]) {
    expect((await request(original.id, body)).status).toBe(400)
  }
  expect((await request(original.id, {}, 'https://attacker.example')).status).toBe(403)
  expect(db.select().from(recipes).all()).toHaveLength(1)
})

it('preserves lineage through backup round trips, including long generated titles', () => {
  const root = saveRecipe({ title: 'x'.repeat(200), description: '' })
  const child = forkRecipe(root.id, { variationName: 'y'.repeat(200) })
  const before = getRecipe(root.id)
  const backup = exportBackup()
  db.delete(recipes).run()
  importBackup(backup)
  expect(getRecipe(root.id)).toEqual(before)
  expect(getRecipe(child.id)).toEqual(child)
})

it('accepts pre-lineage v1 backups and restores missing lineage as null', () => {
  const root = sample()
  const copy = forkRecipe(root.id, {})
  const backup = exportBackup()
  for (const row of backup.recipes) { delete row.parentRecipeId; delete row.variationName }
  importBackup(backup)
  expect(getRecipe(copy.id)).toMatchObject({ parentRecipeId: null, variationName: null, parent: null })
})
