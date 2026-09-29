import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import { createApp, createRouter, toWebHandler } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { fileURLToPath } from 'node:url'
import { eq } from 'drizzle-orm'
import { db } from '../server/db'
import { pantryItems, recipes, ingredients } from '../server/db/schema'
import list from '../server/api/recipes/index.get'
import image from '../server/api/recipes/[id]/image.get'
import deduct from '../server/api/pantry/deduct.post'
import { suggestMetric, flourBasis } from '../shared/culinary/densities'
import { routeShoppingList, type MarketShoppingList } from '../app/utils/shopping-list'

vi.mock('../server/db', async () => { vi.stubEnv('DATABASE_URL', ':memory:'); return vi.importActual('../server/db') })
migrate(db, { migrationsFolder: fileURLToPath(new URL('../server/db/migrations', import.meta.url)) })
const handle = toWebHandler(createApp().use(createRouter().get('/api/recipes', list).get('/api/recipes/:id/image', image).post('/api/pantry/deduct', deduct)))
const get = (path: string) => handle(new Request('http://localhost' + path, { headers: { Host: 'localhost' } }))
const post = (path: string, body: unknown) => handle(new Request('http://localhost' + path, { method: 'POST', headers: { Host: 'localhost', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
afterAll(() => { db.$client.close(); vi.unstubAllEnvs() })
beforeEach(() => { db.delete(pantryItems).run(); db.delete(recipes).run() })

const png = Buffer.from('hello-image-bytes')
const dataUrl = 'data:image/jpeg;base64,' + png.toString('base64')

it('lists inline photos as lightweight endpoint URLs and serves the bytes with immutable caching', async () => {
  db.insert(recipes).values([
    { id: 'a', title: 'Card', description: '', imageUrl: dataUrl },
    { id: 'b', title: 'Web', description: '', imageUrl: 'https://example.com/x.jpg' },
    { id: 'c', title: 'None', description: '' }
  ]).run()
  const rows = await (await get('/api/recipes')).json() as { id: string, imageUrl: string | null }[]
  const byId = Object.fromEntries(rows.map(row => [row.id, row.imageUrl]))
  expect(byId.a).toMatch(/^\/api\/recipes\/a\/image\?v=/)
  expect(byId.b).toBe('https://example.com/x.jpg')
  expect(byId.c).toBeNull()
  expect(JSON.stringify(rows).length).toBeLessThan(2000)

  const response = await get('/api/recipes/a/image')
  expect(response.headers.get('content-type')).toBe('image/jpeg')
  expect(response.headers.get('cache-control')).toBe('public, max-age=86400, immutable')
  expect(Buffer.from(await response.arrayBuffer())).toEqual(png)
})

it('image endpoint redirects web URLs and 404s when there is nothing to serve', async () => {
  db.insert(recipes).values([{ id: 'b', title: 'Web', description: '', imageUrl: 'https://example.com/x.jpg' }, { id: 'c', title: 'None', description: '' }, { id: 'd', title: 'Odd', description: '', imageUrl: 'ftp://x' }]).run()
  const redirect = await get('/api/recipes/b/image')
  expect(redirect.status).toBe(302)
  expect(redirect.headers.get('location')).toBe('https://example.com/x.jpg')
  for (const id of ['c', 'd', 'missing']) expect((await get(`/api/recipes/${id}/image`)).status).toBe(404)
})

it('deducts cooked ingredients from the soonest-expiring stock, converting units and deleting empty rows', async () => {
  const now = Date.now()
  db.insert(recipes).values({ id: 'r', title: 'Bread', description: '' }).run()
  db.insert(ingredients).values([
    { id: '1', recipeId: 'r', name: 'Flour', amount: 500, unit: 'g' },
    { id: '2', recipeId: 'r', name: 'Milk', amount: 250, unit: 'ml' },
    { id: '3', recipeId: 'r', name: 'Salt', amount: 1, unit: 'tsp' },
    { id: '4', recipeId: 'r', name: 'Eggs', amount: 2, unit: 'item' }
  ]).run()
  const row = (id: string, name: string, quantity: number, unit: string, expiresAt: number | null = null) => ({ id, name, normalizedName: name.toLowerCase(), quantity, unit, storageLocation: 'pantry' as const, expiresAt, createdAt: now, updatedAt: now })
  db.insert(pantryItems).values([
    row('f', 'flour', 1, 'kg'), row('m', 'Milk', 0.2, 'l'), row('e', 'Eggs', 6, 'item', now - 1000), row('e2', 'eggs', 2, 'item', now + 86400000), row('x', 'Salt', 100, 'g')
  ]).run()
  const response = await post('/api/pantry/deduct', { recipeId: 'r' })
  expect(response.status).toBe(200)
  const { deducted } = await response.json()
  expect(deducted).toEqual([{ name: 'Flour', amount: '500 g' }, { name: 'Milk', amount: '200 ml' }, { name: 'Eggs', amount: '2 item' }])
  const stock = Object.fromEntries(db.select().from(pantryItems).all().map(item => [item.id, item.quantity]))
  expect(stock.f).toBeCloseTo(0.5)
  expect(stock.m).toBeUndefined() // used up entirely, row removed
  expect(stock.e).toBe(6) // expired stock untouched
  expect(stock.e2).toBeUndefined()
  expect(stock.x).toBe(100) // tsp (volume) cannot be taken from grams (mass): left alone
})

it('rejects unknown recipes and bad bodies', async () => {
  expect((await post('/api/pantry/deduct', { recipeId: 'nope' })).status).toBe(404)
  expect((await post('/api/pantry/deduct', {})).status).toBe(400)
  expect((await post('/api/pantry/deduct', { recipeId: 'x', extra: 1 })).status).toBe(400)
  expect(db.select().from(pantryItems).where(eq(pantryItems.id, 'none')).all()).toEqual([])
})

it('flour guidance warns about packed cups', () => {
  for (const name of ['flour', 'bread flour', 'all purpose flour']) {
    expect(suggestMetric({ name, amount: 2, unit: 'cup' })).toMatchObject({ amount: 240, basis: flourBasis })
  }
  expect(flourBasis).toBe('Approx. 120 g per spooned cup (spoon lightly into cup; dipped/scooped cups can weigh 140g+)')
})

it('routes destinations in the cook’s custom shop order', () => {
  const item = (id: string) => ({ id, name: id, amount: 1, unit: 'kg' })
  const list = { title: 'L', prepAlerts: [], destinations: [{ section: 'laiki', items: [item('a')] }, { section: 'chasapis', items: [item('b')] }, { section: 'supermarket', items: [item('c')] }] } as unknown as MarketShoppingList
  expect(routeShoppingList(list).destinations.map(d => d.section)).toEqual(['laiki', 'chasapis', 'supermarket'])
  expect(routeShoppingList(list, {}, 'market', ['supermarket', 'chasapis', 'fournos', 'laiki']).destinations.map(d => d.section)).toEqual(['supermarket', 'chasapis', 'laiki'])
})

it('deducts in proportion to the servings actually cooked', async () => {
  const now = Date.now()
  db.insert(recipes).values({ id: 's', title: 'Soup', description: '', servings: 4 }).run()
  db.insert(ingredients).values({ id: 'sf', recipeId: 's', name: 'Flour', amount: 200, unit: 'g' }).run()
  db.insert(pantryItems).values({ id: 'pf', name: 'Flour', normalizedName: 'flour', quantity: 1, unit: 'kg', storageLocation: 'pantry', expiresAt: null, createdAt: now, updatedAt: now }).run()
  expect((await (await post('/api/pantry/deduct', { recipeId: 's', servings: 8 })).json()).deducted).toEqual([{ name: 'Flour', amount: '400 g' }])
  expect((await (await post('/api/pantry/deduct', { recipeId: 's', servings: 2 })).json()).deducted).toEqual([{ name: 'Flour', amount: '100 g' }])
  expect(db.select().from(pantryItems).all()[0]!.quantity).toBeCloseTo(0.5)
  for (const servings of [0, -1, 1001, 'many']) expect((await post('/api/pantry/deduct', { recipeId: 's', servings })).status).toBe(400)
})
