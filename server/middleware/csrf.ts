import { createError, defineEventHandler, getRequestHeader, getRequestURL } from 'h3'

// Canonical dotted-quad only (no leading zeros), so 127.1, 2130706433 and 0x7f000001 never match.
const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)'
const PRIVATE_IPV4 = new RegExp(`^(?:10\\.${OCTET}\\.${OCTET}\\.${OCTET}|192\\.168\\.${OCTET}\\.${OCTET}|172\\.(?:1[6-9]|2\\d|3[01])\\.${OCTET}\\.${OCTET})$`)

export default defineEventHandler(event => {
  // Check reads too: DNS rebinding can otherwise expose local data via GET.
  // Match literal hostnames, never URL-normalized IP aliases or forwarded headers.
  const host = getRequestHeader(event, 'host')
  const authority = host?.match(/^(\[[a-f0-9:]+\]|[a-z0-9.-]+)(?::([0-9]{1,5}))?$/i)
  const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]'])
  for (const publicHost of (process.env.HEIRLOOM_PUBLIC_HOST ?? '').split(',')) {
    const configured = publicHost.trim().toLowerCase()
    // Accept exact HTTP(S) origins without URL-normalizing alternate IP spellings.
    // Paths, credentials, queries, wildcards and invalid ports never add a host.
    const origin = configured.match(/^https?:\/\/(\[[a-f0-9:]+\]|[a-z0-9.-]+)(?::([0-9]{1,5}))?\/?$/)
    if (configured.includes('://') && (!origin || (origin[2] !== undefined && (Number(origin[2]) < 1 || Number(origin[2]) > 65535)))) continue
    const bareHost = configured.match(/^(\[[a-f0-9:]+\]|[a-z0-9.-]+)(?::([0-9]{1,5}))?$/)
    if (bareHost?.[2] !== undefined && (Number(bareHost[2]) < 1 || Number(bareHost[2]) > 65535)) continue
    const name = origin?.[1] ?? bareHost?.[1]
    if (name) allowedHosts.add(name)
  }
  const hostname = authority?.[1]!.toLowerCase() ?? ''
  // A literal LAN IP is not rebindable (DNS is not involved); HEIRLOOM_ALLOW_LAN=true also admits mDNS *.local names.
  const lanHost = PRIVATE_IPV4.test(hostname) || (process.env.HEIRLOOM_ALLOW_LAN === 'true' && /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.local$/.test(hostname))
  if (!authority || !(allowedHosts.has(hostname) || lanHost) ||
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
