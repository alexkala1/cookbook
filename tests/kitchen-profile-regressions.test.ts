import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import { createApp, createRouter, toWebHandler } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { fileURLToPath } from 'node:url'
import { db } from '../server/db'
import { userKitchenProfile } from '../server/db/schema'
import get from '../server/api/settings/kitchen.get'
import put from '../server/api/settings/kitchen.put'
vi.mock('../server/db', async () => { vi.stubEnv('DATABASE_URL', ':memory:'); return vi.importActual('../server/db') })
migrate(db, { migrationsFolder: fileURLToPath(new URL('../server/db/migrations', import.meta.url)) })
const handle = toWebHandler(createApp().use(createRouter().get('/kitchen', get).put('/kitchen', put)))
const request = (method = 'GET', body?: unknown) => handle(new Request('http://localhost/kitchen', { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }))
beforeEach(() => db.delete(userKitchenProfile).run())
afterAll(() => { db.$client.close(); vi.unstubAllEnvs() })
it('adopts a legacy profile instead of replacing its hardware and salt settings with defaults', async () => {
  db.insert(userKitchenProfile).values({ id: 'old', stoveType: 'induction', ovenType: 'static_conventional', preferredSaltType: 'morton_kosher' }).run()
  expect(await (await request()).json()).toMatchObject({ id: 'default', stoveType: 'induction', ovenType: 'static_conventional', preferredSaltType: 'morton_kosher' })
  expect(db.select().from(userKitchenProfile).all()).toHaveLength(1)
})
it('preserves legacy values when the first request is a partial update', async () => {
  db.insert(userKitchenProfile).values({ id: 'old', stoveType: 'induction', preferredSaltType: 'morton_kosher' }).run()
  expect(await (await request('PUT', { hasAirFryer: true })).json()).toMatchObject({ id: 'default', stoveType: 'induction', preferredSaltType: 'morton_kosher', hasAirFryer: true })
})
it('keeps the canonical profile authoritative and does not erase other legacy records', async () => {
  db.insert(userKitchenProfile).values([{ id: 'old', stoveType: 'induction' }, { id: 'default', stoveType: 'electric_radiant' }]).run()
  expect(await (await request()).json()).toMatchObject({ stoveType: 'electric_radiant' })
  expect(db.select().from(userKitchenProfile).all()).toHaveLength(2)
})
it('reports ambiguous legacy profiles rather than silently selecting someone’s settings', async () => {
  db.insert(userKitchenProfile).values([{ id: 'first', stoveType: 'induction' }, { id: 'second', stoveType: 'gas' }]).run()
  expect((await request()).status).toBe(409)
  expect(db.select().from(userKitchenProfile).all().map(row => row.id)).toEqual(['first', 'second'])
})
