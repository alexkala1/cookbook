import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import { createApp, createRouter, toWebHandler } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { fileURLToPath } from 'node:url'
import { eq } from 'drizzle-orm'
import { db } from '../server/db'
import { cookLogs, guests, recipes } from '../server/db/schema'
import safety from '../server/api/recipes/[id]/safety.get'
import createLog from '../server/api/recipes/[id]/cook-log.post'
import listLogs from '../server/api/recipes/[id]/cook-logs.get'
import csrf from '../server/middleware/csrf'
import { saveRecipe } from '../server/utils/recipes'
import { saveGuest } from '../server/utils/guests'
import { createCookLog } from '../server/utils/cook-logs'
import { backupSchema, exportBackup, importBackup } from '../server/utils/backup'

vi.mock('../server/db', async () => {
  vi.stubEnv('DATABASE_URL', ':memory:')
  return await vi.importActual('../server/db')
})
migrate(db, { migrationsFolder: fileURLToPath(new URL('../server/db/migrations', import.meta.url)) })
const handle = toWebHandler(createApp().use(csrf).use(createRouter()
  .get('/api/recipes/:id/safety', safety)
  .post('/api/recipes/:id/cook-log', createLog)
  .get('/api/recipes/:id/cook-logs', listLogs)))
const request = (id: string, route: string, body?: unknown, origin = 'http://localhost') => handle(new Request(`http://localhost/api/recipes/${id}/${route}`, {
  method: route === 'cook-log' ? 'POST' : 'GET',
  headers: { Host: 'localhost', Origin: origin, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
}))
beforeEach(() => { db.delete(recipes).run(); db.delete(guests).run() })
afterAll(() => { db.$client.close(); vi.unstubAllEnvs() })
const recipe = (names = ['Flour', 'Butter', 'Walnuts', 'Milk']) => saveRecipe({
  title: 'Family cake', description: '', ingredients: names.map(name => ({ name, amount: 1, unit: 'g' }))
})

it('returns distinct allergens and no invented conflicts when there are no guests', async () => {
  const response = await request(recipe().id, 'safety')
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ allergens: ['gluten', 'dairy', 'nuts'], conflicts: [] })
})

it('cross-references all guests, normalizes allergy aliases, and keeps ingredient attribution', async () => {
  const dish = recipe()
  const eleni = saveGuest({ name: 'Eleni', allergies: ['milk', 'dairy', 'wheat'] })
  const nikos = saveGuest({ name: 'Nikos', allergies: ['nuts'] })
  saveGuest({ name: 'Other', allergies: ['shellfish'], dietaryRestrictions: ['vegan'], dislikes: ['Butter'] })
  const result = await (await request(dish.id, 'safety')).json()
  expect(result.conflicts).toEqual([
    { guestId: eleni.id, guestName: 'Eleni', allergen: 'gluten', ingredient: 'Flour' },
    { guestId: eleni.id, guestName: 'Eleni', allergen: 'dairy', ingredient: 'Butter' },
    { guestId: nikos.id, guestName: 'Nikos', allergen: 'nuts', ingredient: 'Walnuts' },
    { guestId: eleni.id, guestName: 'Eleni', allergen: 'dairy', ingredient: 'Milk' }
  ])
})

it('uses the shared Greek and compound-ingredient rules', async () => {
  const dish = recipe(['Αλεύρι', 'Βούτυρο', 'Καρύδια', 'peanut butter', 'rice flour', 'coconut milk'])
  const guest = saveGuest({ name: 'Guest', allergies: ['dairy', 'gluten', 'nuts'] })
  const result = await (await request(dish.id, 'safety')).json()
  expect(result.allergens).toEqual(['gluten', 'dairy', 'nuts'])
  expect(result.conflicts).toEqual([
    { guestId: guest.id, guestName: 'Guest', allergen: 'gluten', ingredient: 'Αλεύρι' },
    { guestId: guest.id, guestName: 'Guest', allergen: 'dairy', ingredient: 'Βούτυρο' },
    { guestId: guest.id, guestName: 'Guest', allergen: 'nuts', ingredient: 'Καρύδια' },
    { guestId: guest.id, guestName: 'Guest', allergen: 'nuts', ingredient: 'peanut butter' }
  ])
  expect(await (await request(recipe([]).id, 'safety')).json()).toEqual({ allergens: [], conflicts: [] })
})

