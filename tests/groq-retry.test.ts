import { afterEach, expect, it, vi } from 'vitest'
import { createApp, defineEventHandler, toWebHandler } from 'h3'
import { aiClient, humanizeProviderError } from '../server/utils/ai/client'
import { recipeCreateSchema } from '../server/utils/validation'

afterEach(() => vi.unstubAllGlobals())
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
