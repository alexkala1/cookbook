import { createApp, defineEventHandler, toWebHandler } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import csrf from '../server/middleware/csrf'

afterEach(() => vi.unstubAllEnvs())

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
  it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])('blocks DNS-rebinding hosts on %s even with a matching Origin', async method => {
    vi.stubEnv('HEIRLOOM_PUBLIC_HOST', '')
    const app = harness()
    for (const host of ['attacker.example', 'localhost.attacker.example', '127.0.0.1.attacker.example', '127.1', '2130706433', '0x7f000001', 'localhost.', 'localhost:65536', 'localhost:0', 'localhost:abc', 'localhost/path', 'user@localhost', 'localhost,attacker.example', '']) {
      expect((await app.request(method, { Host: host, Origin: 'http://' + host })).status, host).toBe(403)
    }
    expect(app.mutations()).toBe(0)
  })

  it.each(['localhost:3100', 'LOCALHOST:3100', '127.0.0.1:3100', '[::1]:3100', 'localhost'])('allows local Host %s', async host => {
    const app = harness()
    expect((await app.request('POST', { Host: host, Origin: 'http://' + host })).status).toBe(200)
    expect(app.mutations()).toBe(1)
  })

  it('allows only the configured public hostname and still checks the Origin', async () => {
    vi.stubEnv('HEIRLOOM_PUBLIC_HOST', 'Cookbook.Example.com')
    const app = harness()
    expect((await app.request('POST', { Host: 'cookbook.example.com:3100', Origin: 'http://cookbook.example.com:3100' })).status).toBe(200)
    expect((await app.request('POST', { Host: 'cookbook.example.com', Origin: 'http://attacker.example' })).status).toBe(403)
    for (const host of ['sub.cookbook.example.com', 'cookbook.example.com.attacker.example']) {
      expect((await app.request('GET', { Host: host })).status).toBe(403)
    }
    expect(app.mutations()).toBe(1)
  })

  it.each(['http://Cookbook.Example.com:3000', 'https://cookbook.example.com/'])('accepts a public origin %s without weakening same-origin checks', async configured => {
    vi.stubEnv('HEIRLOOM_PUBLIC_HOST', configured)
    const app = harness()
    expect((await app.request('POST', { Host: 'cookbook.example.com:3000', Origin: 'http://cookbook.example.com:3000' })).status).toBe(200)
    expect((await app.request('POST', { Host: 'cookbook.example.com:3000', Origin: 'http://attacker.example' })).status).toBe(403)
    expect((await app.request('GET', { Host: 'cookbook.example.com.attacker.example' })).status).toBe(403)
  })

  it.each(['http://cookbook.example.com/path', 'http://user@cookbook.example.com', 'http://cookbook.example.com?x=1', 'http://cookbook.example.com:0', 'http://cookbook.example.com:65536', 'ftp://cookbook.example.com', 'http://*.example.com'])('rejects invalid public origin %s', async configured => {
    vi.stubEnv('HEIRLOOM_PUBLIC_HOST', configured)
    expect((await harness().request('GET', { Host: 'cookbook.example.com' })).status).toBe(403)
  })

  it('allows every host in a comma-separated HEIRLOOM_PUBLIC_HOST list', async () => {
    vi.stubEnv('HEIRLOOM_PUBLIC_HOST', ' 203.0.113.9 , Cookbook.local ,,')
    const app = harness()
    for (const host of ['203.0.113.9:3000', 'cookbook.local:3000']) {
      expect((await app.request('POST', { Host: host, Origin: 'http://' + host })).status, host).toBe(200)
    }
    expect((await app.request('GET', { Host: 'attacker.example' })).status).toBe(403)
    expect((await app.request('GET', { Host: '203.0.113.10' })).status).toBe(403)
  })

  it.each(['192.168.1.17:3000', '10.0.0.5:3000', '10.255.255.255', '172.16.0.1:3000', '172.31.255.254'])('allows private LAN IPv4 Host %s', async host => {
    vi.stubEnv('HEIRLOOM_PUBLIC_HOST', '')
    const app = harness()
    expect((await app.request('POST', { Host: host, Origin: 'http://' + host })).status).toBe(200)
    expect((await app.request('POST', { Host: host, Origin: 'http://attacker.example' })).status).toBe(403)
  })

  it.each(['172.15.0.1', '172.32.0.1', '192.169.1.1', '11.0.0.1', '8.8.8.8', '192.168.1.256', '192.168.01.17', '192.168.1', '192.168.1.17.attacker.example', '0xc0a80111', '3232235793', '010.0.0.1', '10.1', '::ffff:192.168.1.17'])('blocks non-canonical or public address Host %s', async host => {
    vi.stubEnv('HEIRLOOM_PUBLIC_HOST', '')
    expect((await harness().request('GET', { Host: host })).status).toBe(403)
  })

  it('admits *.local names only with HEIRLOOM_ALLOW_LAN=true', async () => {
    vi.stubEnv('HEIRLOOM_PUBLIC_HOST', '')
    expect((await harness().request('GET', { Host: 'kitchen.local:3000' })).status).toBe(403)
    vi.stubEnv('HEIRLOOM_ALLOW_LAN', 'true')
    expect((await harness().request('GET', { Host: 'kitchen.local:3000' })).status).toBe(200)
    expect((await harness().request('GET', { Host: 'kitchen.local.attacker.example' })).status).toBe(403)
    expect((await harness().request('GET', { Host: 'attacker.example' })).status).toBe(403)
  })

  it('does not trust forwarded headers or treat configured hosts as wildcards', async () => {
    vi.stubEnv('HEIRLOOM_PUBLIC_HOST', '*.example.com')
    const app = harness()
    expect((await app.request('GET', { Host: 'attacker.example', 'X-Forwarded-Host': 'localhost' })).status).toBe(403)
    expect((await app.request('GET', { Host: 'cookbook.example.com' })).status).toBe(403)
    expect((await app.request('GET', { Host: 'localhost', 'X-Forwarded-Host': 'attacker.example' })).status).toBe(200)
  })

  it('rejects a missing Host header', async () => {
    const app = createApp().use(csrf).use(defineEventHandler(() => ({ ok: true })))
    const response = await toWebHandler(app)(new Request('http://localhost/api/recipes'))
    expect(response.status).toBe(403)
  })

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
