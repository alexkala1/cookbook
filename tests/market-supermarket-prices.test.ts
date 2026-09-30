import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp, toWebHandler } from 'h3'
import prices from '../server/api/market/prices.get'
import { resetPriceCache } from '../server/utils/market-prices'
import { formatPriceBadge } from '../app/utils/market-prices'

const handle = toWebHandler(createApp().use(prices))
const call = (q?: string) => handle(new Request('http://localhost/api/market/prices' + (q === undefined ? '' : '?q=' + encodeURIComponent(q))))
const feta200 = {
  id: 'p1', name: 'ΔΩΔΩΝΗ Φέτα ΠΟΠ 200g', brand: 'ΔΩΔΩΝΗ', category: 'Φέτα', images: [], updated_at: '2026-09-30',
  price_stats: { min_price: 3.55 },
  retailer_prices: [
    { retailer: 'ab', retailer_display_name: 'ΑΒ', price: 3.69 },
    { retailer: 'sklavenitis', retailer_display_name: 'Σκλαβενίτης', price: 3.55 }
  ]
}
const cleaner = { id: 'c1', name: 'AJAX Fête des Fleurs Καθαριστικό Τζαμιών 750ml', brand: 'AJAX', category: 'Καθαρισμός Τζαμιών', price_stats: { min_price: 2.48 }, retailer_prices: [{ retailer: 'mymarket', retailer_display_name: 'My Market', price: 2.48 }] }
const upstream = (products: unknown[], status = 200) => new Response(JSON.stringify({ products }), { status })
const stubFetch = (impl: (...args: any[]) => unknown) => { const spy = vi.fn(impl); vi.stubGlobal('fetch', spy); return spy }
const fallback = (query: string) => ({ available: false, query, products: [] })

beforeEach(() => { resetPriceCache(); vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('returns lowest-first retailers and drops upstream noise', async () => {
  stubFetch(async () => upstream([feta200]))
  const response = await call('φετα')
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ available: true, query: 'φετα', products: [{
    id: 'p1', name: 'ΔΩΔΩΝΗ Φέτα ΠΟΠ 200g', brand: 'ΔΩΔΩΝΗ', minPrice: 3.55,
    retailers: [{ retailer: 'sklavenitis', displayName: 'Σκλαβενίτης', price: 3.55 }, { retailer: 'ab', displayName: 'ΑΒ', price: 3.69 }]
  }] })
})

it('queries the government API with fixed params and a browser user agent', async () => {
  const spy = stubFetch(async () => upstream([feta200]))
  await call('φετα')
  expect(spy).toHaveBeenCalledTimes(1)
  const url = new URL(String(spy.mock.calls[0]![0]))
  expect(url.host).toBe('api.posokanei.gov.gr')
  expect(Object.fromEntries(url.searchParams)).toEqual({ q: 'φετα', countries: 'GR', page: '1', page_size: '3' })
  expect(spy.mock.calls[0]![1].headers['User-Agent']).toMatch(/Mozilla\/5\.0.*Chrome/)
})

it('caches for 24 hours, case and accent insensitively', async () => {
  const spy = stubFetch(async () => upstream([feta200]))
  const first = await (await call('φετα')).json()
  const second = await (await call('Φέτα ')).json()
  expect(spy).toHaveBeenCalledTimes(1)
  expect(second.products).toEqual(first.products)
  await vi.advanceTimersByTimeAsync(86_400_000 + 1)
  await call('φετα')
  expect(spy).toHaveBeenCalledTimes(2)
})

it('shares one upstream request between concurrent identical lookups', async () => {
  let release!: () => void
  const spy = stubFetch(() => new Promise(resolve => { release = () => resolve(upstream([feta200])) }))
  const both = Promise.all([call('γαλα'), call('γαλα')])
  await vi.advanceTimersByTimeAsync(0)
  release()
  const [a, b] = await both
  expect(spy).toHaveBeenCalledTimes(1)
  expect(await a.json()).toEqual(await b.json())
})

it('gives up after exactly 2500ms with a graceful 200', async () => {
  stubFetch((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))))
  let settled = false
  const pending = call('αλευρι').then(response => { settled = true; return response })
  await vi.advanceTimersByTimeAsync(2499)
  expect(settled).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  const response = await pending
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(fallback('αλευρι'))
})

it.each([
  ['offline', () => { throw new TypeError('fetch failed') }],
  ['rejected', async () => { throw new TypeError('fetch failed') }],
  ['403', async () => new Response('blocked', { status: 403 })],
  ['429', async () => new Response('slow down', { status: 429 })],
  ['500', async () => new Response('boom', { status: 500 })],
  ['html body', async () => new Response('<html>hi</html>', { status: 200 })],
  ['empty object', async () => new Response('{}', { status: 200 })],
  ['null products', async () => new Response('{"products":null}', { status: 200 })]
])('degrades to available:false with HTTP 200 when upstream is %s', async (_name, impl) => {
  stubFetch(impl)
  const response = await call('φετα')
  expect(response.status).toBe(200)
  const text = await response.text()
  expect(JSON.parse(text)).toEqual(fallback('φετα'))
  expect(text).not.toMatch(/posokanei|stack/i)
})

