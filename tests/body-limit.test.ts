import { createServer, request as httpRequest } from 'node:http'
import { createApp, defineEventHandler, toNodeListener, toWebHandler } from 'h3'
import { expect, it, vi } from 'vitest'
import middleware from '../server/middleware/body-limit'
import { readJsonLimited } from '../server/utils/body-limit'
import importHandler from '../server/api/backup/import.post'
import { importBackup } from '../server/utils/backup'

vi.mock('../server/utils/backup', () => ({ importBackup: vi.fn(() => ({ imported: {} })) }))

it('rejects an oversized declared backup without parsing or importing it', async () => {
  vi.mocked(importBackup).mockClear()
  const response = await toWebHandler(createApp().use(middleware).use(importHandler))(new Request('http://localhost/api/backup/import', { method: 'POST', headers: { 'Content-Length': '31000001' }, body: '{}' }))
  expect(response.status).toBe(413)
  expect(response.headers.get('connection')).toBe('close')
  expect(importBackup).not.toHaveBeenCalled()
})
it.each([
  ['/api/backup/import', 31_000_000], ['/api/ingest/ocr', 11_000_000], ['/api/ai/recipe/stream', 11_000_000], ['/api/recipes', 4_000_000], ['/api/recipes/id', 4_000_000], ['/api/pantry', 2_000_000], ['/api/recipes-other', 2_000_000]
])('enforces declared body boundaries for %s', async (path, max) => {
  const reached = vi.fn(() => 'accepted')
  const handle = toWebHandler(createApp().use(middleware).use(defineEventHandler(reached)))
  for (const method of ['POST', 'PUT', 'PATCH']) {
    expect((await handle(new Request('http://localhost' + path, { method, headers: { 'Content-Length': String(max) }, body: '{}' }))).status).toBe(200)
    expect((await handle(new Request('http://localhost' + path, { method, headers: { 'Content-Length': String(max + 1) }, body: '{}' }))).status).toBe(413)
  }
  expect(reached).toHaveBeenCalledTimes(3)
  expect((await handle(new Request('http://localhost' + path, { headers: { 'Content-Length': String(max + 1) } }))).status).toBe(200)
})
it('counts UTF-8 bytes in chunked bodies and accepts the exact boundary', async () => {
  const json = JSON.stringify({ text: 'α' })
  const bytes = Buffer.byteLength(json)
  for (const max of [bytes, bytes - 1]) {
    const handle = toWebHandler(createApp().use(defineEventHandler(event => readJsonLimited(event, max))))
    const body = new ReadableStream({ start(controller) { controller.enqueue(Buffer.from(json)); controller.close() } })
    const response = await handle(new Request('http://localhost', { method: 'POST', body, duplex: 'half' } as RequestInit))
    expect(response.status).toBe(max === bytes ? 200 : 413)
  }
})
it('returns 400 for malformed or empty JSON', async () => {
  const handle = toWebHandler(createApp().use(defineEventHandler(event => readJsonLimited(event, 100))))
  for (const body of ['{', '']) expect((await handle(new Request('http://localhost', { method: 'POST', body }))).status).toBe(400)
})
it('returns an HTTP 413 for chunked Node requests without resetting the socket', async () => {
  const server = createServer(toNodeListener(createApp().use(defineEventHandler(event => readJsonLimited(event, 8)))))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address() as { port: number }
    const response = await new Promise<{ status: number, body: string }>((resolve, reject) => {
      const request = httpRequest({ host: '127.0.0.1', port: address.port, method: 'POST' }, response => {
        let body = ''
        response.on('data', chunk => { body += chunk })
        response.on('end', () => resolve({ status: response.statusCode!, body }))
      })
      request.setTimeout(2000, () => request.destroy(new Error('Test request timed out')))
      request.on('error', reject)
      request.write('{"text":')
      request.end('"over limit"}')
    })
    expect(response.status).toBe(413)
    expect(response.body).toContain('Request body exceeds')
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
})
