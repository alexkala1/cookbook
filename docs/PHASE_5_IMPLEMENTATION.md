# Phase 5 — Guests, keepsakes and heirloom cards

## Data and migration

`server/database/schema.ts` defines `guests` and `recipeMemories`, re-exported through `server/db/schema.ts`. Migration `0004_elite_lucky_pierre.sql` preserves guest names, JSON restrictions, dislikes and notes, converts ISO creation dates to epoch milliseconds, and initializes `updatedAt`. Unknown legacy creation dates use migration time. Recipe memories have a recipe foreign key with cascade deletion, an index on recipe ID, and a database check for integer ratings 1–5 (or null).

The migration was verified on empty and populated legacy databases and applied to `/tmp/heirloom-phase5-qa.db`. Apply the migration to your application database before using these pages:

```sh
pnpm run db:migrate
```

## API contracts

- `GET /api/guests` returns profiles ordered by name. Restriction fields are arrays in JSON responses and JSON strings in SQLite. Invalid legacy restriction JSON produces visible `profileWarnings` instead of an implicit clearance.
- `POST /api/guests` accepts `{ name, allergies?, dietaryRestrictions?, dislikes?, notes?, id? }`. Without `id`, creates a generated UUID. With an existing `id`, replaces editable profile fields while preserving `createdAt` and refreshing `updatedAt`; absent lists become empty. Unknown IDs return 404. Lists accept up to 30 nonempty strings, allowing custom requirements with explicit manual-review warnings.
- `DELETE /api/guests/:id` removes a profile; missing IDs return 404.
- `POST /api/meal-plan/dietary-audit` accepts `{ recipeIds, guestIds?, guests? }`, where `guests` contains inline profiles. Requires 1–20 recipes and 1–20 total guests. Unknown IDs fail instead of silently dropping selections. Returns `{ conflicts, reviewWarnings, notice }`; conflicts include type, guest/recipe identity, ingredient, restriction, explanation, cross-contact warning and conditional substitutions.
- `GET /api/recipes/:id/memories` returns logs newest cook date first; missing recipes return 404.
- `POST /api/recipes/:id/memories` accepts `{ cookDate, rating?, notes?, familyMemories? }`. Dates are epoch milliseconds; rating is an integer 1–5 or null. IDs and creation dates are server-generated. Unknown fields and invalid bounds return 400.

All writes retain the existing Host/Origin protection. Neither profiles nor memories are sent to external AI services.

## Dietary screening boundaries

The deterministic dictionary screens English and Greek ingredient names and notes, folds case/accents, and matches whole terms. Covers gluten, dairy, nuts (including peanuts), shellfish, eggs, soy, fish and sesame. Compound exclusions avoid treating eggplant as eggs, nutmeg as nuts, or coconut milk as dairy. Prepared sauces such as pesto and soy sauce are flagged for possible hidden allergens. Finite dictionaries cannot identify every ingredient, brand or preparation method.

Vegan/vegetarian checks detect common animal ingredients. Halal and kosher checks flag incompatible ingredients and require certification/preparation review rather than assuming certification. Pregnancy checks flag alcohol, unpasteurized dairy, eggs needing cooking/pasteurization verification, and selected raw/smoked animal foods. Custom requirements, missing ingredient lists and unreadable profiles produce review warnings.

Every result states that no detected conflict is **not** proof of safety. Substitutions are filtered against all selected guests’ declared requirements and remain conditional on labels, cross-contact and culinary suitability. Unknown requirements cannot be certified by this tool. Confirm needs with guests before serving.

Guidance consulted: [FDA food allergies and cross-contact](https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies), [CDC safer food choices during pregnancy](https://www.cdc.gov/food-safety/foods/pregnant-women.html). These inform warnings; the matcher does not replace label checks or individualized medical advice.

## UI and verification

`/guests` supports profile creation/editing/deletion, badges, custom requirements and planned-recipe audits. Changing selections or profiles clears stale audit results. The recipe reader includes tasting logs/family keepsakes and a print link. `/recipes/:id/print` uses original measurements, decorative borders, sensory milestones, internal-temperature targets, heirloom notes and dedicated A4 print rules. Print controls are hidden on paper; long recipes paginate without fixed-height clipping.

Tests cover HTTP CRUD/validation/CSRF, timestamp preservation, corrupted legacy data, allergen compounds, multilingual matching, dietary rules, substitution filtering, memory isolation/cascade/rating constraints and populated migration upgrades.

Verification on 2026-09-26: 456 tests across 23 files passed; `npx nuxi typecheck` and `pnpm run build` passed. `pnpm run db:generate` reported no remaining schema changes. The test count includes concurrently added conductor and seasonality tests.

Desktop and 375px browser checks cover guest add/edit/audit/delete, edit focus, stale-result clearing, keepsake save/reload, failed-save draft retention, missing recipes, print-button invocation and print-media visibility. No console errors appeared in successful flows; an injected 503 exercised save failure. Sample output is one A4 page; a long fixture spans four pages and retains its final step.

Artifacts: `/tmp/heirloom-phase5-guests-desktop.png`, `/tmp/heirloom-phase5-guests-mobile.png`, `/tmp/heirloom-phase5-card-mobile.png`, `/tmp/heirloom-phase5-card-print.png`, `/tmp/heirloom-phase5-card.pdf`, `/tmp/heirloom-phase5-long-card.pdf`.

Conductor, orchestration and seasonality files were left untouched. Their concurrent changes remain in the working tree.
