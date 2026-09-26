import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import { createApp, createRouter, toWebHandler } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { fileURLToPath } from 'node:url'
import { db } from '../server/db'
import { recipes, recipeMemories } from '../server/db/schema'
import get from '../server/api/recipes/[id]/memories.get'
import post from '../server/api/recipes/[id]/memories.post'
import csrf from '../server/middleware/csrf'
vi.mock('../server/db', async () => { vi.stubEnv('DATABASE_URL', ':memory:'); return vi.importActual('../server/db') })
migrate(db, { migrationsFolder: fileURLToPath(new URL('../server/db/migrations', import.meta.url)) })
const handle = toWebHandler(createApp().use(csrf).use(createRouter().get('/api/recipes/:id/memories', get).post('/api/recipes/:id/memories', post)))
function request(id = 'r', method = 'GET', body?: unknown, origin = 'http://localhost') { return handle(new Request('http://localhost/api/recipes/' + id + '/memories', { method, headers: { Host: 'localhost', Origin: origin, 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })) }
beforeEach(() => { db.delete(recipes).run(); db.insert(recipes).values([{ id: 'r', title: 'Soup', description: '' }, { id: 'other', title: 'Bread', description: '' }]).run() })
afterAll(() => { db.$client.close(); vi.unstubAllEnvs() })
it('round-trips tasting logs and family memories, ordered by cook date and scoped to recipe', async () => {
  expect(await (await request()).json()).toEqual([])
  const response = await request('r', 'POST', { cookDate: 1000, rating: 5, notes: 'Silky', familyMemories: "Yiayia's 80th birthday" })
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ recipeId: 'r', cookDate: 1000, rating: 5, createdAt: expect.any(Number), familyMemories: "Yiayia's 80th birthday" })
  await request('r', 'POST', { cookDate: 2000 })
  const memories = await (await request()).json()
  expect(memories.map((entry: { cookDate: number }) => entry.cookDate)).toEqual([2000, 1000])
  expect(memories[0].rating).toBeNull()
  expect(await (await request('other')).json()).toEqual([])
})
it('validates rating/date bounds and rejects unknown fields, missing recipes and cross-origin writes', async () => {
  for (const body of [{ cookDate: 1, rating: 0 }, { cookDate: 1, rating: 6 }, { cookDate: 1, rating: 2.5 }, { cookDate: -1 }, { cookDate: '2026-01-01' }, { cookDate: 1, recipeId: 'other' }, { cookDate: 1, familyMemories: 'x'.repeat(10001) }]) expect((await request('r', 'POST', body)).status).toBe(400)
  expect((await request('missing')).status).toBe(404)
  expect((await request('missing', 'POST', { cookDate: 1 })).status).toBe(404)
  expect((await request('r', 'POST', { cookDate: 1 }, 'https://evil.example')).status).toBe(403)
})
it('enforces rating checks, parent foreign keys and cascading deletion at database level', async () => {
  expect(() => db.insert(recipeMemories).values({ id: 'bad', recipeId: 'missing', cookDate: 1 }).run()).toThrow()
  expect(() => db.insert(recipeMemories).values({ id: 'bad', recipeId: 'r', cookDate: 1, rating: 7 }).run()).toThrow()
  expect(() => db.insert(recipeMemories).values({ id: 'bad', recipeId: 'r', cookDate: 1, rating: 1.5 }).run()).toThrow()
  await request('r', 'POST', { cookDate: 1 })
  db.delete(recipes).run()
  expect(db.select().from(recipeMemories).all()).toEqual([])
})
