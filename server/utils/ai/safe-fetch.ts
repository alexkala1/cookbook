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

// Offline sources for automated tests only: exact-URL matches, read at runtime so a production
// build can be driven by the E2E suite (E2E_TEST=true) without reaching the network.
const fixtureVideoDescription = [
  'Crispy outside, lemony and soft inside. A Greek taverna side for 4.',
  '',
  'Ingredients',
  '1 kg potatoes',
  '80 ml olive oil',
  '60 ml lemon juice',
  '250 ml water',
  '2 tsp dried oregano',
  '2 cloves garlic',
  '',
  'Method',
  '1. Prepare the potatoes',
  'Preheat your oven to 200°C. Peel the potatoes and cut them into thick wedges.',
  '2. Roast',
  'Toss with the oil, lemon, water, oregano and garlic, then roast for 60 minutes, turning once.',
  '3. Finish',
  'Rest for 5 minutes and spoon the pan juices over before serving.'
].join('\n')
export const testFixtures: Record<string, string> = {
  'https://fixtures.heirloom.test/recipe.html': '<!doctype html><html><head><title>Fasolakia Ladera · Heirloom fixture</title><script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Recipe', name: 'Fasolakia Ladera', description: 'Greek green beans braised in olive oil and tomato.',
    recipeYield: '4', recipeCuisine: 'Greek', totalTime: 'PT55M',
    recipeIngredient: ['500 g green beans', '400 g grated tomatoes', '120 ml olive oil', '1 onion', '2 potatoes', '1 tsp salt'],
    recipeInstructions: ['Soften the onion in the olive oil over medium heat.', 'Add the beans, potatoes and tomatoes, cover and simmer for 40 minutes.', 'Season with salt and rest for 10 minutes before serving.']
  }) + '</script></head><body><main><h1>Fasolakia Ladera</h1></main></body></html>',
  'https://www.youtube.com/watch?v=TESTVIDEO11': '<html><script>var ytInitialPlayerResponse = ' + JSON.stringify({
    playabilityStatus: { status: 'OK' }, videoDetails: { videoId: 'TESTVIDEO11', title: 'Patates Lemonates', shortDescription: fixtureVideoDescription }
  }) + ';</script></html>'
}
const fixturesEnabled = () => process.env.NODE_ENV === 'test' || process.env.E2E_TEST === 'true'

// Pin each connection to the inspected address. Revalidate every redirect; never forward BYOK headers.
export async function safeFetch(input: string, signal?: AbortSignal, redirects = 0): Promise<string> {
  if (redirects > 3) throw createError({ statusCode: 422, statusMessage: 'Too many source redirects' })
  if (fixturesEnabled() && Object.hasOwn(testFixtures, input)) return testFixtures[input]!
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
      if (response.statusCode === 403) {
        response.resume()
        reject(createError({ statusCode: 422, statusMessage: 'The website blocked automated recipe extraction (HTTP 403). Try copying the recipe text and pasting it into Scanned Card / Text instead.' }))
        return
      }
      if (response.statusCode === 404) {
        response.resume()
        reject(createError({ statusCode: 422, statusMessage: 'Recipe webpage not found (HTTP 404). Please verify the link or paste the text directly.' }))
        return
      }
      if (response.statusCode !== 200) {
        response.resume()
        reject(createError({ statusCode: 422, statusMessage: `Source website returned HTTP ${response.statusCode}. Paste the recipe text directly if the page is unreachable.` }))
        return
      }
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
