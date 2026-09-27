# Interactive market shopping list — delivery report

Verified 2026-09-27. Dinner now offers **Generate Market Shopping List** below a completed schedule's timeline. It posts the selected recipe/course pairs and optional guest count as `servings` to the existing grocery endpoint.

## Files changed

| File | Change |
| --- | --- |
| `app/pages/meal-plan/index.vue` | Mount the shopping component only while a conducted plan exists, below the timeline |
| `app/components/MarketShoppingList.vue` | Independent generation/copy feedback; grouped destinations, prep alerts, Greek counter phrases, quantities, package recommendations, surplus tips, interactive checkboxes, completion count and manual clipboard fallback |
| `app/utils/shopping-list.ts` | Typed response subset and plain-text formatter preserving section order, checked markers and all buying/preparation guidance |
| `tests/shopping-list.test.ts` | Three formatter regressions: full guidance/Greek text, checkoff identity without mutation, and empty lists |
| `docs/USER_GUIDE.md` | In-app Dinner and market-shopping workflow, retry/copy instructions and explicit checkoff lifetime |
| `scripts/market-browser-checks.js` | Reproducible production browser flow at both required widths |
| `docs/screenshots/market/` | Four mobile/desktop screenshots of list controls, alerts and counter/package guidance |
| `docs/MARKET_SHOPPING_VERIFICATION.md` | This report |

No API, grocery-engine, database-schema or dependency changes were required. The displayed destinations follow the existing API: Laiki market, Butcher, Bakery and Supermarket. Dairy remains grouped under Supermarket.

## Verification

| Check | Result |
| --- | --- |
| `pnpm test` | **576 tests pass in 33 files** |
| `npx nuxi typecheck` | Exit 0 |
| `pnpm run build` | Exit 0 |
| `git diff --check` | Pass |
| Existing contrast script | All token-pair checks pass; new ordinary text uses ink/paper at 14.64:1, error text uses error/paper at 6.70:1 |
| Playwright 375×900 | Full schedule → shopping → check/uncheck → clipboard → menu-change invalidation passes |
| Playwright 1280×900 | Same complete flow passes |
| Browser diagnostics | No console errors, page errors or failed requests in the successful flows |
| Responsive controls | No horizontal overflow; buttons and checkbox hit areas at least 44px; no italic text in shopping content |

The browser fixture contains lamb, onion, bread, feta and beans with overnight preparation notes. Tests assert all four destinations, the actual Greek counter phrase, surplus guidance, prep alerts, exact request shape and scaling from four recipe servings to six guests. The lamb quantity becomes 1200 g. Actual clipboard text includes checked markers, Greek text, section headings and guidance; the success message clears back to the copy action.

Additional failure checks deliberately returned HTTP 503 from grocery generation, then retried successfully while preserving the timeline. They also verified omission of `servings` without a guest count and denied clipboard access, which exposes a read-only text area with select-on-focus for manual copying. Intentional failures are separate from the successful-flow diagnostic result above.

Screenshots were visually reviewed. Controls reuse the existing Hallmark eight-state classes and stable-action directive; text stays readable when an item is checked because only its item label receives a strike-through, without reduced opacity. Long content can wrap at mobile widths.

## Behavior boundaries and final review

Checkmarks are local to the open shopping component, not persisted to the server. Regeneration, page navigation/reload, rebuilding a schedule or changing dinner inputs resets them. The UI explains this and recommends copying before leaving. Successful generation still saves a list through the existing endpoint; this feature does not retrieve list history or deduct pantry stock.

Generation is guarded against duplicate clicks and copy/generation overlap. Leaving the component aborts its pending request and suppresses late updates. A failed regeneration preserves any previously displayed list; a failed copy retains selectable content. Vue interpolation renders recipe and counter text without HTML execution. Final review covered contracts, state transitions, failure paths, accessibility, scope and verification; no outstanding blocker was found.

Browser testing used `/tmp/heirloom-market-browser.db` on production port 3114. Only isolated QA fixtures were written. Real shop visits and physical phone testing were outside this browser verification.

## Screenshots

- [List and preparation alerts · 375px](screenshots/market/list-375.png)
- [Counter phrases and packages · 375px](screenshots/market/counter-375.png)
- [List and preparation alerts · 1280px](screenshots/market/list-1280.png)
- [Counter phrases and packages · 1280px](screenshots/market/counter-1280.png)
