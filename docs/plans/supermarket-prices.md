# Greek Supermarket Price Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]` checkboxes. Strict TDD: Phase 1 writes the failing suite first; do not touch implementation until it fails for the right reason.

**Goal:** Show a subtle "lowest Greek supermarket price" badge next to Supermarket items on `/market`, without ever blocking, erroring or shifting the list.

**Architecture:** `GET /api/market/prices?q=` proxies the public Greek government price API (`posokanei.gov.gr`) with a 2500 ms budget, a 24 h in-memory cache and a total-failure-is-HTTP-200 contract. Pure logic lives in `server/utils/market-prices.ts` (testable with stubbed `fetch` + fake timers); badge formatting lives in `app/utils/market-prices.ts`; `MarketShoppingList.vue` fetches lazily, at most 3 at a time, and renders into a pre-reserved slot.

**Tech Stack:** Nuxt 4 / Nitro (h3), zod 4, Vitest, Playwright (`scripts/e2e-user-flows.js`).

**Branch:** `feat/market-pantry-stocking` (shared worktree with other agents: `git diff` before editing; stage files by name, never `git add -A`).

## Verified upstream facts (probed 2026-09-30, from this machine)

- `GET https://api.posokanei.gov.gr/products?q=<term>&countries=GR&page=1&page_size=3` with a Chrome User-Agent → HTTP 200 JSON `{ "products": [...] }`, ~0.1–1 s.
- Product fields used: `id`, `name`, `brand`, `category`, `price_stats.min_price`, `retailer_prices[] = { retailer, retailer_display_name, price }` (e.g. `sklavenitis` / `Σκλαβενίτης`, `mymarket` / `My Market`, `masoutis` / `Μασούτης`). Many other fields exist; ignore them.
- **Relevance caveat:** upstream is fuzzy. `q=feta` returned a window cleaner ("AJAX Fête des Fleurs") first. `q=φετα` returns real feta. Hence the relevance filter in Phase 2 — without it the badge could show a cleaning-product price.
- **Privacy note:** the item name is sent server-side to a third-party government API (no cookies, no user data). Mention in UI title/aria only as "prices from posokanei.gov.gr".

## Global Constraints

- Route: `server/api/market/prices.get.ts`, `GET`, query `q` (string, trimmed, 1–80 chars after trim).
- Upstream URL built with `URL`/`URLSearchParams` on the fixed host `https://api.posokanei.gov.gr/products` — `q` is never concatenated into a host or path. Params exactly: `q`, `countries=GR`, `page=1`, `page_size=3`. Header `User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36` and `Accept: application/json`.
- Timeout **2500 ms** implemented with `AbortController` + `setTimeout` (NOT `AbortSignal.timeout`, so `vi.useFakeTimers()` controls it). Also cap response body at 512 KB.
- **Never** a non-200 for lookups: network error, DNS failure, non-2xx (403/429/5xx), timeout, invalid JSON, schema mismatch, blank/missing/over-long `q` → `200 { available: false, query, products: [] }`. No stack/upstream text in the body. No `console.error` with the query beyond a single `console.warn('[market-prices] lookup failed', reason)`.
- Response shape (exact):
  ```ts
  type PriceProduct = { id: string, name: string, brand: string, minPrice: number, retailers: { retailer: string, displayName: string, price: number }[] }
  type PriceResponse = { available: boolean, query: string, products: PriceProduct[] }
  ```
  `retailers` sorted ascending by `price` (ties keep upstream order); `minPrice` = `price_stats.min_price` if finite and > 0, else min of retailer prices; all prices finite, > 0, rounded to 2 decimals; products with no valid retailer price are dropped; at most 3 products; missing `brand` → `''`; missing `retailer_display_name` → the `retailer` id.
