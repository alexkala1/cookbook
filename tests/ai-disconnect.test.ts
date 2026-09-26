import { createServer, request } from 'node:http'
import { createApp, toNodeListener } from 'h3'
import { expect, it, vi } from 'vitest'
import stream from '../server/api/ai/recipe/stream.post'

it('aborts the provider request when the SSE client disconnects', async () => {
  let started!: () => void, aborted!: () => void
  const providerStarted = new Promise<void>(resolve => { started = resolve })
  const providerAborted = new Promise<void>(resolve => { aborted = resolve })
  vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => { aborted(); reject(new Error('Cancelled')) }, { once: true })
    started()
  })))
  const server = createServer(toNodeListener(createApp().use(stream)))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  const client = request({ hostname: '127.0.0.1', port: address.port, path: '/', method: 'POST', headers: { 'Content-Type': 'application/json', 'x-byok-key': 'test-key', 'x-byok-model': 'test-model' } }, response => response.resume())
  client.on('error', () => {})
  try {
    client.end(JSON.stringify({ kind: 'prompt', prompt: 'Lemon chicken memory' }))
    await providerStarted
    client.destroy()
    await providerAborted
    expect(fetch).toHaveBeenCalledOnce()
  } finally {
    client.destroy(); server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
    vi.unstubAllGlobals()
  }
}, 5000)
