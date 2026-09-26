import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { beforeEach, expect, it, vi } from 'vitest'
import { request } from 'node:https'
import { safeFetch } from '../server/utils/ai/safe-fetch'
vi.mock('node:dns/promises', () => ({ lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]) }))
vi.mock('node:https', () => ({ request: vi.fn() }))
let responses: { status: number, location?: string, body?: string }[]
beforeEach(() => {
  responses = [{ status: 200, body: '<main>Recipe</main>' }]
  vi.mocked(request).mockReset().mockImplementation(((_url: unknown, _options: unknown, callback: (response: unknown) => void) => {
    const req = new EventEmitter() as EventEmitter & { end: () => void, destroy: (error: Error) => void }
    req.destroy = error => { req.emit('error', error); req.emit('close') }
    req.end = () => queueMicrotask(() => {
      const fixture = responses.shift()!
      const res = Object.assign(new PassThrough(), { statusCode: fixture.status, headers: { location: fixture.location } })
      callback(res); res.end(fixture.body || ''); req.emit('close')
    })
    return req
  }) as typeof request)
})
it('pins the connection to the verified address and sends no caller credentials', async () => {
  expect(await safeFetch('https://recipe.example')).toContain('Recipe')
  const options = vi.mocked(request).mock.calls[0]![1] as any
  const callback = vi.fn(); options.lookup('recipe.example', {}, callback)
  expect(callback).toHaveBeenCalledWith(null, '93.184.216.34', 4)
  expect(options.family).toBe(4)
  expect(options.headers).not.toHaveProperty('Authorization')
})
it('revalidates redirects before connecting to a private target', async () => {
  responses = [{ status: 302, location: 'http://127.0.0.1/admin' }]
  await expect(safeFetch('https://recipe.example')).rejects.toThrow('blocked')
  expect(request).toHaveBeenCalledTimes(1)
})
it('limits redirect loops and oversized response bodies', async () => {
  responses = Array.from({ length: 4 }, () => ({ status: 302, location: '/next' }))
  await expect(safeFetch('https://recipe.example')).rejects.toThrow('redirects')
  responses = [{ status: 200, body: 'x'.repeat(2_000_001) }]
  await expect(safeFetch('https://recipe.example')).rejects.toThrow('too large')
})
it('rejects malformed redirect locations without throwing outside the request promise', async () => {
  responses = [{ status: 302, location: 'http://[' }]
  await expect(safeFetch('https://recipe.example')).rejects.toThrow('Invalid source redirect')
})
