import { afterEach, expect, it, vi } from 'vitest'
import { createApp, defineEventHandler, toWebHandler } from 'h3'
import stream from '../server/api/ai/recipe/stream.post'
import csrf from '../server/middleware/csrf'
import { aiClient, humanizeProviderError } from '../server/utils/ai/client'
import { recipeCreateSchema } from '../server/utils/validation'
import { readRecipeStream } from '../app/utils/sse'
afterEach(() => vi.unstubAllGlobals())
const headers = { Host: 'localhost', Origin: 'http://localhost', 'Content-Type': 'application/json' }
const recipe = { title: 'Soup', description: 'Warm' }
const failure = (status = 400, message = 'Failed to generate JSON', code?: string) => new Response(JSON.stringify({ error: { message, code } }), { status })
const success = (content = '```json\n' + JSON.stringify(recipe) + '\n```') => new Response(JSON.stringify({ choices: [{ message: { content } }] }))
function request(provider = 'groq', signal?: AbortSignal) {
  const handle = toWebHandler(createApp().use(defineEventHandler(event => aiClient(event).generate(recipeCreateSchema, 'Make soup', 'Soup notes', () => recipe, signal))))
  return handle(new Request('http://localhost/', { headers: { 'x-byok-key': 'test-key', 'x-byok-model': 'test-model', 'x-byok-provider': provider } }))
}

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
  expect(body.max_tokens).toBe(4096)
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
it.each([JSON.stringify(recipe), '{"title":"Soup'])('rejects token-truncated output before accepting or parsing it', async content => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content } }] }))))
  const response = await request()
  expect(response.status).toBe(422)
  expect((await response.json()).statusMessage).toContain('exceeded the model’s response limit')
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
  if (provider === 'groq') expect(sent.max_tokens).toBe(4096)
  if (provider === 'openai' || provider === 'anthropic') expect(sent.max_tokens).toBe(6000)
  if (provider === 'ollama') expect(sent.options.num_predict).toBe(6000)
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
