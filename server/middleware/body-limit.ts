import { createError, defineEventHandler, getRequestHeader, getRequestURL } from 'h3'

export default defineEventHandler(event => {
  if (!['POST', 'PUT', 'PATCH'].includes(event.method)) return
  const path = getRequestURL(event, { xForwardedHost: false, xForwardedProto: false }).pathname
  const max = path === '/api/backup/import' ? 31_000_000
    : ['/api/ingest/ocr', '/api/ai/recipe/stream'].includes(path) ? 11_000_000
      : /^\/api\/recipes(?:\/|$)/.test(path) ? 4_000_000 : 2_000_000
  const declared = Number(getRequestHeader(event, 'content-length'))
  if (Number.isFinite(declared) && declared > max) {
    event.node.res.setHeader('Connection', 'close')
    throw createError({ statusCode: 413, statusMessage: `Request body exceeds ${Math.round(max / 1e6)} MB limit` })
  }
})
