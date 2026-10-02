import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import { createApp, createRouter, toWebHandler } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { db } from '../server/db'
import { cookLogs, ingredients, pantryItems, recipes } from '../server/db/schema'
import deduct from '../server/api/pantry/deduct.post'
import cookLog from '../server/api/recipes/[id]/cook-log.post'
import { idempotent } from '../server/utils/idempotency'

vi.mock('../server/db', async () => { vi.stubEnv('DATABASE_URL', ':memory:'); return vi.importActual('../server/db') })
migrate(db, { migrationsFolder: fileURLToPath(new URL('../server/db/migrations', import.meta.url)) })
const handle = toWebHandler(createApp().use(createRouter().post('/api/pantry/deduct', deduct).post('/api/recipes/:id/cook-log', cookLog)))
const post = (path: string, body: unknown) => handle(new Request('http://localhost' + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
}))
afterAll(() => { db.$client.close(); vi.unstubAllEnvs() })
beforeEach(() => {
  db.delete(cookLogs).run()
  db.delete(pantryItems).run()
  db.delete(recipes).run()
  db.insert(recipes).values({ id: 'bread', title: 'Bread', description: '', servings: 4 }).run()
  db.insert(ingredients).values({ id: 'flour', recipeId: 'bread', name: 'Flour', amount: 200, unit: 'g' }).run()
  db.insert(pantryItems).values({ id: 'stock', name: 'Flour', normalizedName: 'flour', quantity: 1, unit: 'kg', storageLocation: 'pantry' }).run()
})

it('replays identical deduction results across concurrent retries without consuming stock twice', async () => {
  const input = { recipeId: 'bread', requestId: randomUUID() }
  const responses = await Promise.all(Array.from({ length: 3 }, () => post('/api/pantry/deduct', input)))
  const results = await Promise.all(responses.map(response => response.json()))
  expect(responses.map(response => response.status)).toEqual([200, 200, 200])
  expect(results[0].deducted).toEqual([{ name: 'Flour', amount: '200 g' }])
  expect(results).toEqual([results[0], results[0], results[0]])
  expect(db.select().from(pantryItems).get()!.quantity).toBe(0.8)
})

it('shares a finish ID across deduction and journal operations while replaying only one cook log', async () => {
  const requestId = randomUUID()
  expect((await post('/api/pantry/deduct', { recipeId: 'bread', requestId })).status).toBe(200)
  const responses = await Promise.all(Array.from({ length: 3 }, () => post('/api/recipes/bread/cook-log', { requestId, notes: 'Finished', servings: 4 })))
  const results = await Promise.all(responses.map(response => response.json()))
  expect(responses.map(response => response.status)).toEqual([201, 201, 201])
  expect(results).toEqual([results[0], results[0], results[0]])
  expect(results[0]).toMatchObject({ recipeId: 'bread', notes: 'Finished', servings: 4 })
  expect(results[0]).not.toHaveProperty('requestId')
  expect(db.select().from(cookLogs).all()).toHaveLength(1)
  expect(db.select().from(pantryItems).get()!.quantity).toBe(0.8)
})

it('scopes replay keys by recipe', async () => {
  db.insert(recipes).values({ id: 'soup', title: 'Soup', description: '' }).run()
  const requestId = randomUUID()
  const bread = await (await post('/api/recipes/bread/cook-log', { requestId })).json()
  const soup = await (await post('/api/recipes/soup/cook-log', { requestId })).json()
  expect(bread.id).not.toBe(soup.id)
  expect(soup.recipeId).toBe('soup')
  expect(db.select().from(cookLogs).all()).toHaveLength(2)
})

it('does not cache failed operations and supports retry after the recipe becomes available', async () => {
  const requestId = randomUUID()
  expect((await post('/api/recipes/new/cook-log', { requestId })).status).toBe(404)
  db.insert(recipes).values({ id: 'new', title: 'New recipe', description: '' }).run()
  expect((await post('/api/recipes/new/cook-log', { requestId })).status).toBe(201)
  expect(db.select().from(cookLogs).all()).toHaveLength(1)
})

it('keeps requests without IDs independent for compatibility', async () => {
  await post('/api/pantry/deduct', { recipeId: 'bread' })
  await post('/api/pantry/deduct', { recipeId: 'bread' })
  await post('/api/recipes/bread/cook-log', {})
  await post('/api/recipes/bread/cook-log', {})
  expect(db.select().from(pantryItems).get()!.quantity).toBe(0.6)
  expect(db.select().from(cookLogs).all()).toHaveLength(2)
})

it.each(['not-a-uuid', '', 123, null])('rejects invalid request IDs %s before applying any mutation', async requestId => {
  expect((await post('/api/pantry/deduct', { recipeId: 'bread', requestId })).status).toBe(400)
  expect((await post('/api/recipes/bread/cook-log', { requestId })).status).toBe(400)
  expect(db.select().from(pantryItems).get()!.quantity).toBe(1)
  expect(db.select().from(cookLogs).all()).toHaveLength(0)
})

it('expires old replay results after 24 hours', () => {
  const requestId = randomUUID()
  const run = vi.fn(() => ({ count: 1 }))
  const now = Date.now()
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
  try {
    idempotent('expiry-test', requestId, run)
    clock.mockReturnValue(now + 24 * 60 * 60 * 1000 - 1)
    idempotent('expiry-test', requestId, run)
    expect(run).toHaveBeenCalledTimes(1)
    clock.mockReturnValue(now + 24 * 60 * 60 * 1000)
    idempotent('expiry-test', requestId, run)
    expect(run).toHaveBeenCalledTimes(2)
  } finally { clock.mockRestore() }
})

it('bounds replay storage and preserves recently used keys', () => {
  const oldest = randomUUID()
  const recent = randomUUID()
  const run = vi.fn(() => ({ count: 1 }))
  idempotent('capacity-test', oldest, run)
  idempotent('capacity-test', recent, run)
  for (let i = 0; i < 998; i++) idempotent('capacity-test', randomUUID(), () => i)
  idempotent('capacity-test', recent, run)
  idempotent('capacity-test', randomUUID(), () => 'overflow')
  idempotent('capacity-test', recent, run)
  expect(run).toHaveBeenCalledTimes(2)
  idempotent('capacity-test', oldest, run)
  expect(run).toHaveBeenCalledTimes(3)
})
