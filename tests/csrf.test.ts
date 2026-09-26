import { createApp, defineEventHandler, toWebHandler } from 'h3'
import { describe, expect, it } from 'vitest'
import csrf from '../server/middleware/csrf'

function harness() {
  let mutations = 0
  const app = createApp()
  app.use(csrf)
  app.use(defineEventHandler(event => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.method)) mutations++
    return { ok: true }
  }))
  const handle = toWebHandler(app)
  return {
    request: (method: string, headers: Record<string, string>) => handle(new Request('http://localhost:3100/api/recipes', { method, headers: { Host: 'localhost:3100', ...headers } })),
    mutations: () => mutations
  }
}

describe('CSRF mutation guard', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('allows verified same-origin %s', async method => {
    const app = harness()
    for (const headers of [
      { Origin: 'http://localhost:3100' },
      { Referer: 'http://localhost:3100/recipes/new?draft=1' },
      { Origin: 'http://localhost:3100', Referer: 'http://localhost:3100/settings' }
    ]) expect((await app.request(method, headers)).status).toBe(200)
    expect(app.mutations()).toBe(3)
  })

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('rejects unverified or conflicting %s', async method => {
    const app = harness()
    const rejected: Record<string, string>[] = [
      {}, { Origin: 'null' }, { Origin: '' }, { Origin: 'not a URL' },
      { Origin: 'http://localhost:3100.attacker.example' },
      { Origin: 'http://localhost:3101' }, { Origin: 'https://localhost:3100' },
      { Origin: 'http://localhost:3100/path' },
      { Origin: 'http://user:password@localhost:3100' },
      { Origin: 'http://localhost:3100 http://attacker.example' },
      { Origin: 'http://localhost:3100', Referer: 'https://attacker.example' },
      { Origin: 'https://attacker.example', Referer: 'http://localhost:3100/' },
      { Referer: 'https://attacker.example/path' }, { Referer: '/relative' },
      { Origin: 'http://localhost:3100', 'Sec-Fetch-Site': 'cross-site' },
      { Origin: 'https://attacker.example', 'X-Forwarded-Host': 'attacker.example', 'X-Forwarded-Proto': 'https' }
    ]
    for (const headers of rejected) expect((await app.request(method, headers)).status, JSON.stringify(headers)).toBe(403)
    expect(app.mutations()).toBe(0)
  })

  it.each(['GET', 'HEAD', 'OPTIONS'])('does not block safe %s requests', async method => {
    const app = harness()
    expect((await app.request(method, { Origin: 'https://attacker.example' })).status).toBe(200)
    expect(app.mutations()).toBe(0)
  })
})
