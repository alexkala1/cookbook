import { lookup } from 'node:dns/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import ipaddr from 'ipaddr.js'
import { createError } from 'h3'

export function publicAddress(address: string) {
  try { return ipaddr.process(address).range() === 'unicast' } catch { return false }
}
export async function resolvePublicUrl(input: string) {
  let url: URL
  try { url = new URL(input) } catch { throw createError({ statusCode: 400, statusMessage: 'Invalid source URL' }) }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) {
    throw createError({ statusCode: 400, statusMessage: 'Only public HTTP(S) sources on standard ports are supported' })
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) throw createError({ statusCode: 400, statusMessage: 'Local source host blocked' })
  let addresses: { address: string, family: number }[]
  try { addresses = ipaddr.isValid(hostname) ? [{ address: hostname, family: ipaddr.parse(hostname).kind() === 'ipv4' ? 4 : 6 }] : await lookup(hostname, { all: true }) }
  catch { throw createError({ statusCode: 422, statusMessage: 'Source hostname could not be resolved' }) }
  if (!addresses.length || addresses.some(item => !publicAddress(item.address))) throw createError({ statusCode: 400, statusMessage: 'Private or reserved source address blocked' })
  return { url, address: addresses[0]! }
}

// Pin each connection to the inspected address. Revalidate every redirect; never forward BYOK headers.
export async function safeFetch(input: string, signal?: AbortSignal, redirects = 0): Promise<string> {
  if (redirects > 3) throw createError({ statusCode: 422, statusMessage: 'Too many source redirects' })
  const { url, address } = await resolvePublicUrl(input)
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      signal, family: address.family, headers: { 'User-Agent': 'Heirloom/1.0', Accept: 'text/html, application/json, text/xml, text/plain', 'Accept-Encoding': 'identity' },
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family)
    }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0) && response.headers.location) {
        response.resume()
        try { safeFetch(new URL(response.headers.location, url).href, signal, redirects + 1).then(resolve, reject) }
        catch { reject(createError({ statusCode: 422, statusMessage: 'Invalid source redirect' })) }
        return
      }
      if (response.statusCode !== 200) { response.resume(); reject(createError({ statusCode: 422, statusMessage: 'Source could not be retrieved' })); return }
      const chunks: Buffer[] = []
      let size = 0
      response.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > 2_000_000) request.destroy(new Error('Source too large'))
        else chunks.push(chunk)
      })
      response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      response.on('error', () => reject(createError({ statusCode: 422, statusMessage: 'Source connection interrupted' })))
    })
    const timer = setTimeout(() => request.destroy(new Error('Source timed out')), 15000)
    request.on('close', () => clearTimeout(timer))
    request.on('error', () => reject(createError({ statusCode: 422, statusMessage: 'Source unavailable, too large, or timed out' })))
    request.end()
  })
}