- `available: true` means upstream answered validly (even with `products: []`); `false` means the lookup failed.
- Relevance filter (server, before caching): fold(s) = `s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/ς/g,'σ')`; keep a product only if **every** query token (split on whitespace, length ≥ 2) is a substring of fold(`name + ' ' + brand + ' ' + category`). Latin queries therefore mostly yield `[]` → no badge. That is intended (correctness over coverage).
- Cache: module-level `Map<string, { at: number, body: PriceResponse }>`, key = fold(trimmed q). Success (`available:true`) TTL **24 h** (`86_400_000`); failure TTL **60 s** (stops hammering during an outage but recovers quickly); max 500 entries (evict oldest on insert). Concurrent identical in-flight lookups share one upstream `fetch` (in-flight `Map<string, Promise>`, cleared in `finally`). `query` in the response echoes the trimmed original `q`, not the folded key.
- Client: lookups only for items whose `destination.section === 'supermarket'` (both Market Route and One-Stop modes); max **3 concurrent** requests, max **30** lookups per list; skipped entirely when `navigator.onLine === false`; aborted on unmount; results held in a `Record<itemId, PriceBadge | null>`; each `$fetch` wrapped in try/catch that swallows errors silently (no `error` ref, no console error).
- **Zero layout shift:** every Supermarket item row renders a fixed-height slot (`min-h-6`, i.e. 1.5rem, `sm:ml-14` aligned with the existing notes block) from first paint; the badge fades in by `opacity` only (`transition-opacity`, honour `prefers-reduced-motion`). The row's bounding-box height must be identical before and after the badge appears.
- Badge: Hallmark style (same tokens as `vendorBadge.supermarket`: `border-sage/50 bg-sage/10 text-sage-ink`, `rounded-full border px-2.5 py-0.5 text-xs font-semibold`), text exactly `` `${displayName} ${price.toFixed(2)} €` `` (e.g. `Σκλαβενίτης 3.55 €`), wrapped in `<span lang="el">` for the retailer name; `title` and `aria-label`: `` `Lowest price found: ${product.name} at ${displayName}, ${price.toFixed(2)} euros (posokanei.gov.gr)` ``; `print:hidden`; not included in copy/WhatsApp/QR text.
- No new dependencies. Style: no semicolons, 2-space, compact handlers, matches neighbours.

## Review Focus

- `q=feta` (Latin) returns a cleaner first upstream → filter yields `[]`, `available:true`, UI omits badge (no wrong price ever shown).
- Upstream hangs forever (never resolves, honours abort) → exactly 2500 ms later `available:false`; route itself resolves, no unhandled rejection.
- Same query twice within 24 h → one `fetch`; after 24 h + 1 ms → a second `fetch`; failures retried after 60 s, not 24 h; cache key is accent/case-insensitive (`Φέτα` = `φετα`).
- Upstream returns HTML / `null` / `{products:[{}]}` / negative or `NaN` prices → `available:false` or dropped product, never a 500 or a bogus price.
- Item list of 40 supermarket items → at most 30 lookups, 3 in flight, list interactive meanwhile; toggling One-Stop/Market Route must not refetch an item already resolved; unmount mid-flight causes no state update or console error.
- Item name with `&`, `#`, `?`, emoji, 500 chars, or only spaces → properly encoded / rejected client-side (skip names that are blank or > 80 chars) and never breaks the URL.

---

## Phase 1: Failing acceptance suite

**Files:** Create `tests/market-supermarket-prices.test.ts`

**Interfaces (to be created in Phases 2–3; import paths are the contract):**
- `import prices from '../server/api/market/prices.get'` — h3 handler.
- `import { resetPriceCache } from '../server/utils/market-prices'` — clears cache + in-flight map (test-only hook, exported).
- `import { formatPriceBadge } from '../app/utils/market-prices'` — `(products: PriceProduct[]) => { text: string, label: string, retailer: string, price: number } | null`.

Harness (copy from `tests/ai-stream.test.ts`): `toWebHandler(createApp().use(prices))`, `call = q => handle(new Request('http://localhost/api/market/prices' + (q === undefined ? '' : '?q=' + encodeURIComponent(q))))`. `beforeEach(() => { resetPriceCache(); vi.useFakeTimers() })`, `afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })`. Fixture `upstream(products)` → `new Response(JSON.stringify({ products }))`; fixture product `feta200` = `{ id:'p1', name:'ΔΩΔΩΝΗ Φέτα ΠΟΠ 200g', brand:'ΔΩΔΩΝΗ', category:'Φέτα', price_stats:{min_price:3.55}, retailer_prices:[{retailer:'ab',retailer_display_name:'ΑΒ',price:3.69},{retailer:'sklavenitis',retailer_display_name:'Σκλαβενίτης',price:3.55}] }` plus extra noise fields (`images`, `updated_at`) to prove they're dropped.

