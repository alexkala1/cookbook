import { afterEach, expect, it, vi } from 'vitest'
import { createApp, defineEventHandler, toWebHandler } from 'h3'
import stream from '../server/api/ai/recipe/stream.post'
import csrf from '../server/middleware/csrf'
import { aiClient } from '../server/utils/ai/client'
import { recipeCreateSchema } from '../server/utils/validation'
import { readRecipeStream } from '../app/utils/sse'
afterEach(() => vi.unstubAllGlobals())
const headers = { Host: 'localhost', Origin: 'http://localhost', 'Content-Type': 'application/json' }
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
  await expect(readRecipeStream(response, event => events.push(event))).rejects.toThrow('Could not create')
  expect(events).toEqual(['status', 'thought'])
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
