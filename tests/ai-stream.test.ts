import { afterEach, expect, it, vi } from 'vitest'
import { createApp, defineEventHandler, toWebHandler } from 'h3'
import stream from '../server/api/ai/recipe/stream.post'
import translate from '../server/api/ai/recipe/translate.post'
import { ingest } from '../server/utils/ai/ingest'
import * as sourceFetch from '../server/utils/ai/safe-fetch'
import csrf from '../server/middleware/csrf'
import { aiClient, estimateTokens, humanizeProviderError } from '../server/utils/ai/client'
import { recipeCreateSchema } from '../server/utils/validation'
import { readRecipeStream } from '../app/utils/sse'
import { repairTruncatedJson, sanitizeAiDraft } from '../server/utils/ai/sanitize-draft'
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
const headers = { Host: 'localhost', Origin: 'http://localhost', 'Content-Type': 'application/json' }
it('cleans common recipe deviations without mutating source or weakening the API schema', () => {
  const raw = {
    title: ' Soup ', description: ' Warm ', difficulty: 'medium', recipeType: 'dinner', tags: ['soup'], author: 'Chef', prepTime: 10,
    servings: '4 servings', prepTimeMinutes: '10.5 min', cookTimeMinutes: -3, totalTimeMinutes: '30 minutes', sourceUrl: 'javascript:alert(1)',
    ingredients: [{ name: ' salt ', amount: 'to taste', unit: null, extra: true }, { amount: '2.5 cups', unit: ' cup ', gramsEquivalent: '250', notes: ' note ' }],
    steps: [{ stepNumber: 9, instruction: ' Simmer. ', heatLevel: 'med-high', durationMinutes: '20 min', timerRequired: true, scienceWhy: ' Gelatin softens. ', extra: true }],
    equipment: [{ name: ' pot ', isEssential: true, substituteTool: ' pan ', extra: true }]
  }
  expect(recipeCreateSchema.safeParse(raw).success).toBe(false)
  const cleaned = recipeCreateSchema.parse(sanitizeAiDraft(raw))
  expect(cleaned).toMatchObject({ title: 'Soup', recipeType: 'food', difficulty: 'intermediate', servings: 4, prepTimeMinutes: 10, cookTimeMinutes: 0, totalTimeMinutes: 30, sourceUrl: null,
    ingredients: [{ name: 'salt', amount: 0, unit: 'item', sortOrder: 1 }, { name: 'Ingredient', amount: 2.5, unit: 'cup', gramsEquivalent: 250, sortOrder: 2 }],
    steps: [{ stepNumber: 1, instruction: 'Simmer.', heatLevel: 'medium-high', durationMinutes: 20 }], equipment: [{ name: 'pot', substituteTool: 'pan' }] })
  expect(cleaned).not.toHaveProperty('author')
  expect(cleaned).not.toHaveProperty('tags')
  expect(raw.steps[0]!.stepNumber).toBe(9)
  expect(raw.ingredients[0]).toHaveProperty('extra')
})
it('handles heat aliases, invalid values and non-object input', () => {
  for (const value of [null, 42, 'bad', []]) expect(sanitizeAiDraft(value)).toBe(value)
  const cleaned = recipeCreateSchema.parse(sanitizeAiDraft({ ...recipe, difficulty: 'expert', recipeType: 'baking', servings: 0,
    ingredients: [{ name: '', amount: -1, unit: '' }],
    steps: ['med', 'moderate', 'med-high', 'medium high', 'med-low', 'medium low', 'invalid'].map(heatLevel => ({ instruction: 'Stir.', heatLevel })) }))
  expect(cleaned.difficulty).toBe('advanced')
  expect(cleaned.servings).toBe(1)
  expect(cleaned.steps!.map(step => step.heatLevel)).toEqual(['medium', 'medium', 'medium-high', 'medium-high', 'medium-low', 'medium-low', undefined])
  expect(cleaned.ingredients![0]).toMatchObject({ name: 'Ingredient', amount: 0, unit: 'item' })
})
it('accepts a fixable AI draft after strict parsing fails', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => success(JSON.stringify({ ...recipe, difficulty: 'moderate', recipeType: 'dinner', author: 'Chef', ingredients: [{ name: 'salt', amount: 'to taste' }] }))))
  const response = await request()
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ difficulty: 'intermediate', recipeType: 'food', ingredients: [{ amount: 0, unit: 'item' }] })
})
it('shrinks the Groq completion budget and rejects prompts too large for the minimum budget', async () => {
  const fetchSpy = vi.fn(async () => success())
  vi.stubGlobal('fetch', fetchSpy)
  expect((await request()).status).toBe(200)
  const first = JSON.parse((fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
  const source = 'x'.repeat(Math.floor(6000 * 3.2 - first.messages[0].content.length))
  expect((await request('groq', undefined, source)).status).toBe(200)
  const second = JSON.parse((fetchSpy.mock.calls[1] as unknown as [string, RequestInit])[1].body as string)
  expect(second.max_tokens).toBe(1500)
  const rejected = await request('groq', undefined, 'x'.repeat(30000))
  expect(rejected.status).toBe(413)
  expect((await rejected.json()).statusMessage).toContain('shortening the notes')
  expect(fetchSpy).toHaveBeenCalledTimes(2)
})
it('humanizes token-limit errors without exposing organization details', () => {
  expect(humanizeProviderError('groq', 413, 'Request too large for organization private-id', 'test')).toContain('Try importing a smaller section')
  expect(humanizeProviderError('groq', 400, 'reduce your message size', 'test')).not.toContain('private-id')
})
it('compacts and caps ingest notes at 8,000 characters with a full Groq generation budget', async () => {
  const fetchSpy = vi.fn(async () => success())
  vi.stubGlobal('fetch', fetchSpy)
  const handle = toWebHandler(createApp().use(stream))
  const response = await handle(new Request('http://localhost', { method: 'POST', headers: { ...headers, 'x-byok-key': 'test', 'x-byok-model': 'test', 'x-byok-provider': 'groq' }, body: JSON.stringify({ kind: 'prompt', prompt: 'Soup  notes\n\n' + 'x'.repeat(19000) }) }))
  let completion: { warnings: string[] } | undefined
  await readRecipeStream(response, (event, data) => { if (event === 'complete') completion = data as typeof completion })
  expect(completion!.warnings).toContain('Source notes were trimmed to fit Groq free-tier limits. Review final steps.')
  const sent = JSON.parse((fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
  expect(sent.messages[1].content).toHaveLength(8000)
  expect(sent.max_tokens).toBe(2048)
  expect(sent.messages[0].content).toContain('science and cues are enriched automatically')
  expect(sent.messages[1].content).toMatch(/^Soup notes x/)
  expect(sent.messages[1].content).not.toMatch(/\s{2,}/)
})
it('estimates Greek tokens conservatively and keeps requested Groq tokens within 7,500', async () => {
  expect(estimateTokens('x'.repeat(32))).toBe(10)
  expect(estimateTokens('α'.repeat(15))).toBe(10)
  expect(estimateTokens('x'.repeat(32) + 'α'.repeat(15))).toBe(20)
  const fetchSpy = vi.fn(async () => success())
  vi.stubGlobal('fetch', fetchSpy)
  expect((await request()).status).toBe(200)
  const first = JSON.parse((fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
  const source = 'α'.repeat(Math.floor((6000 - estimateTokens(first.messages[0].content)) * 1.5))
  expect((await request('groq', undefined, source)).status).toBe(200)
  const second = JSON.parse((fetchSpy.mock.calls[1] as unknown as [string, RequestInit])[1].body as string)
  expect(estimateTokens(second.messages[0].content + source) + second.max_tokens).toBeLessThanOrEqual(7500)
  expect(second.max_tokens).toBeLessThan(2048)
  expect((await request('groq', undefined, 'α'.repeat(8000))).status).toBe(413)
  expect(fetchSpy).toHaveBeenCalledTimes(2)
})
it.each(['openai', 'anthropic', 'gemini', 'ollama'])('caps source characters for %s', async provider => {
  const content = JSON.stringify(recipe)
  const payload = provider === 'anthropic' ? { content: [{ type: 'text', text: content }] }
    : provider === 'gemini' ? { candidates: [{ content: { parts: [{ text: content }] } }] }
      : provider === 'ollama' ? { message: { content } } : { choices: [{ message: { content } }] }
  const fetchSpy = vi.fn(async () => new Response(JSON.stringify(payload)))
  vi.stubGlobal('fetch', fetchSpy)
  const response = await toWebHandler(createApp().use(stream))(new Request('http://localhost', { method: 'POST', headers: { ...headers, 'x-byok-key': 'test', 'x-byok-model': 'test', 'x-byok-provider': provider }, body: JSON.stringify({ kind: 'ocr', text: 'x'.repeat(29000) }) }))
  let completion: { warnings: string[] } | undefined
  await readRecipeStream(response, (event, data) => { if (event === 'complete') completion = data as typeof completion })
  const sent = JSON.parse((fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
  const source = provider === 'anthropic' ? sent.messages[0].content : provider === 'gemini' ? sent.contents[0].parts[0].text : sent.messages[1].content
  expect(source).toHaveLength(provider === 'ollama' ? 12000 : 25000)
  if (provider === 'ollama') {
    expect(completion!.warnings).toContain('Source notes were trimmed to fit Ollama context limits. Review final steps.')
    expect(sent.options).toEqual({ num_ctx: 16384, num_predict: 4096 })
  }
  expect(completion!.warnings.join()).not.toContain('Groq free-tier')
})
it('surfaces a warning when ingestion salvages a truncated draft', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '{"title":"Soup","description":"Warm","steps":[{"instruction":"Simmer."}' } }] }))))
  const response = await toWebHandler(createApp().use(stream))(new Request('http://localhost', { method: 'POST', headers: { ...headers, 'x-byok-key': 'test', 'x-byok-model': 'test' }, body: JSON.stringify({ kind: 'prompt', prompt: 'Make a soup recipe' }) }))
  let completion: { warnings: string[], recipe: unknown } | undefined
  await readRecipeStream(response, (event, data) => { if (event === 'complete') completion = data as typeof completion })
  expect(completion!.warnings).toContain("The draft was cut off by the model's response limit. Review and complete the remaining steps.")
  expect(recipeCreateSchema.safeParse(completion!.recipe).success).toBe(true)
})
const recipe = { title: 'Soup', description: 'Warm' }
const failure = (status = 400, message = 'Failed to generate JSON', code?: string) => new Response(JSON.stringify({ error: { message, code } }), { status })
const success = (content = '```json\n' + JSON.stringify(recipe) + '\n```') => new Response(JSON.stringify({ choices: [{ message: { content } }] }))
function request(provider = 'groq', signal?: AbortSignal, source = 'Soup notes') {
  const handle = toWebHandler(createApp().use(defineEventHandler(event => aiClient(event).generate(recipeCreateSchema, 'Make soup', source, () => recipe, signal))))
  return handle(new Request('http://localhost/', { headers: { 'x-byok-key': 'test-key', 'x-byok-model': 'test-model', 'x-byok-provider': provider } }))
}

