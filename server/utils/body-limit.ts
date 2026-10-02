import { createError, getRequestHeader, type H3Event } from 'h3'

export async function readJsonLimited(event: H3Event, max: number): Promise<unknown> {
  const tooLarge = () => {
    event.node.res.setHeader('Connection', 'close')
    return createError({ statusCode: 413, statusMessage: `Request body exceeds ${Math.round(max / 1e6)} MB limit` })
  }
  const declared = Number(getRequestHeader(event, 'content-length'))
  if (Number.isFinite(declared) && declared > max) throw tooLarge()
  const chunks: Buffer[] = []
  let size = 0
  const consume = (chunk: Uint8Array | string) => {
    size += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.byteLength
    if (size > max) throw tooLarge()
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const webBody = event.web?.request?.body || event._requestBody
  if (webBody) {
    const stream = webBody instanceof ReadableStream ? webBody : new Response(webBody).body!
    const reader = stream.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        consume(value)
      }
    } finally {
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
  } else {
    for await (const chunk of event.node.req.iterator({ destroyOnReturn: false })) consume(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw createError({ statusCode: 400, statusMessage: 'Bad Request' }) }
}