it('caches failures for only 60 seconds', async () => {
  const spy = stubFetch(async () => new Response('blocked', { status: 403 }))
  await call('φετα')
  await vi.advanceTimersByTimeAsync(59_000)
  await call('φετα')
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockImplementation(async () => upstream([feta200]))
  await vi.advanceTimersByTimeAsync(1_001)
  expect((await (await call('φετα')).json()).available).toBe(true)
  expect(spy).toHaveBeenCalledTimes(2)
})

it('treats an empty upstream result as a cached success', async () => {
  const spy = stubFetch(async () => upstream([]))
  expect(await (await call('φετα')).json()).toEqual({ available: true, query: 'φετα', products: [] })
  await vi.advanceTimersByTimeAsync(3_600_000)
  await call('φετα')
  expect(spy).toHaveBeenCalledTimes(1)
})

it('keeps only products relevant to the query', async () => {
  stubFetch(async () => upstream([cleaner]))
  expect(await (await call('feta')).json()).toEqual({ available: true, query: 'feta', products: [] })
  resetPriceCache()
  stubFetch(async () => upstream([{ ...feta200, name: 'ΦΕΤΑ ΠΑΝΤΕΛΗ 800g', brand: 'ΠΑΝΤΕΛΗ' }]))
  expect((await (await call('φετα')).json()).products).toHaveLength(1)
  resetPriceCache()
  stubFetch(async () => upstream([{ ...feta200, id: 'm1', name: 'ΓΑΛΑ ΦΑΡΜΑ 1L', brand: 'ΦΑΡΜΑ', category: 'Γάλα' }]))
  expect((await (await call('γάλα')).json()).products).toHaveLength(1)
})

it.each([[undefined], [''], ['   '], ['x'.repeat(81)]])('rejects bad input %j without contacting upstream', async q => {
  const spy = stubFetch(async () => upstream([feta200]))
  const response = await call(q)
  expect(response.status).toBe(200)
  expect((await response.json()).available).toBe(false)
  expect(spy).not.toHaveBeenCalled()
})

it('drops invalid prices and products, falls back to the cheapest retailer and caps at three products', async () => {
  stubFetch(async () => upstream([
    { ...feta200, id: 'a', price_stats: undefined, retailer_prices: [{ retailer: 'x', retailer_display_name: 'X', price: -1 }, { retailer: 'y', retailer_display_name: 'Y', price: null }, { retailer: 'z', retailer_display_name: 'Z', price: '3.55' }, { retailer: 'ab', price: 4.2 }] },
    { ...feta200, id: 'b', retailer_prices: [{ retailer: 'x', price: 'free' }] },
    { ...feta200, id: 'c' }, { ...feta200, id: 'd' }, { ...feta200, id: 'e' }
  ]))
  const body = await (await call('φετα')).json()
  expect(body.products.map((p: { id: string }) => p.id)).toEqual(['a', 'c', 'd'])
  expect(body.products[0]).toMatchObject({ minPrice: 4.2, retailers: [{ retailer: 'ab', displayName: 'ab', price: 4.2 }] })
})

it('never lets the query alter the upstream URL', async () => {
  const spy = stubFetch(async () => upstream([]))
  await call('a&countries=US#x?y')
  const url = new URL(String(spy.mock.calls[0]![0]))
  expect(url.searchParams.get('q')).toBe('a&countries=US#x?y')
  expect(url.searchParams.get('countries')).toBe('GR')
})

it('formats the lowest price badge across products', () => {
  const product = (over: object) => ({ id: 'p', name: 'Φέτα', brand: '', minPrice: 1, retailers: [], ...over }) as any
  const a = product({ id: 'p1', name: 'ΔΩΔΩΝΗ Φέτα ΠΟΠ 200g', retailers: [{ retailer: 'sklavenitis', displayName: 'Σκλαβενίτης', price: 3.55 }, { retailer: 'ab', displayName: 'ΑΒ', price: 3.69 }] })
  const b = product({ id: 'p2', retailers: [{ retailer: 'masoutis', displayName: 'Μασούτης', price: 4.1 }] })
  expect(formatPriceBadge([a, b])).toEqual({ text: 'Σκλαβενίτης 3.55 €', retailer: 'sklavenitis', price: 3.55, label: 'Lowest price found: ΔΩΔΩΝΗ Φέτα ΠΟΠ 200g at Σκλαβενίτης, 3.55 euros (posokanei.gov.gr)' })
  expect(formatPriceBadge([product({ retailers: [{ retailer: 'ab', displayName: 'ΑΒ', price: 3.5 }] })])?.text).toBe('ΑΒ 3.50 €')
  expect(formatPriceBadge([])).toBeNull()
  const cheaper = product({ id: 'p3', name: 'Cheaper', retailers: [{ retailer: 'mymarket', displayName: 'My Market', price: 2 }] })
  expect(formatPriceBadge([a, cheaper])?.retailer).toBe('mymarket')
  const tie = product({ id: 'p4', retailers: [{ retailer: 'ab', displayName: 'ΑΒ', price: 3.55 }] })
  expect(formatPriceBadge([a, tie])?.retailer).toBe('sklavenitis')
})