const liveHeaders = { ...headers, 'x-byok-key': 'test', 'x-byok-model': 'test' }
function ingestRequest(input: unknown, provider = 'openai', signal?: AbortSignal) {
  return toWebHandler(createApp().use(defineEventHandler(event => ingest(event, input, signal))))(
    new Request('http://localhost', { headers: { ...liveHeaders, 'x-byok-provider': provider } })
  )
}
function chapterFixture(count: number) {
  const description = Array.from({ length: count }, (_, i) => `00:${String(i).padStart(2, '0')} Soup ${i + 1}\nIngredients for soup ${i + 1}`).join('\n')
  vi.spyOn(sourceFetch, 'safeFetch').mockResolvedValue('ytInitialPlayerResponse = ' + JSON.stringify({ videoDetails: { title: 'Soups', shortDescription: description } }) + ';')
}
it.each([6900, 7500, 19000])('trims %s Greek characters before the Groq token guard', async length => {
  const fetchSpy = vi.fn(async () => success())
  vi.stubGlobal('fetch', fetchSpy)
  const response = await ingestRequest({ kind: 'prompt', prompt: 'α'.repeat(length) }, 'groq')
  expect(response.status).toBe(200)
  const result = await response.json()
  const sent = JSON.parse((fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
  expect(sent.messages[1].content).toHaveLength(6900)
  expect(estimateTokens(sent.messages[1].content)).toBeLessThanOrEqual(4600)
  expect(estimateTokens(sent.messages[0].content + sent.messages[1].content) + sent.max_tokens).toBeLessThanOrEqual(7500)
  expect(result.warnings.includes('Source notes were trimmed to fit Groq free-tier limits. Review final steps.')).toBe(length > 6900)
})
it.each([8, 10])('extracts at most eight of %s recipe chapters', async count => {
  chapterFixture(count)
  const fetchSpy = vi.fn(async () => success())
  vi.stubGlobal('fetch', fetchSpy)
  const response = await ingestRequest({ kind: 'video', videoUrl: 'MNcu0JX_EMI' })
  expect(response.status).toBe(200)
  const result = await response.json()
  expect(result.count).toBe(8)
  expect(result.recipes.map((draft: { title: string }) => draft.title)).toEqual(Array.from({ length: 8 }, (_, i) => `Soup ${i + 1}`))
  expect(fetchSpy).toHaveBeenCalledTimes(8)
  expect(result.warnings.includes(`Imported the first 8 of ${count} chapters. Additional recipes can be imported individually.`)).toBe(count > 8)
})
it('preserves completed chapters and stops after a later provider failure', async () => {
  chapterFixture(3)
  const fetchSpy = vi.fn().mockResolvedValueOnce(success()).mockResolvedValueOnce(failure(429, 'Rate limit'))
  vi.stubGlobal('fetch', fetchSpy)
  const response = await ingestRequest({ kind: 'video', videoUrl: 'MNcu0JX_EMI' })
  expect(response.status).toBe(200)
  const result = await response.json()
  expect(result).toMatchObject({ isMulti: true, count: 1, recipe: { title: 'Soup 1' }, recipes: [{ title: 'Soup 1' }] })
  expect(result.warnings.join()).toMatch(/Chapter "Soup 2" could not be completed \(Openai rate limit reached.*Earlier chapters were preserved\./)
  expect(fetchSpy).toHaveBeenCalledTimes(2)
})
it('rethrows a provider failure before any chapter completes', async () => {
  chapterFixture(3)
  const fetchSpy = vi.fn(async () => failure(401, 'Unauthorized'))
  vi.stubGlobal('fetch', fetchSpy)
  expect((await ingestRequest({ kind: 'video', videoUrl: 'MNcu0JX_EMI' })).status).toBe(401)
  expect(fetchSpy).toHaveBeenCalledTimes(1)
})

function providerPayload(provider: string, content: string, truncated: boolean) {
  if (provider === 'anthropic') return { stop_reason: truncated ? 'max_tokens' : 'end_turn', content: [{ type: 'text', text: content }] }
  if (provider === 'gemini') return { candidates: [{ finishReason: truncated ? 'MAX_TOKENS' : 'STOP', content: { parts: [{ text: content }] } }] }
  if (provider === 'ollama') return { done_reason: truncated ? 'length' : 'stop', message: { content } }
  return { choices: [{ finish_reason: truncated ? 'length' : 'stop', message: { content } }] }
}
it.each(['openai', 'groq', 'anthropic', 'gemini', 'ollama'])('warns on valid truncated %s drafts and accepts normal completion', async provider => {
  for (const truncated of [true, false]) {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(providerPayload(provider, JSON.stringify(recipe), truncated)))))
    const warning = vi.fn()
    const response = await toWebHandler(createApp().use(defineEventHandler(event => aiClient(event).generate(recipeCreateSchema, 'Make soup', 'Soup', () => recipe, undefined, undefined, warning))))(new Request('http://localhost', { headers: { ...liveHeaders, 'x-byok-provider': provider } }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(recipe)
    expect(warning).toHaveBeenCalledTimes(truncated ? 1 : 0)
  }
})
it.each(['anthropic', 'gemini', 'ollama'])('repairs partial %s drafts and rejects unrepairable truncation with 422', async provider => {
  for (const [content, status] of [['{"title":"Soup","steps":[{"instruction":"Simmer."}', 200], ['{"title":42', 422]] as const) {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(providerPayload(provider, content, true)))))
    expect((await request(provider)).status).toBe(status)
  }
})
it.each(['openai', 'groq', 'anthropic', 'ollama'])('rejects truncated %s translations before enforcing structure invariants', async provider => {
  const original = recipeCreateSchema.parse({ ...recipe, steps: [{ stepNumber: 1, instruction: 'Simmer.' }, { stepNumber: 2, instruction: 'Serve.' }] })
  for (const truncated of [true, false]) {
    const translated = truncated ? { ...recipe, steps: [{ stepNumber: 1, instruction: 'Σιγοβράστε.' }] } : original
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(providerPayload(provider, JSON.stringify(translated), truncated)))))
    const response = await toWebHandler(createApp().use(translate))(new Request('http://localhost', { method: 'POST', headers: { ...liveHeaders, 'x-byok-provider': provider }, body: JSON.stringify({ recipe: original, targetLanguage: 'el' }) }))
    expect(response.status).toBe(truncated ? 422 : 200)
    if (truncated) expect((await response.json()).statusMessage).toBe('The recipe translation was cut off because it exceeded the model’s response limit. Try translating a shorter recipe or smaller section.')
  }
})
it.each([false, true])('bounds InnerTube fallback and preserves caller cancellation (signal: %s)', async hasSignal => {
  const controller = new AbortController(), deadline = new AbortController()
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal)
  vi.spyOn(sourceFetch, 'safeFetch').mockResolvedValue('ytInitialPlayerResponse = ' + JSON.stringify({ videoDetails: { title: 'Soup', shortDescription: 'Make soup' } }) + '; "INNERTUBE_API_KEY":"test_key"')
  let requestSignal: AbortSignal | undefined
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    requestSignal = init.signal as AbortSignal
    if (hasSignal) controller.abort()
    else deadline.abort()
    requestSignal.throwIfAborted()
    return new Response('{}')
  }))
  const response = await toWebHandler(createApp().use(defineEventHandler(event => ingest(event, { kind: 'video', videoUrl: 'MNcu0JX_EMI' }, hasSignal ? controller.signal : undefined))))(new Request('http://localhost'))
  expect(timeout).toHaveBeenCalledWith(10000)
  expect(requestSignal?.aborted).toBe(true)
  expect(response.status).toBe(hasSignal ? 499 : 200)
  if (!hasSignal) expect((await response.json()).recipe.title).toBe('Soup')
})

