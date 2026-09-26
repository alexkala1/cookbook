# Cookbook OS adversarial audit — Phases 0–5

Date: 2026-09-26. Scope: repository implementation, migrations, API contracts, deterministic culinary engines, and browser workflows. Changes remain uncommitted for review.

## Verdict

Fixed 12 regression groups and added 72 tests. Final verification: **528 tests in 29 files pass**, Nuxt typecheck passes, production build passes. No unresolved confirmed blocker remains from this audit within the local-first application scope. This is a bounded code audit, not a certification of culinary advice or an internet-facing security assessment.

## Findings and fixes

Severity reflects the consequence before the fix. Each finding below is fixed.

| Severity | Finding and reproduction | Correction | Evidence |
|---|---|---|---|
| Critical | Poultry drafts could retain a 60°C target when cooking instructions were Greek; duck, goose, and Greek poultry names were incompletely recognized. | Normalize accents, recognize additional poultry names and Greek cooking verbs, and enforce at least 74°C while retaining higher targets. Preserve the title as a signal when an ingredient list is incomplete; exclude recognizable stock/egg/fat byproduct phrases. | `server/utils/ai/science.ts`; `tests/ai-normalization-regressions.test.ts` |
| Critical | Imported `1,5 kg chicken`, fractional ranges, and Greek spoon units could become incorrect quantities, units, or ingredient names. | Parse decimal commas, mixed and Unicode fractions, range bounds, and Greek culinary unit aliases. Retain range information in notes. | `server/utils/ai/normalize.ts`; `tests/ai-normalization-regressions.test.ts` |
| Critical | Grocery catalog families collapsed materially different ingredients: rice flour with wheat flour, oat milk with dairy milk, or fresh with dried yeast. | Separate shopping classification from ingredient identity. Preserve formulation modifiers while retaining plain English/Greek aliases. Suppress dry-yeast sachet advice for explicitly fresh yeast. | `shared/culinary/grocery.ts`; `tests/conductor-grocery-regressions.test.ts`; browser/API check retained separate rice and wheat flour |
| Critical | Ingredients literally named `gluten` or `shellfish` could escape the matching allergy category. | Add literal category terms; remove the “gluten free” phrase before matching without suppressing independently present wheat/flour evidence. | `shared/culinary/dietary.ts`; `tests/dietary-category-regressions.test.ts` |
| Critical | Staggered preheat instructions at 220°C and 160°C followed by overlapping bake steps without repeated temperatures could hide an oven conflict. | Carry each recipe’s latest explicit oven setting into subsequent oven steps, replacing it when a new setting appears. | `shared/culinary/conductor.ts`; `tests/conductor-grocery-regressions.test.ts` |
| Major | Merging adjacent burner-conflict windows summed sequential steps as simultaneous demand, reporting four burners when two were needed. | Merge only equivalent resource demands/settings and count each sequential course’s demand once. | `shared/culinary/conductor.ts`; `tests/conductor-grocery-regressions.test.ts` |
| Major | References to pans, pots, oven preparation, or off-heat resting reserved phantom burners. | Require active heating/stove evidence, retain explicit heat metadata and combined sear/roast behavior, and exclude passive vessel references. | `shared/culinary/conductor.ts`; `tests/conductor-grocery-regressions.test.ts` |
| Major | Conductor resolution advice could reduce an already-fan oven setting by another 20°C or assume unknown settings were conventional. | Suppress conversion advice for courses mentioning fan/convection and make other conversion advice explicitly conditional; require checking the second dish separately. | `shared/culinary/conductor.ts`; `tests/conductor-advice-regressions.test.ts` |
| Major | Pressing Pause after a timer deadline but before its interval callback created a paused zero timer; Resume restarted its full duration without a completion alert. | Reconcile deadlines through the existing timer tick before pausing; finished timers retain their completion state and exactly-once alert. | `app/composables/useCookingTimers.ts`; `tests/cooking-timers-composable.test.ts`; real browser deadline/Pause race |
| Major | A migrated kitchen profile with a non-default ID was ignored; GET or first partial PUT silently substituted defaults, losing effective hardware/salt settings. | Transactionally adopt a sole legacy profile as `default`, preserve unspecified fields on partial updates, and return actionable 409 for ambiguous multiple legacy profiles. Existing canonical profiles remain authoritative. | `server/utils/kitchen-profile.ts`; settings APIs/UI; `tests/kitchen-profile-regressions.test.ts` |
| Major | Editing dinner inputs left an old generated timeline visible, including after a failed rebuild. | Clear the plan and completion state when inputs change and before a new request. | `app/pages/meal-plan/index.vue`; desktop browser changed burner count and confirmed old timeline disappeared |
| Major | A 48-hour preparation step was labeled “day before” instead of “2 days before.” | Render the full signed day offset. | `app/pages/meal-plan/index.vue`; desktop/mobile 48-hour marinade fixture |