- [ ] **Step 1: Write these `it(...)` cases**
  1. **Formatting:** `call('φετα')` → status 200; body `toEqual({ available:true, query:'φετα', products:[{ id:'p1', name:'ΔΩΔΩΝΗ Φέτα ΠΟΠ 200g', brand:'ΔΩΔΩΝΗ', minPrice:3.55, retailers:[{retailer:'sklavenitis',displayName:'Σκλαβενίτης',price:3.55},{retailer:'ab',displayName:'ΑΒ',price:3.69}] }] })` (sorted ascending, noise dropped).
  2. **Upstream request:** the stubbed `fetch` was called once with a URL whose `searchParams` are exactly `q=φετα`, `countries=GR`, `page=1`, `page_size=3`, host `api.posokanei.gov.gr`, and headers containing `User-Agent` matching `/Mozilla\/5\.0.*Chrome/`.
  3. **Caching:** two `call('φετα')` + `call('Φέτα ')` → `fetch` called once, identical bodies except `query` echo; `vi.advanceTimersByTime(86_400_000 + 1)` then `call('φετα')` → `fetch` called twice.
  4. **Concurrent dedupe:** `Promise.all([call('γαλα'), call('γαλα')])` with a deferred upstream → `fetch` called once, both bodies equal.
  5. **Timeout:** `fetch` stub returns a promise that rejects with `AbortError` when `init.signal` aborts, otherwise never settles; start `call('αλευρι')`, `await vi.advanceTimersByTimeAsync(2499)` → still pending (race with a sentinel), `advanceTimersByTimeAsync(1)` → resolves `200 { available:false, query:'αλευρι', products:[] }`.
  6. **Offline / errors → 200 fallback** (`it.each`): `fetch` rejects `TypeError('fetch failed')`; upstream 403; 429; 500; HTML body with 200; `{}` body; `{products:null}`. Each → status 200, `available:false`, `products:[]`, no `stack`/`error` key, body string contains no `posokanei`.
  7. **Failure cache is short:** after a 403, second call within 59 s → no new fetch; after 60 s + 1 ms → new fetch (and a now-good response gives `available:true`).
  8. **Empty result is success:** upstream `{products:[]}` → `available:true, products:[]`, cached 24 h.
  9. **Relevance:** `call('feta')` with the cleaner fixture (`name:'AJAX Fête des Fleurs Καθαριστικό Τζαμιών 750ml'`, category `Καθαρισμός Τζαμιών`) → `available:true, products:[]`. `call('φετα')` with `ΦΕΤΑ ΠΑΝΤΕΛΗ` (upper-case, tonos-free) still matches; accent-insensitive: query `γάλα` matches product `ΓΑΛΑ ΦΑΡΜΑ`; final sigma: `ελαιοσ`/`ελαιος` handled via fold.
  10. **Bad input:** missing `q`, `q=''`, `q='   '`, `q='x'.repeat(81)` → 200 fallback and `fetch` never called.
  11. **Validation of upstream data:** price `-1`, `NaN` (as `null`), `"3.55"` string → that retailer dropped; product with zero valid retailers dropped; `minPrice` falls back to min retailer price when `price_stats` missing; > 3 products returned → only 3 kept.
  12. **Injection:** `call('a&countries=US#x?y')` → `fetch` URL `searchParams.get('q') === 'a&countries=US#x?y'` and `countries === 'GR'`.
  13. **`formatPriceBadge`:** products `[feta200, other(4.10)]` → `{ text:'Σκλαβενίτης 3.55 €', retailer:'sklavenitis', price:3.55, label:'Lowest price found: ΔΩΔΩΝΗ Φέτα ΠΟΠ 200g at Σκλαβενίτης, 3.55 euros (posokanei.gov.gr)' }`; `3.5` → `'… 3.50 €'`; `[]` → `null`; cheaper retailer in second product wins; tie → first product.
  14. **Never throws into caller:** handler wrapped so `fetch` throwing synchronously (non-Promise) still returns the 200 fallback.
- [ ] **Step 2: Run, verify FAIL** (cannot resolve `prices.get` / `market-prices`):
  `cd /home/alex/repos/cookbook && npx vitest run tests/market-supermarket-prices.test.ts`
- [ ] **Step 3: Commit:** `git add tests/market-supermarket-prices.test.ts && git commit -m "test(market): failing acceptance suite for supermarket price enrichment"`

## Phase 2: Server util + route

**Files:** Create `server/utils/market-prices.ts`, `server/api/market/prices.get.ts`

**Interfaces — Produces:** `lookupPrices(rawQuery: unknown): Promise<PriceResponse>`, `resetPriceCache(): void`, types `PriceProduct`, `PriceResponse` (exported; the app util imports the types with `import type`).

