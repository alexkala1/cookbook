import { defineEventHandler, readBody, sendStream, setResponseHeaders } from 'h3'
import { ingest, ingestSchema } from '../../../utils/ai/ingest'
import { validate } from '../../../utils/validation'
import { aiClient } from '../../../utils/ai/client'

export default defineEventHandler(async event => {
  const input = validate(ingestSchema, await readBody(event))
  aiClient(event)
  const abort = new AbortController(), encoder = new TextEncoder()
  let output: ReadableStreamDefaultController<Uint8Array>
  let closed = false
  let heartbeat: ReturnType<typeof setInterval> | undefined
  const cleanup = () => { clearInterval(heartbeat); abort.abort() }
  const finish = () => { if (!closed) { closed = true; output.close() }; cleanup() }
  // Native streams avoid H3 1.x EventStream's unhandled writer.closed
  // rejection when a browser cancels its reader after an error event.
  const body = new ReadableStream<Uint8Array>({
    start(controller) { output = controller },
    cancel() { closed = true; cleanup() }
  })
  event.node.res.once('close', finish)
  const send = (name: string, data: unknown) => {
    if (!closed) output.enqueue(encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`))
  }
  heartbeat = setInterval(() => send('status', { message: 'Still working…' }), 10000)
  setResponseHeaders(event, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'private, no-cache, no-store, no-transform', 'X-Accel-Buffering': 'no' })
  void (async () => {
    try {
      send('status', { message: 'Starting recipe draft' })
      const result = await ingest(event, input, abort.signal, message => send('thought', { message }))
      if (abort.signal.aborted) return
      send('recipe_chunk', { title: result.recipe.title, ingredients: result.recipe.ingredients })
      send('complete', result)
    } catch (error) {
      const failure = error as { statusCode?: unknown, statusMessage?: unknown } | null
      const status = typeof failure?.statusCode === 'number' ? failure.statusCode : 500
      const actionable = (status >= 400 && status <= 504) && typeof failure?.statusMessage === 'string' && failure.statusMessage.trim()
      let msg = actionable ? String(failure!.statusMessage) : 'Could not create a draft. Check the source and AI settings, or try a memory prompt without a key.'
      if (status >= 500 && !msg.toLowerCase().includes('could not create a draft')) {
        msg = `Could not create a draft. ${msg}`
      }
      if (!abort.signal.aborted) send('error', { message: msg })
    } finally { finish() }
  })()
  return sendStream(event, body)
})
