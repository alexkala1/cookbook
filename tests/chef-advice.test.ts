import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import { createApp, createRouter, toWebHandler } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { fileURLToPath } from 'node:url'
import { db } from '../server/db'
import { pantryItems, recipes, ingredients } from '../server/db/schema'
import advice from '../server/api/pantry/chef-advice.post'
import { chefAdvice } from '../shared/culinary/chef-advice'
import type { PantryItem, PantryMatch } from '../shared/culinary/pantry'

vi.mock('../server/db', async () => { vi.stubEnv('DATABASE_URL', ':memory:'); return vi.importActual('../server/db') })
migrate(db, { migrationsFolder: fileURLToPath(new URL('../server/db/migrations', import.meta.url)) })
const handle = toWebHandler(createApp().use(createRouter().post('/advice', advice)))
const post = (headers: Record<string, string> = {}) => handle(new Request('http://localhost/advice', { method: 'POST', headers: { Host: 'localhost', ...headers } }))
const DAY = 86400000
beforeEach(() => { db.delete(pantryItems).run(); db.delete(recipes).run(); vi.unstubAllGlobals() })
afterAll(() => { db.$client.close(); vi.unstubAllEnvs() })

function seed() {
  const now = Date.now()
  db.insert(recipes).values([{ id: 'omelette', title: 'Omelette', description: '' }, { id: 'cake', title: 'Lemon cake', description: '' }, { id: 'far', title: 'Feast', description: '' }]).run()
  db.insert(ingredients).values([
    { id: '1', recipeId: 'omelette', name: 'Eggs', amount: 2, unit: 'item' },
    { id: '2', recipeId: 'cake', name: 'Flour', amount: 200, unit: 'g' },
    { id: '3', recipeId: 'cake', name: 'Butter', amount: 100, unit: 'g' },
    { id: '4', recipeId: 'far', name: 'Saffron', amount: 1, unit: 'g' }, { id: '5', recipeId: 'far', name: 'Lamb', amount: 1, unit: 'kg' }
  ]).run()
  db.insert(pantryItems).values([
    { id: 'p1', name: 'Eggs', normalizedName: 'eggs', quantity: 6, unit: 'item', storageLocation: 'fridge', expiresAt: now + 2 * DAY, createdAt: now, updatedAt: now },
    { id: 'p2', name: 'Flour', normalizedName: 'flour', quantity: 1, unit: 'kg', storageLocation: 'pantry', expiresAt: null, createdAt: now, updatedAt: now },
    { id: 'p3', name: 'Spinach', normalizedName: 'spinach', quantity: 1, unit: 'item', storageLocation: 'fridge', expiresAt: now + DAY, createdAt: now, updatedAt: now },
    { id: 'p4', name: 'Old milk', normalizedName: 'old milk', quantity: 1, unit: 'l', storageLocation: 'fridge', expiresAt: now - DAY, createdAt: now, updatedAt: now }
  ]).run()
}

it('offline: ready matches, swaps for near-matches and use-it-up tips', async () => {
  seed()
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
  const response = await post()
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body.mode).toBe('fallback')
  expect(body.ready).toEqual([expect.objectContaining({ id: 'omelette' })])
  expect(body.swaps).toHaveLength(1)
  expect(body.swaps[0]).toMatchObject({ recipeId: 'cake', missing: 'Butter' })
  expect(body.swaps[0].options.map((o: { name: string }) => o.name)).toContain('Olive oil')
  expect(body.useItUp.map((u: { item: string }) => u.item)).toEqual(['Spinach', 'Eggs'])
  expect(body.useItUp[1].tip).toContain('Omelette')
  expect(body.useItUp[0].tip).toMatch(/Cook it tonight/)
  expect(fetchMock).not.toHaveBeenCalled()
})

it('returns empty advice for an empty cookbook and pantry', async () => {
  expect(await (await post()).json()).toEqual({ ready: [], swaps: [], useItUp: [], mode: 'fallback' })
})

it('live: model may reword known items only; unknown ids are ignored and failures fall back', async () => {
  seed()
  const reply = (content: object) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }))
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({
    swaps: [{ recipeId: 'cake', options: [{ name: 'Coconut oil', ratio: '1:1', adjustment: 'Chill first.' }] }, { recipeId: 'ghost', options: [{ name: 'x', ratio: 'x', adjustment: 'x' }] }],
    useItUp: [{ itemId: 'p3', tip: 'Wilt it into eggs.' }, { itemId: 'ghost', tip: 'nope' }]
  })))
  const headers = { 'x-byok-provider': 'openai', 'x-byok-key': 'k', 'x-byok-model': 'm' }
  const body = await (await post(headers)).json()
  expect(body.mode).toBe('live')
  expect(body.swaps[0].options[0].name).toBe('Coconut oil')
  expect(body.useItUp.find((u: { itemId: string }) => u.itemId === 'p3').tip).toBe('Wilt it into eggs.')
  expect(body.useItUp).toHaveLength(2)

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })))
  const failed = await (await post(headers)).json()
  expect(failed.mode).toBe('fallback')
  expect(failed.swaps[0].options[0].name).toBe('Olive oil')
})

it('pure: skips expired and far-off items, and uses a storage tip when no recipe fits', () => {
  const item = (over: Partial<PantryItem>) => ({ id: 'i', name: 'Thing', normalizedName: 'thing', quantity: 1, unit: 'item', storageLocation: 'pantry', expiresAt: null, createdAt: 0, updatedAt: 0, ...over }) as PantryItem
  const now = 1_000_000_000
  const result = chefAdvice([] as PantryMatch[], [item({ id: 'a', expiresAt: now - 1 }), item({ id: 'b', expiresAt: now + 10 * DAY }), item({ id: 'c', expiresAt: now + 3600_000 })], () => [], now)
  expect(result.useItUp).toEqual([expect.objectContaining({ itemId: 'c', daysLeft: 1, recipeIds: [] })])
  expect(result.useItUp[0]!.tip).toContain('Build a simple meal')
})
