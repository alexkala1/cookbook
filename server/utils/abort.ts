import type { H3Event } from 'h3'

export function requestSignal(event: H3Event): AbortSignal {
  const controller = new AbortController()
  if (event.node.res.destroyed || event.node.res.writableEnded) {
    controller.abort()
    return controller.signal
  }
  event.node.res.once('close', () => controller.abort())
  return controller.signal
}
