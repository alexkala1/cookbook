# Metric conversion and market customization report

Verified 2026-09-27. Both features are implemented and verified against the production build.

## Files changed

| File | Result |
| --- | --- |
| `shared/culinary/densities.ts` | Conservative density lookup, metric suggestions and provenance-preserving application |
| `app/pages/recipes/[id]/index.vue` | Review card, dismiss, PUT application, loading/error/success feedback and protection against overlapping local edits |
| `app/components/RecipeForm.vue` | Nullable editable gram equivalent, multiline original-measure notes, butter-stick unit suggestion |
| `app/components/MarketShoppingList.vue` | Per-item destination selectors, focus restoration after moving, Market Route/One-Stop toggle and active-route export |
| `app/utils/shopping-list.ts` | Non-mutating destination overrides, supermarket aisle grouping, and matching plain-text output |
| `tests/densities.test.ts` | Ingredient/measure estimates, unsupported compounds, explicit grams, salt types, notes, repeat application and numeric/storage bounds |
| `tests/shopping-list.test.ts` | Custom destinations, preserved guidance/checkmarks, consolidated aisles and route restoration |
| `docs/USER_GUIDE.md` | Both workflows, assumptions, source preservation and local customization lifetime |
| `scripts/customization-browser-checks.js` | Repeatable desktop/mobile API-backed browser workflows |
| `docs/screenshots/customization/` | Four metric-card and one-stop-mode screenshots |
| `docs/METRIC_MARKET_CUSTOMIZATION_VERIFICATION.md` | This report |

No database migration or new dependency was required. Existing recipe PUT validation and persistence handle `gramsEquivalent` and ingredient notes.

## Behavior

Metric proposals use saved recipe quantities, never the temporary serving scaler. Supported dry ingredients become grams; oil becomes millilitres with its gram equivalent recorded. Ounces/pounds are weight conversions. Approximate kitchen volumes use 240 ml/cup and 15 ml/tbsp. The existing salt engine remains unchanged: table salt is 5.9 g/tsp (approximately 6), with separate kosher and Greek salt densities. Unknown volume ingredients and unsupported compounds are left alone. An explicit gram equivalent takes priority for a volume measurement.

Apply retains existing notes and appends `Original measure: <amount> <unit>`, while preserving source metadata and all unrelated recipe fields. Converted metric rows are not suggested again. Dismiss does not write and lasts for the current reader visit. The edit form exposes both gram equivalents and provenance notes, which users may deliberately modify.

Destination overrides move existing item IDs rather than duplicating them; quantities, counter phrases, checkmarks, package sizes and surplus guidance travel with the item. One-stop mode groups every item under Supermarket with broad aisles based on the original classification. Selectors are disabled while consolidated; returning to Market Route restores overrides. Both export modes use the displayed grouping. These customizations remain local to the open list and reset on regeneration/navigation, as documented.

## Verification results

| Check | Result |
| --- | --- |
| `pnpm test` | **610 tests pass in 34 files** |
| `npx nuxi typecheck` | Exit 0 |
| `pnpm run build` | Exit 0 for final source |
| `git diff --check` | Pass |
| Contrast token check | Pass; ordinary new text/actions use ink/paper at 14.64:1, errors 6.70:1, success 7.18:1 |
| Playwright 375×900 | Metric dismiss/apply/reload/edit and custom-route/mode/copy flows pass |
| Playwright 1280×900 | Same complete workflows pass |
| Diagnostics | No console errors, uncaught page errors or failed requests in successful workflows |
| Responsive design | No shopping overflow; new controls at least 44px; metric card checked at 375px; no italic text; screenshots visually inspected |

Browser assertions verify that 1 cup flour becomes 120 g even with the reader scaler set to eight servings, retaining the original four-serving recipe, source URL and existing notes. Oil becomes 15 ml with 13.44 g recorded; unknown sauce stays in cups. Reload confirms permanent notes and absence of repeat proposals. Editing gram equivalent to 125 g and adding a note persists correctly.

Shopping checks move feta to Laiki, retain keyboard focus and checkmarks, consolidate into supermarket aisles, copy the consolidated text, restore Market Route, and copy feta under Laiki. A separate deliberate HTTP 503 conversion test confirms that the rejected request leaves original data intact and retry succeeds.

The first production build exposed a relative shared-module import resolution issue. Using the established `#shared` alias fixed it; the final build, tests and typecheck passed. All browser data used isolated `/tmp/heirloom-customization-browser.db` on port 3115; disposable recipes were removed after checks.

## Final review and limits

Reviewed matching boundaries, duplicate application, note preservation and length limits, finite/positive quantities, API allowlisted fields, state transitions, focus after moves, export order and immutability. Estimates intentionally do not cover every ingredient or preparation state. Weighed measurements and verified labels remain preferable where precision matters. The work adds no recipe-history system or persistent shopping customization API.

Screenshots: [metric mobile](screenshots/customization/metric-375.png), [metric desktop](screenshots/customization/metric-1280.png), [one-stop mobile](screenshots/customization/supermarket-375.png), [one-stop desktop](screenshots/customization/supermarket-1280.png).
