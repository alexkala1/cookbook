import { createError, defineEventHandler, getRequestHeader, getRequestURL } from 'h3'

export default defineEventHandler(event => {
  // Check reads too: DNS rebinding can otherwise expose local data via GET.
  // Match literal hostnames, never URL-normalized IP aliases or forwarded headers.
  const host = getRequestHeader(event, 'host')
  const authority = host?.match(/^(\[[a-f0-9:]+\]|[a-z0-9.-]+)(?::([0-9]{1,5}))?$/i)
  const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]'])
  const publicHost = process.env.HEIRLOOM_PUBLIC_HOST?.trim().toLowerCase()
  if (publicHost) allowedHosts.add(publicHost)
  if (!authority || !allowedHosts.has(authority[1]!.toLowerCase()) ||
    (authority[2] !== undefined && (Number(authority[2]) < 1 || Number(authority[2]) > 65535))) {
    throw createError({ statusCode: 403, statusMessage: 'Host not allowed' })
  }

  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.method)) return

  // Compare with the direct connection, never attacker-supplied forwarded headers.
  const target = getRequestURL(event, { xForwardedHost: false, xForwardedProto: false })
  const origin = getRequestHeader(event, 'origin')
  const referer = getRequestHeader(event, 'referer')
  const sources = [origin, referer].filter((value): value is string => value !== undefined)
  const forbidden = () => createError({ statusCode: 403, statusMessage: 'Same-origin request required' })
  if (!sources.length || getRequestHeader(event, 'sec-fetch-site') === 'cross-site') throw forbidden()

  for (const source of sources) {
    let url: URL
    try { url = new URL(source) } catch { throw forbidden() }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.origin !== target.origin) throw forbidden()
  }
  // Origin is an origin only, unlike Referer which may include a path and query.
  if (origin && new URL(origin).href !== new URL(origin).origin + '/') throw forbidden()
})
