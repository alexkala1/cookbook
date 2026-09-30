# Market List: Simple UI + Pantry Deduction + Live Price Transport

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Strict TDD (failing test first, watch it fail). Four phases, in order; each ends green and committed.

**Goal:** Make `/market` calm and fast to use (3 items ≈ one mobile screen), let the cook optionally subtract what is already in the pantry, and make the Greek supermarket price badge actually light up.

**Architecture:** (A) replace `fetch` in `server/utils/market-prices.ts` with a tiny `node:http2` GET helper, because the gov API's WAF fingerprints the client. (B) a pure function `applyPantryStock` subtracts pantry stock from a generated list on the client. (C) restructure `MarketShoppingList.vue` into compact rows, one Share menu, collapsed notes and a sticky mobile bar. (D) wire the pantry toggle into the new UI.

**Tech Stack:** Nuxt 4.5 / Nitro, Vue 3 `<script setup>`, Vitest 4, Playwright E2E (`scripts/e2e-user-flows.js`), Node 24 `node:http2`.

**Isolation:** the main checkout is shared with other agents and has screenshot churn. Work in a worktree: `cd /home/alex/repos/cookbook && git worktree add ../cookbook-market-ui -b feat/market-simplify-pantry-prices master && cd ../cookbook-market-ui && npm ci` (or symlink `node_modules` from the main checkout if `npm ci` is slow). Stage files by name; never `git add -A`; do not commit `docs/screenshots/**` churn (write E2E shots elsewhere: `E2E_SCREENSHOT_DIR=/tmp/market-ui-shots`).

**Baseline:** `npm test` = 54 files / 1124 tests green on master (`4cd6385`). Record the count before you start.

## Decisions (answered by `jev pick`, 2026-09-30; follow them)

| Question | Decision |
|---|---|
| Live-price transport | **`node:http2` client** inside `fetchUpstream` (pure Node, no subprocess) |
| Deduct-pantry default | **OFF**, opt-in, choice remembered on this device |
| Deducted items presentation | **Collapsed** "Already in your pantry (N)" group at the bottom; partials show reduced amount + "Have 200 g" note |
| Item row | **Compact**: one line (checkbox, amount + name, price badge); counter phrase, buy size, surplus, note, prep notes behind a per-item **Details** disclosure, closed by default |
| Action bar | **Menu**: visible `Copy shopping list` + one **Share** menu (WhatsApp, Send to phone, Print or save PDF); `Restock pantry (N)` only when items are ticked; progress inline |
| Explanatory text / Prepare ahead | **Collapse**: one short line; Prepare ahead in a disclosure showing its count |
| Shop heading | **Merge**: one row = icon, shop name, Greek name, `N items`, reorder arrows; remove the separate Greek-name pill |
| "Shop at" mover | **Stays visible** on every row (jev). Ruling: render it as a compact inline select (no block label, `aria-label="Destination for <name>"` kept, `min-h-11`) so rows stay short |
| Mobile | **Sticky bottom bar** with `N of M bought` and the primary Copy action, clearing the tab bar |

## Verified facts (probed 2026-09-30)

- `api.posokanei.gov.gr/products?q=φετα&countries=GR&page=1&page_size=3`: Node `fetch` → 403; Node `https.get` (HTTP/1.1) → 403, even with browser headers. **Node `http2` with a browser `User-Agent` → 200 (5.5 KB JSON)**, repeated. `curl` with a browser UA → 200 on h1.1 and h2; curl with its default UA → 403; `http2` with no UA → 403. So the WAF needs a browser UA **and** a non-Node-HTTP/1.1 TLS/ALPN fingerprint. Cause is fingerprinting, so this can change: the route must keep degrading to `available:false`.
- `server/api/grocery/generate.post.ts` schema is `.strict()` and deliberately rejects pantry deduction. **Do not change the server or DB for pantry deduction**; it is computed client-side on the generated list (keeps persisted grocery lists factual).
- Existing pantry primitives to reuse: `ingredientKey`, `pantryQuantity(amount, from, to)` (returns `null` for incompatible units), `PantryItem` in `shared/culinary/pantry.ts`; `GET /api/pantry` returns `PantryItem[]`. Expired stock (`expiresAt <= now`) and `quantity <= 0` are ignored (same rule as `matchPantry`).
- E2E contract to preserve or consciously update: checkbox `Bought: <name>`, select `Destination for <name>`, headings named exactly the shop name (`Laiki market`, `Butcher`, `Supermarket`), buttons `Generate Market Shopping List`, `Market Route`, `One-Stop Supermarket`, `Move <shop> up/down`, `Copy shopping list`, `Restock pantry (N)`, `Share on WhatsApp`, `Send to phone`, `Print or save PDF`, test ids `market-price-slot` / `market-price` (badge slot must stay reserved: no layout shift).