it.each([
  ['Failed to generate JSON', undefined],
  ['json_validate_failed', undefined],
  ['Grammar rejected output', 'json_validate_failed']
])('retries a Groq JSON grammar error (%s) without response_format', async (message, code) => {
  const fetchSpy = vi.fn().mockResolvedValueOnce(failure(400, message, code)).mockResolvedValueOnce(success())
  vi.stubGlobal('fetch', fetchSpy)
  const response = await request()
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(recipe)
  expect(fetchSpy).toHaveBeenCalledTimes(2)
  const first = fetchSpy.mock.calls[0]![1] as RequestInit, second = fetchSpy.mock.calls[1]![1] as RequestInit
  const body = JSON.parse(first.body as string)
  expect(body.response_format).toEqual({ type: 'json_object' })
  delete body.response_format
  expect(JSON.parse(second.body as string)).toEqual(body)
  expect(body.max_tokens).toBe(2048)
  expect(second.signal).toBe(first.signal)
  expect(second.headers).toEqual(first.headers)
})

it('retries only once and preserves the actionable error', async () => {
  const fetchSpy = vi.fn().mockImplementation(async () => failure())
  vi.stubGlobal('fetch', fetchSpy)
  const response = await request()
  expect(response.status).toBe(400)
  expect((await response.json()).statusMessage).toContain('qwen/qwen3.8-27b')
  expect(fetchSpy).toHaveBeenCalledTimes(2)
})

