import { afterAll, describe, expect, it, vi } from 'vitest'

vi.stubGlobal('defineNuxtConfig', (value: unknown) => value)
const { default: config } = await import('../nuxt.config')
afterAll(() => vi.unstubAllGlobals())
const cache = config.pwa!.workbox!.runtimeCaching as { urlPattern: (context: { url: URL, request: Request, sameOrigin: boolean }) => boolean }[]
const context = (path: string, init: RequestInit = {}, sameOrigin = true) => ({ url: new URL(path, 'https://heirloom.test'), request: new Request(new URL(path, 'https://heirloom.test'), init), sameOrigin })

describe('PWA request isolation', () => {
  it.each(['/api/recipes', '/api/recipes/abc', '/api/settings/kitchen', '/api/pantry', '/api/guests'])('caches ordinary reads of %s', path => {
    expect(cache[1]!.urlPattern(context(path))).toBe(true)
  })
  it.each(['POST', 'PUT', 'DELETE', 'PATCH'])('never caches %s mutations', method => {
    expect(cache[1]!.urlPattern(context('/api/recipes', { method }))).toBe(false)
  })
  it.each(['x-byok-key', 'X-BYOK-Provider', 'x-byok-model'])('never caches requests carrying %s', header => {
    expect(cache[1]!.urlPattern(context('/api/recipes', { headers: { [header]: 'private' } }))).toBe(false)
  })
  it.each(['/api/ai/recipe/stream', '/api/ingest/url', '/api/recipes-other'])('excludes %s', path => {
    expect(cache[1]!.urlPattern(context(path))).toBe(false)
  })
  it('excludes foreign origins and limits the prerendered Home fallback to Home', () => {
    expect(cache[1]!.urlPattern(context('/api/recipes', {}, false))).toBe(false)
    const allow = config.pwa!.workbox!.navigateFallbackAllowlist!
    expect(allow.some(pattern => pattern.test('/'))).toBe(true)
    expect(allow.some(pattern => pattern.test('/recipes/abc/cook'))).toBe(false)
  })
})