## Global Constraints

- No new dependencies. No semicolons, 2-space, compact handlers, match neighbours. Nuxt UI / Tailwind tokens as already used (`button-secondary`, `filter-pill`, `border-rule`, `bg-paper-2`, etc.).
- Every interactive target ≥ 44×44 px (`min-h-11 min-w-11`); works at 375 px with no horizontal scroll; keyboard reachable; visible focus; native `<details>`/`<summary>` for disclosures; menus follow the existing `More` menu pattern in `app/pages/recipes/[id]/index.vue` (`<details class="more-menu">`, Esc closes, `onClickOutside`).
- Prices, pantry notes and the Details content never enter copy/WhatsApp/QR text, except that deducted amounts are what gets copied (you share what you must buy).
- Nothing is silently lost: every deducted item remains visible in the collapsed pantry group; failures to read the pantry or prices never raise blocking errors.
- Printing still works (`html[data-print='market']` rules in the component's unscoped `<style>`); new controls get `print:hidden`; open Details do not print.

## Review Focus

- Pantry has `200 g feta`, list needs `150 g` → item moves to the pantry group with "Have 200 g"; list needs `300 g` → row shows `100 g` and "Have 200 g", and the stale `counterPhrase` / `packageSizeToBuy` / `surplusLeftoverTip` (derived from 300 g) are dropped.
- Incompatible units (pantry `2 item` eggs vs list `120 g`) → **not** deducted (never guess), row unchanged.
- Two list items with the same ingredient key draw from one shared stock (no double counting); expired stock ignored; `amount === 0` ("as needed") item covered iff any in-date stock exists.
- Toggling deduct off restores every amount; checked ids survive toggling; a covered item that was ticked stays consistent (`N of M bought` counts only visible list items).
- Pantry fetch fails or is empty → toggle shows one inline note ("Couldn't read your pantry"/"Your pantry is empty"), list unchanged, toggle state reverts to off.
- HTTP/2 failures: connection refused, ALPN not h2, stream reset, timeout at 2500 ms, body > 512 KB, non-2xx, invalid JSON → `available:false`, HTTP 200, session always destroyed (no leaked sockets/timers).
- Mobile: sticky bar must not cover the last item or the tab bar (scroll to bottom, assert last row fully visible above the bar); Share menu and Details open inside the viewport at 375 px.

---

## Phase A — Live prices via `node:http2`

**Files:** Create `server/utils/http2-get.ts`, `tests/market-prices-transport.test.ts`. Modify `server/utils/market-prices.ts`, `tests/market-supermarket-prices.test.ts`.

**Interfaces — Produces:**
```ts
export type Http2Response = { status: number, body: string }
export function http2Get(url: string, opts: { headers: Record<string, string>, signal: AbortSignal, maxBytes: number }): Promise<Http2Response>
```
Behaviour: `http2.connect(new URL(url).origin)`; `session.request({ ':path': pathname + search, ...lowercased headers })`; collect `Buffer` chunks, reject + destroy when total > `maxBytes`; on `signal` abort → `session.destroy()` and reject with an `Error` whose `name === 'AbortError'`; always `session.close()/destroy()` in `finally`; connection/stream errors reject. One session per call (the 24 h cache absorbs load). Works for `http:` (h2c) and `https:` so tests can use a local server.

- [ ] **A1 (RED): transport tests.** `tests/market-prices-transport.test.ts` with a local `http2.createServer()` on port 0 (h2c): (1) 200 JSON → `{status:200, body}`; (2) 403 → `{status:403}` (not thrown); (3) server never responds + `AbortController.abort()` after 50 ms → rejects `AbortError`, server sees the stream closed, no open handle (`afterEach` closes the server; vitest must exit cleanly); (4) body larger than `maxBytes` → rejects; (5) connection refused (unused port) → rejects; (6) headers arrive lowercased and `user-agent` is forwarded; (7) path + query preserved byte-for-byte (`?q=%CF%86%CE%B5%CF%84%CE%B1&countries=GR`).
  Run: `npx vitest run tests/market-prices-transport.test.ts` → FAIL (module missing).
- [ ] **A2 (GREEN):** implement `http2-get.ts`; rerun → PASS.
- [ ] **A3 (RED→GREEN): migrate the price suite.** In `tests/market-supermarket-prices.test.ts` replace `stubFetch`/`vi.stubGlobal('fetch')` with `vi.mock('../server/utils/http2-get', () => ({ http2Get: vi.fn() }))` and a helper `stubUpstream(impl)` where `impl(url, opts)` returns `{ status, body }` (use `JSON.stringify({ products })` for bodies). Keep all 23 cases and meanings: URL/params assertions read `http2Get.mock.calls[0][0]`; header assertion reads `.calls[0][1].headers['User-Agent']`; the timeout case's stub must reject with an `AbortError` when `opts.signal` aborts; "offline" = stub throws/rejects; 403/429/500 = `{ status, body }`; HTML/`{}`/`null products` bodies stay. Run → FAIL (still uses `fetch`).
  Then change `fetchUpstream` in `market-prices.ts` to `http2Get(url.toString(), { headers: { 'User-Agent': userAgent, Accept: 'application/json' }, signal: controller.signal, maxBytes: MAX_BODY })`, treat non-2xx as unavailable, `JSON.parse(body)` inside the existing try/catch. Rerun → 23/23 PASS.
- [ ] **A4: opt-in live smoke.** Add to the transport test file `it.runIf(process.env.LIVE_PRICES === '1')('reaches the real posokanei API over http2', …)` calling `lookupPrices('φετα')` → `available === true` and ≥ 1 product with a retailer price. Run once by hand: `LIVE_PRICES=1 npx vitest run tests/market-prices-transport.test.ts` → PASS (record the output; if it gets 403, stop and report, do not add curl).
- [ ] **A5:** `npm test` green, `npm run typecheck` 0 errors. Commit: `git add server/utils/http2-get.ts server/utils/market-prices.ts tests/market-prices-transport.test.ts tests/market-supermarket-prices.test.ts && git commit -m "fix(market): reach posokanei over http2 so live prices appear"`.

## Phase B — Pure pantry deduction

**Files:** Create `app/utils/pantry-stock.ts`, `tests/market-pantry-stock.test.ts`. Modify `app/utils/shopping-list.ts` (add optional `pantryNote?: string` to the shopping item type only).

**Interfaces — Produces:**
```ts
import type { PantryItem } from '#shared/culinary/pantry'
import type { MarketShoppingList } from './shopping-list'
export type CoveredItem = { id: string, name: string, amount: number, unit: string, have: string } // have e.g. "200 g"
export function applyPantryStock(list: MarketShoppingList, stock: readonly PantryItem[], now = Date.now()): { list: MarketShoppingList, covered: CoveredItem[] }
```
Rules: copy `stock` (never mutate inputs); for each item in list order with `amount > 0`: sum compatible in-date stock via `pantryQuantity(stock.quantity, stock.unit, item.unit)` (skip `null`), `used = min(amount, available)`, consume from the shared copy (convert back with `pantryQuantity(used, item.unit, stock.unit)`); `remaining = amount - used`; `remaining ≤ 1e-8` → covered (removed from destinations, pushed to `covered` with `have = "<round3(used)> <unit>"`); `0 < used < amount` → partial: `{ ...item, amount: round3(remaining), pantryNote: "Have <used> <unit>", counterPhrase: undefined, packageSizeToBuy: undefined, surplusLeftoverTip: undefined }`; `used === 0` → unchanged. `amount === 0` items are covered iff any in-date stock with the same `ingredientKey` has `quantity > 0` (`have: 'in stock'`). Destinations left empty are dropped. Item ids, order, `prepAlerts`, `listId`, `title` preserved.

- [ ] **B1 (RED):** `tests/market-pantry-stock.test.ts`, cases: full cover; partial (asserts reduced amount, `pantryNote`, stripped counter/package/surplus fields); incompatible units untouched; unit conversion (pantry `0.5 kg` covers list `300 g`, remaining 0); shared stock across two items with the same key; expired and zero-quantity stock ignored; `amount===0` rule; empty stock returns an equal list and `covered: []`; empty destination dropped; inputs not mutated (`structuredClone` before/after `toEqual`); Greek names match via `ingredientKey` (`Φέτα` vs `φετα`). Run `npx vitest run tests/market-pantry-stock.test.ts` → FAIL.
- [ ] **B2 (GREEN):** implement; rerun → PASS. `npm test` + `npm run typecheck` green.
- [ ] **B3:** Commit `feat(market): pure pantry deduction for shopping lists` (files by name).

## Phase C — Simple list UI (no pantry yet)

**Files:** Modify `app/components/MarketShoppingList.vue` (split into small child components under `app/components/market/` when a block exceeds ~60 lines: e.g. `MarketItemRow.vue`, `MarketShareMenu.vue`; the price, QR and restock logic stays in the parent). Modify `scripts/e2e-user-flows.js` (market steps), `tests/shopping-list.test.ts` only if a helper signature changes.

**Target layout (top to bottom):**
1. Heading `Market shopping list` + `Generate…` button (unchanged behaviour).
2. Mode pills; one line: `N of M bought · Checkoffs reset if you regenerate.` (replaces the three paragraphs; keep `role="status"` on the counter).
3. Action row: `Copy shopping list` (visible), `Share` menu (`<details class="more-menu">` with `Share on WhatsApp`, `Send to phone`, `Print or save PDF`), `Restock pantry (N)` only when `pendingRestock.length`. No other buttons. Existing status/alert/notice regions stay but only render when they have text.
4. `Prepare ahead (N)` as a closed `<details>`.
5. Per shop: one heading row (`<h3 id="market-<section>">` accessible name = exactly the shop name, plus Greek name `lang="el"` and `N items` as non-heading text, icon aria-hidden, reorder arrows) → list.
6. Item row (`<li>`): `[checkbox] amount unit name` left, price badge right (slot kept: `market-price-slot`, reserved height), compact `select` (`Destination for <name>`) on the same line at `sm:` and below the name on mobile, then `<details><summary>Details</summary>…</details>` holding counter phrase, `Buy:`, `Surplus:`, note, prep notes. Show `Details` only when at least one of those exists.
7. Mobile (< `md`): sticky bottom bar (`sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-0`, pattern from `app/pages/recipes/import.vue`) with `N of M bought` and a `Copy shopping list` button; hide the inline counter + top Copy on mobile so there is no duplicate control (use `md:hidden` / `hidden md:flex`, not `v-if`, so E2E at each viewport sees exactly one visible `Copy shopping list`).

- [ ] **C1 (RED): E2E assertions first.** Edit the Flow 4 market steps in `scripts/e2e-user-flows.js` to the new contract: open the Share menu before `Send to phone` / `Share on WhatsApp` / `Print`; add a new step `Flow 4 · simple market list`: (a) desktop: a collapsed item row's height ≤ 72 px; (b) mobile 375×812: with one shop and ≥ 3 items, `lastItemRow.bottom - listHeading.top ≤ 812 * 1.25`; (c) `Details` closed by default and, once opened, shows `At the counter:` text; (d) exactly one visible `Copy shopping list` per viewport; (e) sticky bar present on mobile, absent on desktop, and after scrolling to the bottom the last row's `bottom ≤ stickyBar.top`; (f) the price-badge no-layout-shift step still passes; (g) no horizontal overflow (`document.documentElement.scrollWidth <= innerWidth`), no console errors. Run `npm run build && E2E_SCREENSHOT_DIR=/tmp/market-ui-shots npm run test:e2e` → the new step FAILS (old layout).
- [ ] **C2 (GREEN):** implement the layout above. Keep all accessible names listed under *Verified facts*. Keep `disposed`/abort logic, price queue, restock, QR and print behaviour untouched; move markup, not logic.
- [ ] **C3:** `npm test`, `npm run typecheck`, `npm run build && E2E_SCREENSHOT_DIR=/tmp/market-ui-shots npm run test:e2e` all green (E2E can be flaky under machine load: rerun once before debugging). Open the desktop and mobile `market-route` screenshots and confirm the list looks calm.
- [ ] **C4:** Commit `feat(market): calm shopping list with details, share menu and sticky mobile bar`.

## Phase D — Pantry toggle in the new UI

**Files:** Modify `app/components/MarketShoppingList.vue` (and child components), `scripts/e2e-user-flows.js`.

- [ ] **D1 (RED): E2E** step `Flow 4 · deduct pantry stock` (after the list is generated, with `page.route('**/api/pantry', …)` fulfilling a fixture pantry containing one fully-covering and one partially-covering item for names present in the list, using ids that exist in the generated list): toggle `Deduct pantry stock` is **off** by default and unchecked after reload; turn it on → covered item leaves its shop and appears under a collapsed `Already in your pantry (1)` group (`<details>`), partial item shows the reduced amount and `Have …` note; `N of M bought` recounts; `Copy shopping list` text contains the reduced amount and not the covered item; turn it off → all original rows and amounts return; preference persists in `localStorage['heirloom-market-deduct-pantry']`; with `/api/pantry` returning 500 → inline note, toggle returns to off, list unchanged, no alert dialog and no console error beyond the intentionally failed request (use `route.fulfill({ status: 200, json: [] })` for the empty case and assert the "pantry is empty" note; for 500 use a separate step that tolerates that one network error as the suite does for other failure steps). Run → FAIL.
- [ ] **D2 (GREEN):** add `deductPantry` ref (init from `localStorage`, try/catch), lazy `$fetch<PantryItem[]>('/api/pantry')` the first time it is enabled (abort on unmount), `routedList = routeShoppingList(applyPantryStock(list, stock).list, …)` so share/QR/copy/restock all use the deducted list; render the toggle as one checkbox (`Deduct pantry stock`) in the action area (native `<input type="checkbox">` in a `min-h-11` label, same row as the mode pills on desktop, below on mobile); covered group + partial note as in *Decisions*; `pendingRestock` must exclude covered items.
- [ ] **D3:** `npm test`, `npm run typecheck`, `npm run build && E2E_SCREENSHOT_DIR=/tmp/market-ui-shots npm run test:e2e` green.
- [ ] **D4:** Commit `feat(market): optional pantry deduction on the shopping list`.

## Final verification (Codex, before reporting)

```bash
cd ../cookbook-market-ui
npm test 2>&1 | tail -6                      # expect 54+ files, 1124+ tests, all pass
npm run typecheck 2>&1 | tail -4             # expect no errors
LIVE_PRICES=1 npx vitest run tests/market-prices-transport.test.ts   # expect pass (needs internet)
npm run build && E2E_SCREENSHOT_DIR=/tmp/market-ui-shots npm run test:e2e 2>&1 | tail -4   # expect PASS … zero console errors
git status --short | grep -v screenshots     # nothing unexpected
```
Review `git diff master...HEAD` for unrelated churn, then report pass counts. Do **not** merge to master; leave the branch for review.

## Acceptance Criteria

1. With internet, `/api/market/prices?q=φετα` returns `available:true` and the badge shows on a Supermarket item; with the network blocked it returns HTTP 200 `available:false`. No `curl`, no `child_process`.
2. The list at 375×812 with 3 items in one shop fits within ~1.25 screens; collapsed rows ≤ 72 px on desktop; one visible `Copy shopping list` per viewport; sticky bar never hides the last item or the tab bar.
3. Secondary info (counter phrase, buy size, surplus, prep) lives behind `Details`; Share actions behind one menu; Prepare ahead collapsed with a count; all previously available actions remain reachable by keyboard.
4. `Deduct pantry stock` is off by default, persists per device, never hides an item without listing it under `Already in your pantry (N)`, never deducts across incompatible units, and copy/WhatsApp/QR/restock use the reduced list.
5. All commands in *Final verification* are green; unit counts ≥ baseline.

## Assumptions

- Client-side deduction is acceptable because pantry data is local and the persisted grocery list should stay the un-deducted truth.
- Partial deduction drops amount-specific counter/package/surplus text rather than recomputing it (recomputing would duplicate `buildGroceryList` logic).
- `Shop at` stays visible by jev's decision; if it still makes rows feel heavy after Phase C, the next step (owner decision) is moving it into `Details`.
- If `node:http2` also starts getting 403, the graceful fallback already hides badges; revisit transport only with new evidence.