- [ ] **Step 1:** `market-prices.ts`: zod *loose* upstream schema (`z.object({ products: z.array(z.object({...}).passthrough()) })` with every optional field tolerant); `fold`; `normalizeProduct(raw): PriceProduct | null`; `relevant(query, raw)`; cache/in-flight maps as specified; `fetchUpstream(query, signal)` reading the body via `response.text()` with the 512 KB cap. `lookupPrices` = validate q → cache hit? → in-flight? → `controller = new AbortController(); timer = setTimeout(() => controller.abort(), 2500)` → try/catch/finally (`clearTimeout`) → store in cache with TTL by `available`. Entire body in one outer `try/catch` returning the fallback so nothing can throw.
- [ ] **Step 2:** `prices.get.ts`:
  ```ts
  import { defineEventHandler, getQuery } from 'h3'
  import { lookupPrices } from '../../utils/market-prices'
  export default defineEventHandler(async event => lookupPrices(getQuery(event).q))
  ```
  (`q` given as an array → treated as invalid → fallback.) Never call `createError`.
- [ ] **Step 3: Run:** `npx vitest run tests/market-supermarket-prices.test.ts` → cases 1–12 and 14 PASS; 13 still fails (Phase 3).
- [ ] **Step 4: Commit:** `git add server/utils/market-prices.ts server/api/market/prices.get.ts && git commit -m "feat(market): cached, timeout-safe supermarket price lookup route"`

## Phase 3: Badge util + component

**Files:** Create `app/utils/market-prices.ts`; Modify `app/components/MarketShoppingList.vue` (script near `vendorBadge` ~L85-90; item `<li>` ~L256-276; no changes to `shoppingListText`/share code).

**Interfaces — Produces:** `formatPriceBadge` (signature in Phase 1). **Consumes:** `PriceResponse` from `server/utils/market-prices` (type import).