The poultry threshold follows the USDA minimum of 165°F / 73.9°C for poultry: [Safe Minimum Internal Temperature Chart](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/safe-temperature-chart). Recognition remains heuristic; the application cannot verify actual cooking or measured doneness.

## Coverage beyond changed code

- **Database:** checked schema exports, migration alignment, 11 tables, foreign keys/indexes/cascades, populated legacy upgrades, and the differing documented ISO-string versus millisecond timestamp contracts. `db:generate` reports no schema changes. The profile correction is a transactional compatibility repair, not a DDL change.
- **API and AI:** reviewed request validation, transactional recipe operations, parameterized queries, header-only server BYOK handling, SSRF address filtering/DNS pinning/redirect bounds, CSRF Host/Origin checks, SSE sanitization and cancellation. No additional confirmed key-disclosure, SQL-injection, SSRF, or CSRF regression was found.
- **Pantry:** checked quantity merging and rollback, storage locations, expiry ordering/exclusion, stock consumption across repeated ingredients, measurement compatibility, and receipt review before persistence.
- **Guests and keepsakes:** checked profile validation, corrupted-profile handling, structured dietary conflicts, memory rating/date bounds, recipe isolation, and deletion cascades. Guest checks retain explicit cross-contact and manual-review guidance.
- **Kitchen:** reviewed timer persistence, keyboard fallback, camera track release on lifecycle/visibility changes and late permission resolution, and wake-lock cleanup.
- **Regional shopping and conductor:** checked Greek normalization, routing, package suggestions, butcher preparation, seasonality, resource conflicts, and multi-day timeline presentation.
- **Vintage cards:** checked escaped content, sensory cues, mobile layout, and print-only styling.

## Verification

| Check | Result |
|---|---|
| `pnpm run db:generate` | Pass; 11 tables, no schema changes |
| `pnpm test` | Pass; 528 tests, 29 files |
| `npx nuxi typecheck` | Pass; zero errors |
| `pnpm run build` | Pass; production Nitro output generated |
| `git diff --check` | Pass |
| Production browser, 1280×900 and 375×812 | Passed exercised workflows below |

Browser verification used the production build at `127.0.0.1:3106` with an independently migrated `/tmp/heirloom-audit-qa.db`. The main application database was not modified.

Exercised workflows: conflicting oven schedules; invalidation after changing burner count; two-day preparation labels; timer deadline persistence across reload; expired-Pause completion; Rescue open/Escape/focus return; pantry add and 50% stock match with explicit missing wheat flour; receipt parsing into editable review rows; guest creation and gluten warning; keepsake save/reload; mobile print navigation; A4 PDF generation. Inspected Kitchen and print screenshots. No horizontal overflow in checked mobile views; final browser console reported zero warnings/errors. Print controls were absent in print media and sensory text remained in the one-page A4 fixture.

Temporary evidence files:

- `/tmp/heirloom-audit-final-tests.log`
- `/tmp/heirloom-audit-final-typecheck.log`
- `/tmp/heirloom-audit-build.log`
- `/tmp/heirloom-audit-conductor-desktop.png`
- `/tmp/heirloom-audit-conductor-mobile.png`
- `/tmp/heirloom-audit-kitchen-mobile.png`
- `/tmp/heirloom-audit-pantry-mobile.png`
- `/tmp/heirloom-audit-guests-mobile.png`
- `/tmp/heirloom-audit-print-mobile.png`
- `/tmp/heirloom-audit-print-desktop.png`
- `/tmp/heirloom-audit-card.pdf`

## Remaining limits and operational notes

- Multiple legacy kitchen profiles without a canonical `default` now require manual consolidation instead of silently selecting one. No records are discarded.
- Allergen dictionaries, poultry recognition, resource classification, receipt extraction, and regional seasonality are finite heuristics. Unknown products, languages, preparations, and label contents still need review; a lack of conflicts is not an allergy-safety guarantee.
- Pantry upsert deliberately retains the earliest expiry when combining identical stock/location. Adding fresh stock to expired stock does not make the combined item fresh; remove the old lot first. This is existing documented/tested policy.
- Modified bilingual grocery names may remain separate conservatively. Package sizes are estimates, and combined cooking instructions reserve resources for their whole step rather than modeling sub-step activity.
- Decimal commas are interpreted as decimal separators; thousands-separator ambiguity is not inferred.
- Live paid AI providers, physical camera gestures, audible hardware output, long-duration background throttling, and physical printers were not exercised in this audit. Browser checks used Chromium and a representative short print fixture, not every device or card length.
- Host/CSRF protection supports the local-first deployment; it does not add multiuser authentication or authorize exposing the application publicly.