it.each([['openai', 400, 'Failed to generate JSON'], ['groq', 429, 'Failed to generate JSON'], ['groq', 400, 'model not available'], ['groq', 401, 'json_validate_failed']])('does not retry unrelated %s HTTP %s errors', async (provider, status, message) => {
  const fetchSpy = vi.fn().mockResolvedValue(failure(status, message))
  vi.stubGlobal('fetch', fetchSpy)
  expect((await request(provider)).status).toBe(status)
  expect(fetchSpy).toHaveBeenCalledTimes(1)
})

it('still validates the retry output against the recipe schema', async () => {
  const fetchSpy = vi.fn().mockResolvedValueOnce(failure()).mockResolvedValueOnce(success('{"title":42}'))
  vi.stubGlobal('fetch', fetchSpy)
  expect((await request()).status).toBe(502)
  expect(fetchSpy).toHaveBeenCalledTimes(2)
})

it('does not retry after caller cancellation', async () => {
  const controller = new AbortController()
  const fetchSpy = vi.fn(async () => { controller.abort(); return failure() })
  vi.stubGlobal('fetch', fetchSpy)
  expect((await request('groq', controller.signal)).status).toBe(504)
  expect(fetchSpy).toHaveBeenCalledTimes(1)
})

it('lists the requested developer models in both actionable Groq tips', () => {
  for (const message of [humanizeProviderError('groq', 404, '', 'old-model'), humanizeProviderError('groq', 400, 'json_validate_failed', 'old-model')]) {
    expect(message).toContain('openai/gpt-oss-120b')
    expect(message).toContain('qwen/qwen3.8-27b')
    expect(message).not.toMatch(/llama|gpt-oss-20b/)
  }
})
it.each([
  '  Here is your recipe:\n```json\n' + JSON.stringify(recipe) + '\n```\nEnjoy!  ',
  'Result:\n```\n' + JSON.stringify(recipe) + '\n```\nDone.',
  'Here is your recipe: ' + JSON.stringify(recipe) + ' Enjoy!'
])('extracts JSON from fenced or prose-wrapped provider output', async content => {
  vi.stubGlobal('fetch', vi.fn(async () => success(content)))
  const response = await request()
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(recipe)
})
it.each([500, 502, 503])('preserves actionable provider HTTP %s errors through SSE', async status => {
  vi.stubGlobal('fetch', vi.fn(async () => failure(status, 'Service temporarily unavailable')))
  const handle = toWebHandler(createApp().use(stream))
  const response = await handle(new Request('http://localhost', { method: 'POST', headers: { ...headers, 'x-byok-key': 'test', 'x-byok-model': 'test', 'x-byok-provider': 'groq' }, body: JSON.stringify({ kind: 'prompt', prompt: 'Make lemon chicken' }) }))
  await expect(readRecipeStream(response, vi.fn())).rejects.toThrow(`Groq error (${status}): Service temporarily unavailable`)
})
it.each([
  JSON.stringify(recipe),
  '{"title":"Soup","description":"Warm","ingredients":[{"name":"salt","amount":"to taste"},{"name":"unfinished',
  '{"title":"Soup","description":"Warm","steps":[{"instruction":"Simmer.","heatLevel":"med"},{"instruction":"unfinished'
])('salvages complete or repairable token-truncated drafts', async content => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content } }] }))))
  const response = await request()
  expect(response.status).toBe(200)
  const draft = await response.json()
  expect(recipeCreateSchema.safeParse(draft).success).toBe(true)
  expect(draft.title).toBe('Soup')
  expect(JSON.stringify(draft)).not.toContain('unfinished')
  if (draft.ingredients) expect(draft.ingredients).toEqual([{ name: 'salt', amount: 0, unit: 'item', sortOrder: 1 }])
  if (draft.steps) expect(draft.steps).toEqual([{ stepNumber: 1, instruction: 'Simmer.', heatLevel: 'medium' }])
})
it.each(['unrepairable garbage', '{"title":"Soup', '{"title":42'])('rejects unrepairable or invalid token-truncated output', async content => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content } }] }))))
  const response = await request()
  expect(response.status).toBe(422)
  expect((await response.json()).statusMessage).toContain('exceeded the model’s response limit')
})
it('repairs nested containers while ignoring escaped quotes and braces inside strings', () => {
  const nested = { items: [{ nested: { instruction: 'Use a "{quoted}" label and a trailing slash \\' } }] }
  const complete = JSON.stringify(nested)
  expect(repairTruncatedJson(complete)).toBe(complete)
  expect(JSON.parse(repairTruncatedJson(complete.slice(0, -3)))).toEqual(nested)
  expect(JSON.parse(repairTruncatedJson('{"title":"Soup","description":"Warm"'))).toEqual(recipe)
})
it.each([
  ['not JSON', '[aiClient] JSON parse failed:', 'could not be parsed as JSON'],
  ['{"title":42}', '[aiClient] Schema validation failed:', 'expected recipe structure']
])('distinguishes invalid JSON from invalid recipe structure (%s)', async (content, logMessage, publicMessage) => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    vi.stubGlobal('fetch', vi.fn(async () => success(content)))
    const response = await request()
    expect(response.status).toBe(502)
    expect((await response.json()).statusMessage).toContain(publicMessage)
    expect(log).toHaveBeenCalledWith(logMessage, expect.anything())
  } finally { log.mockRestore() }
})
it('streams ordered public progress, draft chunk and validated completion', async () => {
  const fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy)
  const handle = toWebHandler(createApp().use(csrf).use(stream))
  const response = await handle(new Request('http://localhost/api/ai/recipe/stream', { method: 'POST', headers, body: JSON.stringify({ kind: 'prompt', prompt: 'Grandma lemon chicken' }) }))
  expect(response.headers.get('content-type')).toContain('text/event-stream')
  const events: string[] = []; let result: any
  await readRecipeStream(response, (event, data) => { events.push(event); if (event === 'complete') result = data })
  expect(events).toEqual(['status', 'thought', 'thought', 'recipe_chunk', 'complete'])
  expect(recipeCreateSchema.safeParse(result.recipe).success).toBe(true)
  expect(result.mode).toBe('fallback')
  expect(fetchSpy).not.toHaveBeenCalled()
})
it('rejects invalid requests and foreign origins before streaming', async () => {
  const handle = toWebHandler(createApp().use(csrf).use(stream))
  for (const [body, origin, status] of [[{}, 'http://localhost', 400], [{ kind: 'prompt', prompt: 'Hello recipe' }, 'https://evil.test', 403]] as const) {
    expect((await handle(new Request('http://localhost/api/ai/recipe/stream', { method: 'POST', headers: { ...headers, Origin: origin }, body: JSON.stringify(body) }))).status).toBe(status)
  }
})
it('terminates failed ingestion with an error event, never a completed draft', async () => {
  const handle = toWebHandler(createApp().use(stream))
  const response = await handle(new Request('http://localhost/api/ai/recipe/stream', { method: 'POST', headers, body: JSON.stringify({ kind: 'url', url: 'http://127.0.0.1/private' }) }))
  const events: string[] = []
  await expect(readRecipeStream(response, event => events.push(event))).rejects.toThrow('Private or reserved source address blocked')
  expect(events).toEqual(['status', 'thought'])
})
it('propagates a missing model as an actionable 400 error', async () => {
  const handle = toWebHandler(createApp().use(stream))
  const response = await handle(new Request('http://localhost', { method: 'POST', headers: { ...headers, 'x-byok-key': 'secret-test' }, body: JSON.stringify({ kind: 'prompt', prompt: 'Make lemon chicken' }) }))
  await expect(readRecipeStream(response, vi.fn())).rejects.toThrow('Choose an AI model in Settings')
})
it('keeps provider 502 failures generic in SSE without leaking upstream detail', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('private-provider-detail secret-test', { status: 502 })))
  const handle = toWebHandler(createApp().use(stream))
  const response = await handle(new Request('http://localhost', { method: 'POST', headers: { ...headers, 'x-byok-key': 'secret-test', 'x-byok-model': 'test' }, body: JSON.stringify({ kind: 'prompt', prompt: 'Make lemon chicken' }) }))
  const text = await response.text()
  expect(text).toContain('Could not create a draft.')
  expect(text).not.toContain('private-provider-detail')
  expect(text).not.toContain('secret-test')
  expect(text).not.toContain('event: complete')
})
it.each(['openai', 'anthropic', 'gemini', 'groq', 'ollama'])('uses request-scoped %s credentials and parses provider response', async provider => {
  const recipe = { title: 'Soup', description: 'Warm' }, json = JSON.stringify(recipe)
  const payload = provider === 'anthropic' ? { content: [{ type: 'text', text: json }] } : provider === 'gemini' ? { candidates: [{ content: { parts: [{ text: json }] } }] } : provider === 'ollama' ? { message: { content: json } } : { choices: [{ message: { content: json } }] }
  const fetchSpy = vi.fn(async () => new Response(JSON.stringify(payload))); vi.stubGlobal('fetch', fetchSpy)
  const handle = toWebHandler(createApp().use(defineEventHandler(event => aiClient(event).generate(recipeCreateSchema, 'recipe', 'Soup', () => recipe))))
  const response = await handle(new Request('http://localhost/test', { headers: { 'x-byok-key': 'secret-test', 'x-byok-provider': provider, 'x-byok-model': 'model-test' } }))
  expect(await response.json()).toEqual(recipe)
  const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).not.toContain('secret-test')
  expect(init.body).not.toContain('secret-test')
  expect(JSON.stringify(init.headers)).toContain('secret-test')
  const sent = JSON.parse(init.body as string)
  if (provider === 'groq') expect(sent.max_tokens).toBe(2048)
  if (provider === 'openai' || provider === 'anthropic') expect(sent.max_tokens).toBe(6000)
  if (provider === 'ollama') expect(sent.options).toEqual({ num_ctx: 16384, num_predict: 4096 })
})
it('sanitizes provider errors instead of leaking keys or returning a fake success', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('secret-test') }))
  const handle = toWebHandler(createApp().use(defineEventHandler(event => aiClient(event).generate(recipeCreateSchema, '', '', () => ({ title: '', description: '' })))))
  const response = await handle(new Request('http://localhost', { headers: { 'x-byok-key': 'secret-test', 'x-byok-model': 'test' } }))
  expect(response.status).toBe(502)
  expect(await response.text()).not.toContain('secret-test')
})
it('parses split UTF-8/CRLF frames and rejects a truncated stream', async () => {
  const bytes = new TextEncoder().encode('event: complete\r\ndata: {"title":"αλάτι"}\r\n\r\n')
  const response = new Response(new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close() } }))
  const event = vi.fn(); await readRecipeStream(response, event)
  expect(event).toHaveBeenCalledWith('complete', { title: 'αλάτι' })
  await expect(readRecipeStream(new Response('event: status\ndata: {}\n\n'), vi.fn())).rejects.toThrow('ended')
})
