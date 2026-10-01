import { connect, type ClientHttp2Session } from 'node:http2'

export type Http2Response = { status: number, body: string }

const abortError = () => Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })

// api.posokanei.gov.gr's WAF rejects Node's HTTP/1.1 clients (fetch, https) but serves HTTP/2, so prices use one short-lived h2 session per call.
export function http2Get(url: string, opts: { headers: Record<string, string>, signal: AbortSignal, maxBytes: number }): Promise<Http2Response> {
  return new Promise((resolve, reject) => {
    if (opts.signal.aborted) return reject(abortError())
    const target = new URL(url)
    let session: ClientHttp2Session | undefined
    let settled = false
    const finish = (error: Error | null, value?: Http2Response) => {
      if (settled) return
      settled = true
      opts.signal.removeEventListener('abort', onAbort)
      session?.destroy()
      if (error) reject(error); else resolve(value!)
    }
    const onAbort = () => finish(abortError())
    opts.signal.addEventListener('abort', onAbort, { once: true })
    try {
      session = connect(target.origin)
      session.on('error', error => finish(error))
      const headers = Object.fromEntries(Object.entries(opts.headers).map(([key, value]) => [key.toLowerCase(), value]))
      const stream = session.request({ ':path': target.pathname + target.search, ...headers })
      const chunks: Buffer[] = []
      let status = 0, size = 0
      stream.on('response', response => { status = Number(response[':status']) })
      stream.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > opts.maxBytes) return finish(new Error('Response too large'))
        chunks.push(chunk)
      })
      stream.on('end', () => finish(null, { status, body: Buffer.concat(chunks).toString('utf8') }))
      stream.on('error', error => finish(error))
      stream.on('close', () => finish(new Error('Stream closed before the response finished')))
      stream.end()
    } catch (error) { finish(error as Error) }
  })
}
