import { createServer, type Http2Server, type ServerHttp2Stream, type IncomingHttpHeaders } from 'node:http2'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { http2Get } from '../server/utils/http2-get'
import { lookupPrices, resetPriceCache } from '../server/utils/market-prices'

let server: Http2Server
let base = ''
let seen: { headers: IncomingHttpHeaders }[] = []
let handler: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders) => void = () => {}
const opts = (over: Partial<Parameters<typeof http2Get>[1]> = {}) => ({ headers: { 'User-Agent': 'Mozilla/5.0 Chrome/124', Accept: 'application/json' }, signal: new AbortController().signal, maxBytes: 1024, ...over })

beforeEach(async () => {
  seen = []; resetPriceCache()
  server = createServer()
  server.on('stream', (stream, headers) => { seen.push({ headers }); handler(stream, headers) })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterEach(async () => { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections?.() }) })

it('returns status and body for a 200 response', async () => {
  handler = stream => { stream.respond({ ':status': 200, 'content-type': 'application/json' }); stream.end('{"products":[]}') }
  expect(await http2Get(base + '/products', opts())).toEqual({ status: 200, body: '{"products":[]}' })
})

it('returns a 403 as a value instead of throwing', async () => {
  handler = stream => { stream.respond({ ':status': 403 }); stream.end('blocked') }
  expect(await http2Get(base + '/products', opts())).toEqual({ status: 403, body: 'blocked' })
})

it('forwards lowercased headers and preserves path and query byte for byte', async () => {
  handler = stream => { stream.respond({ ':status': 200 }); stream.end('ok') }
  await http2Get(base + '/products?q=%CF%86%CE%B5%CF%84%CE%B1&countries=GR', opts())
  expect(seen[0]!.headers[':path']).toBe('/products?q=%CF%86%CE%B5%CF%84%CE%B1&countries=GR')
  expect(seen[0]!.headers['user-agent']).toBe('Mozilla/5.0 Chrome/124')
  expect(seen[0]!.headers.accept).toBe('application/json')
})

it('rejects with AbortError when the signal aborts while the server never answers', async () => {
  let closed = false
  handler = stream => { stream.on('close', () => { closed = true }) }
  const controller = new AbortController()
  const pending = http2Get(base + '/slow', opts({ signal: controller.signal }))
  setTimeout(() => controller.abort(), 50)
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(closed).toBe(true)
})

it('rejects immediately when the signal is already aborted', async () => {
  handler = stream => { stream.respond({ ':status': 200 }); stream.end('late') }
  const controller = new AbortController(); controller.abort()
  await expect(http2Get(base + '/x', opts({ signal: controller.signal }))).rejects.toMatchObject({ name: 'AbortError' })
})

it('rejects when the body exceeds maxBytes', async () => {
  handler = stream => { stream.respond({ ':status': 200 }); stream.end('x'.repeat(5000)) }
  await expect(http2Get(base + '/big', opts({ maxBytes: 1000 }))).rejects.toThrow(/too large/i)
})

it('rejects when the connection is refused', async () => {
  await expect(http2Get('http://127.0.0.1:1/products', opts())).rejects.toThrow()
})

it.runIf(process.env.LIVE_PRICES === '1')('reaches the real posokanei API over http2', async () => {
  const result = await lookupPrices('φετα')
  expect(result.available).toBe(true)
  expect(result.products.length).toBeGreaterThan(0)
  expect(result.products[0]!.retailers[0]!.price).toBeGreaterThan(0)
}, 10_000)
