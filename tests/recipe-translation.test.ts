import { afterEach, expect, it, vi } from 'vitest'
import { createApp, toWebHandler } from 'h3'
import handler from '../server/api/ai/recipe/translate.post'
import csrf from '../server/middleware/csrf'
import { enforceInvariants, translationLanguages } from '../server/utils/ai/translate'
import { recipeCreateSchema } from '../server/utils/validation'
import { toRecipeInput } from '../app/utils/recipe-input'
import type { RecipeDetail } from '../shared/types/recipe'
import { readTranslateLang, writeTranslateLang, translationLanguageOptions } from '../app/utils/translation-prefs'

afterEach(() => vi.unstubAllGlobals())
const headers = { Host: 'localhost', Origin: 'http://localhost', 'Content-Type': 'application/json' }
const credentials = { 'x-byok-provider': 'openai', 'x-byok-key': 'secret-test', 'x-byok-model': 'test' }
const source = recipeCreateSchema.parse({
  title: 'Lemon Chicken', description: 'Family chicken', cuisine: null,
  servings: 4, prepTimeMinutes: 15, cookTimeMinutes: 45, totalTimeMinutes: 60,
  recipeType: 'food', difficulty: 'easy', originalSaltType: 'table_salt', rating: 4, isFavorite: true,
  sourceUrl: null, sourceType: 'manual', imageUrl: null,
  ingredients: [{ name: 'chicken thighs', amount: 1.5, unit: 'kg', gramsEquivalent: 1500, sortOrder: 0 }, { name: 'lemon', amount: 2, unit: 'whole', sortOrder: 1 }],
  steps: [{ stepNumber: 1, instruction: 'Roast 20 minutes at 180°C.', durationMinutes: 20, timerRequired: true, heatLevel: 'medium', internalTempTargetC: 74, sortOrder: 0 }, { stepNumber: 2, instruction: 'Serve.', sortOrder: 1 }],
  equipment: [{ name: 'Oven', isEssential: true }]
})
function translated() {
  const reply = structuredClone(source)
  reply.title = 'Κοτόπουλο λεμονάτο'
  reply.steps![0]!.instruction = 'Ψήστε 20 λεπτά στους 180°C.'
  return reply
}
function providerReply(value: unknown) { return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] })) }
function request(body: unknown = { recipe: source }, extra: Record<string, string> = credentials) {
  return toWebHandler(createApp().use(csrf).use(handler))(new Request('http://localhost/api/ai/recipe/translate', { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) }))
}
it('supports exactly eight languages with Greek first', () => {
  expect(translationLanguages.map(language => language.code)).toEqual(['el', 'en', 'es', 'fr', 'it', 'de', 'pt', 'tr'])
  expect(translationLanguages[0].label).toBe('Ελληνικά')
})
it('translates Greek text while restoring all numeric and structural fields', async () => {
  const reply = translated()
  Object.assign(reply, { servings: 9, prepTimeMinutes: 1, cookTimeMinutes: 2, totalTimeMinutes: 3, difficulty: 'master', recipeType: 'drink', originalSaltType: null, rating: 1, isFavorite: false, sourceUrl: 'https://example.com', sourceType: 'url', imageUrl: 'https://example.com/a.png' })
  Object.assign(reply.ingredients![0]!, { amount: 3, gramsEquivalent: 3, sortOrder: 9 })
  Object.assign(reply.steps![0]!, { stepNumber: 3, durationMinutes: 25, timerRequired: false, heatLevel: 'high', internalTempTargetC: 90, sortOrder: 9 })
  reply.equipment![0]!.isEssential = false
  const fetchSpy = vi.fn(async (_url: unknown, _init: RequestInit) => providerReply(reply))
  vi.stubGlobal('fetch', fetchSpy)
  const response = await request({ recipe: source, targetLanguage: 'el' })
  expect(response.status).toBe(200)
  const data = await response.json()
  expect(recipeCreateSchema.safeParse(data.recipe).success).toBe(true)
  expect(data.recipe).toEqual(translated())
  expect(data.recipe.title).toMatch(/[Α-Ω]/)
  expect(data.mode).toBe('live')
  expect(fetchSpy.mock.calls[0]![1].body).toContain('Greek')
})
it('defaults to Greek', async () => {
  const fetchSpy = vi.fn(async (_url: unknown, _init: RequestInit) => providerReply(translated()))
  vi.stubGlobal('fetch', fetchSpy)
  expect((await request()).status).toBe(200)
  expect(fetchSpy.mock.calls[0]![1].body).toContain('Greek')
})
it.each(['steps', 'ingredients', 'equipment'] as const)('rejects changed %s lengths', async field => {
  const reply = translated()
  reply[field]!.pop()
  vi.stubGlobal('fetch', vi.fn(async () => providerReply(reply)))
  const response = await request()
  expect(response.status).toBe(502)
  expect(await response.text()).toContain('changed the recipe structure')
})
it('warns when prose numbers change and preserves numeric fields', async () => {
  const reply = translated()
  reply.steps![0]!.instruction = 'Ψήστε 25 λεπτά στους 180°C.'
  reply.steps![0]!.durationMinutes = 25
  vi.stubGlobal('fetch', vi.fn(async () => providerReply(reply)))
  const response = await request()
  expect(response.status).toBe(200)
  const data = await response.json()
  expect(data.warnings).toHaveLength(1)
  expect(data.warnings[0]).toMatch(/step 1/i)
  expect(data.recipe.steps[0].durationMinutes).toBe(20)
})
it.each([
  [{}, 'Add an AI key'],
  [{ ...credentials, 'x-byok-provider': 'gemini' }, 'Gemini'],
  [{ ...credentials, 'x-byok-model': '' }, 'Choose an AI model']
] as const)('rejects unavailable AI settings without fetch: %j', async (settings, message) => {
  const fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  const response = await request({ recipe: source }, settings)
  expect(response.status).toBe(400)
  expect(await response.text()).toContain(message)
  expect(fetchSpy).not.toHaveBeenCalled()
})
it('rejects unsupported languages, missing recipes and foreign origins', async () => {
  vi.stubGlobal('fetch', vi.fn())
  expect((await request({ recipe: source, targetLanguage: 'xx' })).status).toBe(400)
  expect((await request({})).status).toBe(400)
  expect((await request({ recipe: source }, { ...credentials, Origin: 'https://evil.test' })).status).toBe(403)
  expect(fetch).not.toHaveBeenCalled()
})
it('propagates humanized provider authentication errors without secrets', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'secret-test' } }), { status: 401 })))
  const response = await request()
  expect(response.status).toBe(424)
  const body = await response.text()
  expect(body).toContain('API key was rejected')
  expect(body).not.toContain('secret-test')
})
it('preserves null and absent fields', () => {
  const { equipment, ...withoutEquipment } = source
  const reply = { ...withoutEquipment, cuisine: 'Ελληνική' }
  const { recipe } = enforceInvariants(withoutEquipment, reply)
  expect(recipe.cuisine).toBeNull()
  expect(recipe).not.toHaveProperty('equipment')
})
it('strips database and lineage metadata before strict recipe validation', () => {
  const detail = {
    ...source, id: 'source', createdAt: null, updatedAt: null, parentRecipeId: 'parent', variationName: 'Family',
    parent: { id: 'parent', title: 'Parent' }, variations: [],
    ingredients: source.ingredients!.map(item => ({ ...item, id: 'ingredient', recipeId: 'source' })),
    steps: source.steps!.map(item => ({ ...item, id: 'step', recipeId: 'source' })),
    equipment: source.equipment!.map(item => ({ ...item, id: 'equipment', recipeId: 'source' }))
  } as RecipeDetail
  const input = toRecipeInput(detail)
  expect(recipeCreateSchema.safeParse(input).success).toBe(true)
  expect(input).not.toHaveProperty('id')
  expect(input).not.toHaveProperty('parent')
  expect(input.ingredients![0]).not.toHaveProperty('recipeId')
  expect(input.sourceUrl).toBeNull()
  expect(input.imageUrl).toBeNull()
})
it('falls back to source text for blank translations without filling empty source fields', () => {
  const original = { ...source, description: '', heirloomNotes: null }
  const reply = translated()
  reply.title = '   '
  reply.description = 'Invented description'
  reply.heirloomNotes = 'Invented notes'
  reply.ingredients![0]!.name = ''
  const result = enforceInvariants(original, reply).recipe
  expect(result.title).toBe(source.title)
  expect(result.description).toBe('')
  expect(result.heirloomNotes).toBeNull()
  expect(result.ingredients![0]!.name).toBe(source.ingredients![0]!.name)
})
it('keeps client language choices aligned and tolerates unavailable or invalid storage', () => {
  expect(translationLanguageOptions).toEqual(translationLanguages.map(({ code, label }) => ({ code, label })))
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } })
  expect(readTranslateLang()).toBe('el')
  expect(() => writeTranslateLang('fr')).not.toThrow()
  const setItem = vi.fn()
  vi.stubGlobal('localStorage', { getItem: () => 'xx', setItem })
  expect(readTranslateLang()).toBe('el')
  writeTranslateLang('xx')
  expect(setItem).not.toHaveBeenCalled()
  writeTranslateLang('fr')
  expect(setItem).toHaveBeenCalledWith('heirloom.translate.lang.v1', 'fr')
})
