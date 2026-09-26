import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import { createApp, createRouter, toWebHandler } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { fileURLToPath } from 'node:url'
import { db } from '../server/db'
import { guests, recipes, ingredients } from '../server/db/schema'
import list from '../server/api/guests/index.get'
import save from '../server/api/guests/index.post'
import remove from '../server/api/guests/[id].delete'
import audit from '../server/api/meal-plan/dietary-audit.post'
import csrf from '../server/middleware/csrf'
import { auditDietary, ingredientAllergens, type GuestProfile } from '../shared/culinary/dietary'
vi.mock('../server/db', async () => { vi.stubEnv('DATABASE_URL', ':memory:'); return vi.importActual('../server/db') })
migrate(db, { migrationsFolder: fileURLToPath(new URL('../server/db/migrations', import.meta.url)) })
const handle = toWebHandler(createApp().use(csrf).use(createRouter().get('/api/guests', list).post('/api/guests', save).delete('/api/guests/:id', remove).post('/api/meal-plan/dietary-audit', audit)))
function request(path: string, method = 'GET', body?: unknown, origin = 'http://localhost') { return handle(new Request('http://localhost' + path, { method, headers: { Host: 'localhost', Origin: origin, 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })) }
beforeEach(() => { db.delete(guests).run(); db.delete(recipes).run() })
afterAll(() => { db.$client.close(); vi.unstubAllEnvs() })
const guest = (partial: Partial<GuestProfile> = {}): GuestProfile => ({ name: 'Alex', allergies: [], dietaryRestrictions: [], dislikes: [], ...partial })
function screen(names: string[], people: GuestProfile[]) { return auditDietary([{ id: 'recipe', title: 'Dinner', ingredients: names.map(name => ({ name })) }], people) }
it('creates, updates, lists and deletes validated profiles with JSON storage and stable creation time', async () => {
  const response = await request('/api/guests', 'POST', { name: 'Alex', allergies: ['NUTS', 'nuts'], dislikes: ['okra'], notes: 'Check labels' })
  expect(response.status).toBe(200)
  const created = await response.json()
  expect(created).toMatchObject({ allergies: ['nuts'], dietaryRestrictions: [], createdAt: expect.any(Number), updatedAt: expect.any(Number) })
  expect(db.select().from(guests).get()?.allergies).toBe('["nuts"]')
  db.$client.prepare('UPDATE guests SET updated_at = 0').run()
  const updated = await (await request('/api/guests', 'POST', { id: created.id, name: 'Alexandra', allergies: ['dairy'], dietaryRestrictions: ['vegetarian'] })).json()
  expect(updated.createdAt).toBe(created.createdAt); expect(updated.updatedAt).toBeGreaterThan(0)
  expect(updated.dislikes).toEqual([])
  expect((await (await request('/api/guests')).json())[0].name).toBe('Alexandra')
  expect((await request('/api/guests/' + created.id, 'DELETE')).status).toBe(200)
  expect((await request('/api/guests/' + created.id, 'DELETE')).status).toBe(404)
  expect((await request('/api/guests', 'POST', { id: 'unknown', name: 'X' })).status).toBe(404)
})
it('rejects invalid profiles and cross-origin mutations', async () => {
  for (const body of [{ name: '' }, { name: 'X', allergies: 'nuts' }, { name: 'X', dislikes: [4] }, { name: 'X', createdAt: 0 }, { name: 'X', allergies: Array(31).fill('nuts') }]) expect((await request('/api/guests', 'POST', body)).status).toBe(400)
  expect((await request('/api/guests', 'POST', { name: 'X' }, 'https://evil.example')).status).toBe(403)
})
it.each([
  ['almond flour', ['nuts']], ['peanut butter', ['nuts']], ['coconut milk', []], ['eggplant', []], ['nutmeg', []], ['butternut squash', []], ['rice flour', []], ['milk chocolate', ['dairy']], ['soy milk', ['soy']], ['tofu', ['soy']], ['prawn', ['shellfish']], ['soy sauce', ['gluten', 'soy']], ['ΑΜΥΓΔΑΛΑ', ['nuts']], ['Γάλα', ['dairy']], ['αυγά', ['eggs']], ['ΓΑΡΙΔΕΣ', ['shellfish']], ['ταχίνι', ['sesame']], ['yolks', ['eggs']], ['ricotta', ['dairy']], ['shrimps', ['shellfish']], ['κασιους', ['nuts']]
])('screens whole ingredients: %s', (name, expected) => expect(ingredientAllergens(name as string)).toEqual(expected))
it('does not suppress real dairy alongside a plant compound', () => expect(ingredientAllergens('peanut butter with milk')).toEqual(['dairy', 'nuts']))
it('flags critical allergens before preferences, includes cross-contact and avoids incompatible substitutes', () => {
  const result = screen(['milk', 'cilantro', 'walnuts'], [guest({ allergies: ['dairy', 'nuts'], dislikes: ['cilantro'] }), guest({ allergies: ['sunflower seeds'], dietaryRestrictions: ['vegan'] })])
  expect(result.conflicts[0]?.type).toBe('critical_allergen')
  const milk = result.conflicts.find(item => item.restriction === 'dairy')!
  expect(milk.crossContaminationWarning).toContain('shared utensils')
  expect(milk.substitutions.join(' ')).not.toContain('almond')
  expect(result.conflicts.find(item => item.restriction === 'nuts')?.substitutions).toEqual([])
  expect(result.conflicts.some(item => item.type === 'dislike_warning')).toBe(true)
  expect(result.reviewWarnings.join(' ')).toContain('sunflower seeds')
  expect(result.notice).toContain('not a safety clearance')
})
it.each([
  ['vegan', 'honey'], ['vegan', 'eggs'], ['vegetarian', 'chicken stock'], ['vegetarian', 'gelatin'],
  ['halal', 'bacon'], ['halal', 'wine'], ['halal', 'chicken'], ['kosher', 'shrimp'], ['kosher', 'cheese'],
  ['pregnant', 'unpasteurized cheese'], ['pregnant', 'raw eggs'], ['pregnant', 'wine'], ['pregnant', 'raw salmon']
])('flags %s for %s', (restriction, ingredient) => expect(screen([ingredient], [guest({ dietaryRestrictions: [restriction] })]).conflicts.some(item => item.type === 'dietary_conflict')).toBe(true))
it('accepts plain produce without certifying safety and warns on missing recipe ingredients', () => {
  expect(screen(['okra', 'olive oil'], [guest({ allergies: ['nuts'], dietaryRestrictions: ['vegan'] })]).conflicts).toEqual([])
  expect(screen([], [guest()]).reviewWarnings).toHaveLength(1)
})
it('treats custom allergy names as data, including inherited object property names', () => {
  const result = screen(['constructor'], [guest({ allergies: ['constructor'] })])
  expect(result.conflicts[0]?.type).toBe('critical_allergen')
  expect(result.reviewWarnings).toHaveLength(1)
})
it('audits saved guest IDs and inline profiles and rejects missing selections', async () => {
  db.insert(recipes).values({ id: 'r', title: 'Cake', description: '' }).run()
  db.insert(ingredients).values({ id: 'i', recipeId: 'r', name: 'milk', amount: 1, unit: 'cup' }).run()
  const saved = await (await request('/api/guests', 'POST', { name: 'X', allergies: ['dairy'] })).json()
  const response = await request('/api/meal-plan/dietary-audit', 'POST', { recipeIds: ['r'], guestIds: [saved.id], guests: [guest({ dietaryRestrictions: ['vegan'] })] })
  expect(response.status).toBe(200); expect((await response.json()).conflicts).toHaveLength(2)
  for (const body of [{ recipeIds: [], guestIds: [saved.id] }, { recipeIds: ['r'], guests: [] }]) expect((await request('/api/meal-plan/dietary-audit', 'POST', body)).status).toBe(400)
  expect((await request('/api/meal-plan/dietary-audit', 'POST', { recipeIds: ['unknown'], guestIds: [saved.id] })).status).toBe(404)
  expect((await request('/api/meal-plan/dietary-audit', 'POST', { recipeIds: ['r'], guestIds: ['missing'] })).status).toBe(404)
})
it('surfaces unreadable legacy restrictions instead of silently clearing a guest', async () => {
  db.insert(guests).values({ id: 'legacy', name: 'Legacy', allergies: 'broken json', dietaryRestrictions: '["unknown"]' }).run()
  db.insert(recipes).values({ id: 'r', title: 'Rice', description: '' }).run()
  const profiles = await (await request('/api/guests')).json()
  expect(profiles[0].profileWarnings[0]).toContain('could not be read')
  const result = await (await request('/api/meal-plan/dietary-audit', 'POST', { recipeIds: ['r'], guestIds: ['legacy'] })).json()
  expect(result.reviewWarnings.join(' ')).toContain('Repair the profile')
})
