import { z } from 'zod'

export type PriceProduct = { id: string, name: string, brand: string, minPrice: number, retailers: { retailer: string, displayName: string, price: number }[] }
export type PriceResponse = { available: boolean, query: string, products: PriceProduct[] }

const endpoint = 'https://api.posokanei.gov.gr/products'
const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const TIMEOUT_MS = 2500, MAX_BODY = 512 * 1024, MAX_ENTRIES = 500, MAX_PRODUCTS = 3
const SUCCESS_TTL = 86_400_000, FAILURE_TTL = 60_000

const cache = new Map<string, { at: number, ttl: number, body: PriceResponse }>()
const inflight = new Map<string, Promise<PriceResponse>>()
export function resetPriceCache() { cache.clear(); inflight.clear() }

const upstreamSchema = z.object({ products: z.array(z.unknown()) })
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ς/g, 'σ')
const text = (value: unknown) => typeof value === 'string' ? value : ''
const price = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null
const unavailable = (query: string): PriceResponse => ({ available: false, query, products: [] })

function normalizeProduct(raw: unknown): PriceProduct | null {
  if (!raw || typeof raw !== 'object') return null
  const product = raw as Record<string, any>
  const retailers = (Array.isArray(product.retailer_prices) ? product.retailer_prices : []).flatMap((row: any) => {
    const value = price(row?.price), retailer = text(row?.retailer)
    return value === null || !retailer ? [] : [{ retailer, displayName: text(row.retailer_display_name) || retailer, price: value }]
  }).sort((a: { price: number }, b: { price: number }) => a.price - b.price)
  const id = text(product.id), name = text(product.name)
  if (!retailers.length || !id || !name) return null
  return { id, name, brand: text(product.brand), minPrice: price(product.price_stats?.min_price) ?? retailers[0]!.price, retailers }
}

function relevant(tokens: string[], raw: unknown) {
  const product = raw as Record<string, unknown> | null
  const haystack = fold(`${text(product?.name)} ${text(product?.brand)} ${text(product?.category)}`)
  return tokens.every(token => haystack.includes(token))
}

async function fetchUpstream(query: string): Promise<PriceResponse> {
  const url = new URL(endpoint)
  for (const [key, value] of Object.entries({ q: query, countries: 'GR', page: '1', page_size: String(MAX_PRODUCTS) })) url.searchParams.set(key, value)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url.toString(), { headers: { 'User-Agent': userAgent, Accept: 'application/json' }, signal: controller.signal })
    if (!response.ok) return unavailable(query)
    const body = await response.text()
    if (body.length > MAX_BODY) return unavailable(query)
    const parsed = upstreamSchema.safeParse(JSON.parse(body))
    if (!parsed.success) return unavailable(query)
    const tokens = fold(query).split(/\s+/).filter(token => token.length >= 2)
    const products = parsed.data.products.filter(raw => relevant(tokens, raw)).map(normalizeProduct).filter((p): p is PriceProduct => p !== null).slice(0, MAX_PRODUCTS)
    return { available: true, query, products }
  } catch { return unavailable(query) } finally { clearTimeout(timer) }
}

export async function lookupPrices(rawQuery: unknown): Promise<PriceResponse> {
  try {
    const query = typeof rawQuery === 'string' ? rawQuery.trim() : ''
    if (!query || query.length > 80) return unavailable(query.slice(0, 80))
    const key = fold(query)
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < hit.ttl) return { ...hit.body, query }
    const running = inflight.get(key)
    if (running) return { ...await running, query }
    const job = fetchUpstream(query).then(body => {
      if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!)
      cache.set(key, { at: Date.now(), ttl: body.available ? SUCCESS_TTL : FAILURE_TTL, body })
      return body
    }).finally(() => inflight.delete(key))
    inflight.set(key, job)
    return await job
  } catch (cause) {
    console.warn('[market-prices] lookup failed', cause instanceof Error ? cause.name : 'unknown')
    return unavailable('')
  }
}
