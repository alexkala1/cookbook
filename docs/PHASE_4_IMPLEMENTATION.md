# Phase 4 — Virtual Pantry

`server/database/schema.ts` owns the pantry table; `server/db/schema.ts` re-exports it so the existing Drizzle connection and migration configuration continue to work. Migration `0003_misty_pepper_potts.sql` preserves inventory, converts ISO timestamps to integer milliseconds, maps valid legacy storage categories, and defaults other categories to pantry. Other tables retain their existing timestamp contracts.

## API

- `GET /api/pantry`: expiry ascending, unknown expiry last, then location/name.
- `POST /api/pantry`: one item or an array of 1–100 items. Fields: `name`, `quantity` (default 1), `unit` (default item), `storageLocation` (pantry/fridge/freezer, default pantry), `expiresAt` (nullable epoch milliseconds). Name normalization folds accents, Greek case, punctuation and whitespace. Same name/location merges atomically; compatible units convert, incompatible units return 409 and roll back the entire batch. Earliest known expiry wins.
- `DELETE /api/pantry/:id`: deletes an item; unknown IDs return 404.
- `POST /api/pantry/match`: saved recipes ranked by `completeness`, with `in_stock` and `missing` arrays. Checks quantities for original servings, excludes expired inventory, consumes each quantity once within each recipe, and never guesses density across mass/volume/count. Names match conservatively, including a small explicit English plural alias list. Recipes without ingredients receive 0%, not a false complete match.
- `POST /api/pantry/receipt`: `{ "text": "2 x Milk 1.50\nRice 500 g 2.49" }` returns suggested items and a review notice. Supports pasted text from external OCR; it does not perform image OCR or save automatically. Storage guesses and non-food receipt lines require review. No expiry dates are fabricated.

Existing Host/Origin middleware protects every mutation route. No external provider or key is needed.

## UI and Kitchen

`/pantry` includes location filters, item/expiry entry, removal, recipe matches, editable receipt review, empty states and retry/error feedback. Receipt quantities may represent package counts; review package sizes before matching measured recipe quantities.

The Rescue trigger is docked in the Kitchen header so it cannot cover step navigation at 375px. Running, paused and idle timers persist per recipe in sessionStorage. Restored deadlines account for time spent away; browser storage failures show a warning. Audio requires interaction and an open cooking page. Closing the tab clears the session according to browser behavior.

## Verification

Verified 2026-09-26: `pnpm test` passed 353 tests across 19 files, `npx nuxi typecheck` passed, and `pnpm run build` completed. `pnpm run db:generate` reported no remaining schema changes. The build emitted an informational plugin timing warning. Browser console errors were limited to deliberately exercised 409 unit conflicts and injected 503 load failures; recovery succeeded. Concurrent grocery and culinary changes were preserved.

Schema/migration and HTTP tests cover preserved data, CRUD, merges, rollback, storage checks, expiry ordering, matching, receipt extraction and CSRF rejection. Timer tests cover restored deadlines, paused state and corrupt storage. Browser checks exercise desktop and 375px pantry workflows, receipt review/save, matching, filtering/removal, incompatible-unit errors, failed-load retry, Kitchen timer reload/pause/resume/completion and rescue focus restoration. Screenshots: `/tmp/heirloom-phase4-desktop.png`, `/tmp/heirloom-phase4-mobile-pantry.png`, `/tmp/heirloom-phase4-mobile-kitchen.png`.

Migration was applied to an isolated QA database. Apply it to the application database before using the feature:

```sh
pnpm run db:migrate
pnpm test
npx nuxi typecheck
pnpm run build
```
