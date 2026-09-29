import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import { createApp, createRouter, toWebHandler } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { fileURLToPath } from 'node:url'
import { db } from '../server/db'
import { pantryItems, recipes, ingredients } from '../server/db/schema'
import list from '../server/api/pantry/index.get'
import create from '../server/api/pantry/index.post'
import remove from '../server/api/pantry/[id].delete'
import update from '../server/api/pantry/[id].patch'
import match from '../server/api/pantry/match.post'
import receipt from '../server/api/pantry/receipt.post'
import csrf from '../server/middleware/csrf'
import { inferStorage, matchPantry, normalizePantryName, parseReceipt, pantryStepForUnit, PANTRY_STAPLES, type PantryItem } from '../shared/culinary/pantry'
import { pantryInput } from '../server/utils/pantry'

vi.mock('../server/db', async () => { vi.stubEnv('DATABASE_URL', ':memory:'); return vi.importActual('../server/db') })
migrate(db, { migrationsFolder: fileURLToPath(new URL('../server/db/migrations', import.meta.url)) })
const handle = toWebHandler(createApp().use(csrf).use(createRouter().get('/api/pantry', list).post('/api/pantry', create).patch('/api/pantry/:id', update).delete('/api/pantry/:id', remove).post('/api/pantry/match', match).post('/api/pantry/receipt', receipt)))
function request(path = '', method = 'GET', body?: unknown, origin = 'http://localhost') {
  return handle(new Request('http://localhost/api/pantry' + path, { method, headers: { Host: 'localhost', Origin: origin, 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }))
}
beforeEach(() => { db.delete(pantryItems).run(); db.delete(recipes).run() })
it.each([['g', 50], ['ml', 50], ['item', 1], ['kg', 1], ['tbsp', 1], [' ML ', 50], [' G ', 50]])('steps %s by %s', (unit, expected) => {
  expect(pantryStepForUnit(unit)).toBe(expected)
})
afterAll(() => { db.$client.close(); vi.unstubAllEnvs() })
it('provides eight valid Mediterranean pantry staples', () => {
  expect(PANTRY_STAPLES).toHaveLength(8)
  expect(PANTRY_STAPLES.map(item => item.name)).toEqual(['Olive oil', 'Onions', 'Garlic', 'Tomatoes', 'Oregano', 'Lemons', 'Feta', 'Eggs'])
  for (const item of PANTRY_STAPLES) expect(pantryInput.safeParse(item).success).toBe(true)
})
it('adds, lists, merges compatible quantities, separates locations and deletes', async () => {
  const first = await (await request('', 'POST', { name: 'Αλάτι', quantity: 1, unit: 'kg' })).json()
  expect(first[0]).toMatchObject({ normalizedName: 'αλατι', createdAt: expect.any(Number), updatedAt: expect.any(Number), storageLocation: 'pantry' })
  const response = await request('', 'POST', [{ name: 'ΑΛΑΤΙ', quantity: 500, unit: 'g' }, { name: 'αλάτι', storageLocation: 'fridge' }])
  expect(response.status).toBe(200)
  const rows = await (await request()).json()
  expect(rows).toHaveLength(2)
  expect(rows.find((row: PantryItem) => row.storageLocation === 'pantry')).toMatchObject({ id: first[0].id, quantity: 1500, unit: 'g' })
  expect((await request('/' + first[0].id, 'DELETE')).status).toBe(200)
  expect((await request('/' + first[0].id, 'DELETE')).status).toBe(404)
})
it('sorts soonest expiry first, unknown dates last, then location', async () => {
  await request('', 'POST', [{ name: 'Unknown' }, { name: 'Later', expiresAt: 2000 }, { name: 'Soon', expiresAt: 1000 }, { name: 'Frozen', storageLocation: 'freezer', expiresAt: 1000 }])
  expect((await (await request()).json()).map((row: PantryItem) => row.name)).toEqual(['Frozen', 'Soon', 'Later', 'Unknown'])
  await request('', 'POST', { name: 'Soon', expiresAt: 3000 })
  expect(db.select().from(pantryItems).all().find(row => row.name === 'Soon')?.expiresAt).toBe(1000)
})
it('adjusts pantry quantity and persists the updated item without changing its metadata', async () => {
  const [item] = await (await request('', 'POST', { name: 'Feta', quantity: 200, unit: 'g', storageLocation: 'fridge', expiresAt: 2000 })).json()
  const response = await request('/' + item.id, 'PATCH', { delta: 50 })
  expect(response.status).toBe(200)
  const updated = await response.json()
  expect(updated).toEqual({ ...item, quantity: 250, updatedAt: expect.any(Number) })
  expect(updated.updatedAt).toBeGreaterThanOrEqual(item.updatedAt)
  expect(await (await request()).json()).toEqual([updated])
  expect(await (await request('/' + item.id, 'PATCH', { delta: -50 })).json()).toMatchObject({ quantity: 200 })
})
it.each([
  [1, 0.23456, 1.235], [0.3, -0.1, 0.2], [1, -1000000, 0], [999999, 1000000, 1000000], [1, 0, 1]
])('clamps and rounds %s plus %s to %s', async (quantity, delta, expected) => {
  const [item] = await (await request('', 'POST', { name: 'Olive oil', quantity, unit: 'l' })).json()
  const response = await request('/' + item.id, 'PATCH', { delta })
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ id: item.id, quantity: expected })
  expect(await (await request()).json()).toEqual([expect.objectContaining({ id: item.id, quantity: expected })])
})
it('rejects invalid quantity updates and cross-origin requests without changing stock', async () => {
  const [item] = await (await request('', 'POST', { name: 'Eggs', quantity: 6 })).json()
  for (const body of [{}, { delta: '1' }, { delta: null }, { delta: 1000001 }, { delta: -1000001 }, { delta: 1, quantity: 99 }, [], null]) {
    expect((await request('/' + item.id, 'PATCH', body)).status).toBe(400)
  }
  expect((await request('/' + item.id, 'PATCH', { delta: 1 }, 'https://evil.example')).status).toBe(403)
  expect(await (await request()).json()).toEqual([item])
  expect((await request('/missing', 'PATCH', { delta: 1 })).status).toBe(404)
})
it('rolls back the whole batch on incompatible units and validates all input', async () => {
  await request('', 'POST', { name: 'Flour', unit: 'g' })
  expect((await request('', 'POST', [{ name: 'Milk' }, { name: 'Flour', unit: 'cup' }])).status).toBe(409)
  expect(db.select().from(pantryItems).all()).toHaveLength(1)
  for (const body of [{ name: 'x', storageLocation: 'garage' }, { name: 'x', quantity: -1 }, { name: 'x', quantity: 0 }, { name: 'x', expiresAt: 'tomorrow' }, { name: 'x', id: 'override' }, { name: '!!!' }, []]) expect((await request('', 'POST', body)).status).toBe(400)
  expect((await request('', 'POST', { name: 'x' }, 'https://evil.example')).status).toBe(403)
  expect(() => db.$client.prepare("UPDATE pantry_items SET storage_location='garage'").run()).toThrow(/CHECK/)
})
it('ranks saved recipes by sufficient ingredients and excludes expired stock', async () => {
  db.insert(recipes).values([{ id: 'full', title: 'Bread', description: '' }, { id: 'partial', title: 'Cake', description: '' }, { id: 'empty', title: 'Empty', description: '' }]).run()
  db.insert(ingredients).values([{ id: 'a', recipeId: 'full', name: 'Flour', amount: 500, unit: 'g' }, { id: 'b', recipeId: 'partial', name: 'Flour', amount: 500, unit: 'g' }, { id: 'c', recipeId: 'partial', name: 'Milk', amount: 100, unit: 'ml' }]).run()
  await request('', 'POST', [{ name: 'flour', quantity: 1, unit: 'kg' }, { name: 'milk', quantity: 1, unit: 'l', expiresAt: 1 }])
  const matches = await (await request('/match', 'POST')).json()
  expect(matches.map((row: { completeness: number }) => row.completeness)).toEqual([100, 50, 0])
  expect(matches[1].in_stock[0].name).toBe('Flour'); expect(matches[1].missing[0]).toMatchObject({ name: 'Milk', reason: 'Not in stock (or expired)' })
})
it('does not reuse stock for duplicate ingredients or confuse compounds', () => {
  const stock: PantryItem[] = [{ id: 'x', name: 'butter', normalizedName: 'butter', quantity: 100, unit: 'g', storageLocation: 'fridge', expiresAt: null, createdAt: 0, updatedAt: 0 }]
  const result = matchPantry([{ id: 'r', title: 'R', ingredients: [{ name: 'butter', amount: 60, unit: 'g' }, { name: 'butter', amount: 60, unit: 'g' }, { name: 'peanut butter', amount: 1, unit: 'g' }, { name: 'butter', amount: 1, unit: 'cup' }] }], stock)[0]!
  expect(result.completeness).toBe(25)
  expect(result.missing.map(row => row.reason)).toEqual(['Insufficient quantity', 'Not in stock (or expired)', 'Check quantity: units differ'])
  expect(stock[0]!.quantity).toBe(100)
})
it('normalizes Greek accents and plural aliases without substring matches', () => {
  expect(normalizePantryName('  ΦΑΣΟΛΆΔΑ  ')).toBe('φασολαδα')
  expect(normalizePantryName('Σάλτσα')).toBe('σαλτσα')
})
it.each([['milk', 'fridge'], ['frozen peas', 'freezer'], ['rice', 'pantry'], ['ΓΑΛΑ', 'fridge'], ['ice cream', 'freezer']])('infers %s storage as %s', (name, expected) => expect(inferStorage(name)).toBe(expected))
it.each(['lamb chops', 'ground beef', 'frozen lamb'])('infers fridge for %s from chasapis regardless of name', name => {
  expect(inferStorage(name, 'chasapis')).toBe('fridge')
})
it.each([['lamb chops', 'pantry'], ['ground beef', 'fridge'], ['frozen lamb', 'freezer']])('keeps name-based storage for %s outside chasapis', (name, expected) => {
  expect(inferStorage(name)).toBe(expected)
  expect(inferStorage(name, 'other')).toBe(expected)
  expect(inferStorage(name, '')).toBe(expected)
})
it('parses receipt text with counts, weights, Greek names and excludes payment lines', async () => {
  const text = '2 x Milk 1.50\nRice 500 g 2.49\nFrozen peas 3.20\nΓάλα 1,80\nTOTAL 9.00\nVAT 1.00\nΣΥΝΟΛΟ 9,00\n26/09/2026\nCARD 9.00'
  expect(parseReceipt(text)).toEqual([
    { name: 'Milk', quantity: 2, unit: 'item', storageLocation: 'fridge', expiresAt: null },
    { name: 'Rice', quantity: 500, unit: 'g', storageLocation: 'pantry', expiresAt: null },
    { name: 'Frozen peas', quantity: 1, unit: 'item', storageLocation: 'freezer', expiresAt: null },
    { name: 'Γάλα', quantity: 1, unit: 'item', storageLocation: 'fridge', expiresAt: null }
  ])
  const response = await request('/receipt', 'POST', { text })
  expect(response.status).toBe(200); expect((await response.json()).items).toHaveLength(4)
  expect(db.select().from(pantryItems).all()).toHaveLength(0)
  expect((await request('/receipt', 'POST', { text: '' })).status).toBe(400)
  expect((await request('/receipt', 'POST', { text: 'x'.repeat(30001) })).status).toBe(400)
})