it('creates and lists logs with defaults, optional fields and independent IDs', async () => {
  const dish = recipe()
  expect(await (await request(dish.id, 'cook-logs')).json()).toEqual([])
  const response = await request(dish.id, 'cook-log', { notes: ' Added lemon ', rating: 4.5, servings: 6 })
  expect(response.status).toBe(201)
  const first = await response.json()
  expect(first).toEqual({ id: expect.any(String), recipeId: dish.id, cookedAt: expect.any(String), notes: 'Added lemon', rating: 4.5, servings: 6 })
  expect(first.cookedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/)
  const secondResponse = await request(dish.id, 'cook-log')
  expect(secondResponse.status).toBe(201)
  const second = await secondResponse.json()
  expect(second).toMatchObject({ recipeId: dish.id, servings: 4, notes: null, rating: null })
  expect(second.id).not.toBe(first.id)
  expect(await (await request(dish.id, 'cook-logs')).json()).toEqual(expect.arrayContaining([first, second]))
})

it('lists only the requested recipe logs newest first with deterministic timestamp ties', async () => {
  const dish = recipe()
  const other = recipe()
  db.insert(cookLogs).values([
    { id: 'a', recipeId: dish.id, cookedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'b', recipeId: dish.id, cookedAt: '2026-02-01T00:00:00.000Z' },
    { id: 'c', recipeId: dish.id, cookedAt: '2026-02-01T00:00:00.000Z' },
    { id: 'other', recipeId: other.id, cookedAt: '2026-03-01T00:00:00.000Z' }
  ]).run()
  const rows = await (await request(dish.id, 'cook-logs')).json()
  expect(rows.map((row: { id: string }) => row.id)).toEqual(['c', 'b', 'a'])
})

it.each([{ rating: 0 }, { rating: 6 }, { rating: '5' }, { servings: 0 }, { servings: 1.5 }, { servings: 1001 }, { notes: 'x'.repeat(10001) }, { notes: null }, { recipeId: 'other' }, { cookedAt: '2026-01-01' }, null, []])('rejects invalid log input %# without writes', async body => {
  expect((await request(recipe().id, 'cook-log', body)).status).toBe(400)
  expect(db.select().from(cookLogs).all()).toEqual([])
})

it('returns 404 for unknown recipes and rejects cross-origin writes', async () => {
  for (const route of ['safety', 'cook-logs', 'cook-log']) expect((await request('missing', route)).status).toBe(404)
  expect((await request(recipe().id, 'cook-log', {}, 'https://attacker.example')).status).toBe(403)
  expect(db.select().from(cookLogs).all()).toEqual([])
})

it('cascades deletion only to the deleted recipe journals', () => {
  const first = recipe(), second = recipe()
  createCookLog(first.id, { notes: 'First' })
  const keep = createCookLog(second.id, { notes: 'Second' })
  db.delete(recipes).where(eq(recipes.id, first.id)).run()
  expect(db.select().from(cookLogs).all()).toEqual([keep])
})

it('round-trips cook logs through backup and repeats imports without duplicates', () => {
  const dish = recipe()
  createCookLog(dish.id, { notes: 'Less sugar next time', rating: 4, servings: 3 })
  createCookLog(dish.id, {})
  const backup = exportBackup()
  expect(backup.cookLogs).toHaveLength(2)
  expect(backupSchema.safeParse(backup).success).toBe(true)
  db.delete(recipes).run()
  importBackup(backup)
  importBackup(backup)
  expect(exportBackup()).toEqual({ ...backup, exportedAt: expect.any(String) })
  const legacy = structuredClone(backup)
  delete legacy.cookLogs
  importBackup(legacy)
  expect(exportBackup().cookLogs).toEqual(backup.cookLogs)
})

it('rejects invalid backup journals and rolls back a late journal insert failure', () => {
  const dish = recipe()
  createCookLog(dish.id, { notes: 'Keep' })
  const before = exportBackup()
  for (const field of ['duplicate', 'orphan', 'rating']) {
    const invalid = structuredClone(before)
    if (field === 'duplicate') invalid.cookLogs!.push(invalid.cookLogs![0]!)
    else if (field === 'orphan') invalid.cookLogs![0]!.recipeId = 'missing'
    else invalid.cookLogs![0]!.rating = 6
    expect(() => importBackup(invalid)).toThrow()
  }
  const changed = structuredClone(before)
  changed.recipes[0]!.title = 'Must roll back'
  db.$client.exec("CREATE TRIGGER reject_log BEFORE INSERT ON cook_logs BEGIN SELECT RAISE(ABORT, 'journal failure'); END")
  try {
    expect(() => importBackup(changed)).toThrow('journal failure')
    expect(exportBackup()).toEqual({ ...before, exportedAt: expect.any(String) })
  } finally { db.$client.exec('DROP TRIGGER reject_log') }
})

it('refuses to transfer an existing journal ID to another recipe during import', () => {
  const first = recipe(), second = recipe()
  createCookLog(first.id, {})
  const before = exportBackup()
  const changed = structuredClone(before)
  changed.cookLogs![0]!.recipeId = second.id
  expect(() => importBackup(changed)).toThrow('Cook log ID belongs to a different recipe')
  expect(exportBackup()).toEqual({ ...before, exportedAt: expect.any(String) })
})