- [ ] **Step 1:** Implement `formatPriceBadge` (min over every product's retailers; ties keep first).
- [ ] **Step 2:** Script additions:
  ```ts
  const priceBadges = ref<Record<string, ReturnType<typeof formatPriceBadge>>>({})
  const priceAsked = new Set<string>()          // item ids already requested (no refetch on mode toggle)
  let priceQueue: { id: string, name: string }[] = [], priceActive = 0, priceCount = 0
  function pumpPrices() { while (!disposed && priceActive < 3 && priceQueue.length) { const job = priceQueue.shift()!; priceActive++; void lookupPrice(job).finally(() => { priceActive--; pumpPrices() }) } }
  async function lookupPrice({ id, name }: { id: string, name: string }) {
    try { const res = await $fetch<PriceResponse>('/api/market/prices', { query: { q: name }, signal: controller?.signal ?? priceController.signal }); if (!disposed) priceBadges.value[id] = res.available ? formatPriceBadge(res.products) : null } catch { /* Price is a bonus: stay silent. */ }
  }
  watch(routedList, value => { /* enqueue unseen supermarket items: trimmed name 1–80 chars, priceCount < 30, navigator.onLine !== false */ pumpPrices() }, { immediate: true })
  ```
  Use its own `AbortController` (`priceController`) aborted in `onBeforeUnmount`; reset `priceAsked`, `priceBadges`, `priceQueue`, `priceCount` inside `generate()` where the list is replaced. Skip when `props.importedList` is set? **No** — imported lists get prices too.
- [ ] **Step 3:** Template, inside each `<li>` after the existing `ml-0 mt-3 space-y-2 sm:ml-14` block, only `v-if="destination.section === 'supermarket'"`:
  ```html
  <div class="market-price ml-0 mt-2 min-h-6 sm:ml-14 print:hidden" data-testid="market-price-slot">
    <span v-if="priceBadges[item.id]" :key="item.id" data-testid="market-price" class="market-price__badge inline-flex items-center gap-1 rounded-full border border-sage/50 bg-sage/10 px-2.5 py-0.5 text-xs font-semibold text-sage-ink" :title="priceBadges[item.id]!.label" :aria-label="priceBadges[item.id]!.label"><UIcon name="i-lucide-tag" class="size-3.5" aria-hidden="true" /><span lang="el">{{ priceBadges[item.id]!.text }}</span></span>
  </div>
  ```
  Scoped CSS: `.market-price__badge { animation: market-price-in .2s ease-out }` with `@keyframes market-price-in { from { opacity: 0 } to { opacity: 1 } }` and `@media (prefers-reduced-motion: reduce) { .market-price__badge { animation: none } }`. The slot height is constant, so no shift; text must not wrap past the slot (`max-w-full truncate` if needed; verify at 375 px).
- [ ] **Step 4: Run:** `npx vitest run tests/market-supermarket-prices.test.ts` → **all** PASS. `npm run typecheck` → 0 errors.
- [ ] **Step 5: Commit:** `git add app/utils/market-prices.ts app/components/MarketShoppingList.vue && git commit -m "feat(market): supermarket price badge with reserved slot"`

## Phase 4: E2E + full verification

**Files:** Modify `scripts/e2e-user-flows.js` (append steps to the Flow 4 market block, after the QR/share steps; follow the existing `step(page, viewport, name, async () => {...})` and `page.route(...)` interception pattern used at L941).

- [ ] **Step 1: E2E steps.** Before generating the list: `page.route('**/api/market/prices*', route => route.fulfill({ json: <feta200-shaped PriceResponse for q=φετα, else { available:false, query, products:[] }> }))`, with a ≥300 ms artificial delay on the first response. Assertions: (a) a supermarket item named with a Greek product term shows `[data-testid="market-price"]` with text `Σκλαβενίτης 3.55 €`; (b) **no layout shift**: record `li.getBoundingClientRect().height` of that item and of a no-badge item *before* the badge appears and *after*; equal to 0 px; document height unchanged; (c) items with `available:false` have an empty `market-price-slot` and no `[role=alert]`; (d) `page.context().setOffline(true)` + regenerate → list works, zero badges, no console errors; (e) "Copy shopping list" text contains no `€`; (f) touch-target helper still passes at mobile; (g) desktop + mobile screenshots `market-price-badge`.
- [ ] **Step 2: Run, in this order (all must be green):**
  ```bash
  cd /home/alex/repos/cookbook
  npx vitest run tests/market-supermarket-prices.test.ts
  npm test
  npm run typecheck
  npm run build && npm run test:e2e
  ```
  Expected: new suite PASS; `npm test` no regressions vs. the count before you started (record it first with `npm test 2>&1 | tail -5`); typecheck 0 errors; E2E all steps green with the new step visible in the log.
- [ ] **Step 3: Live smoke (optional, needs internet):** `npm run dev`, then
  `curl -s 'http://localhost:3000/api/market/prices?q=%CF%86%CE%B5%CF%84%CE%B1' | head -c 600` → `available:true` with feta products; repeat (second call instant = cache); `curl -s 'http://localhost:3000/api/market/prices?q=feta'` → `available:true`, `products:[]`; with networking disabled → `{"available":false,...}` and HTTP 200 (`curl -o /dev/null -w '%{http_code}'`).
- [ ] **Step 4:** `git diff` review: no unrelated churn, no new deps, no `console.error` added; then report pass counts.

## Acceptance Criteria (summary)

1. `GET /api/market/prices?q=…` always answers HTTP 200 with the exact `PriceResponse` shape; failure modes (network, 403/429/5xx, timeout at 2500 ms, bad JSON, bad `q`) yield `available:false, products:[]`.
2. Identical queries (case/accent-insensitive) hit upstream once per 24 h; failures retry after 60 s; concurrent duplicates share one request.
3. Only relevant products are returned; a Latin query that upstream matches to an unrelated product shows no badge.
4. Badge text is `<Retailer> <price with 2 decimals> €` for the cheapest retailer across returned products; omitted while loading, offline, unavailable or empty.
5. Zero layout shift: Supermarket item rows have a constant height with or without a badge (E2E-measured, desktop and 375 px); no console errors or alerts from price failures.
6. Commands green: `npx vitest run tests/market-supermarket-prices.test.ts`, `npm test`, `npm run typecheck`, `npm run build && npm run test:e2e`.

## Assumptions (change only if the owner objects)

- Coverage is deliberately Greek-name-first: English item names (`feta`, `milk`) often yield no badge because the relevance filter prefers no price over a wrong one. A later phase could add an EN→EL term map.
- "Lowest price" is the lowest single-retailer package price across up to 3 matched products; package size is disclosed only in the badge `title`/`aria-label`, not compared per kg.
- No persistence, no DB, no settings toggle in v1; in-memory cache resets on server restart.
- The upstream is an unauthenticated public government endpoint with no documented SLA; the graceful-failure contract means its disappearance simply removes the badges.
