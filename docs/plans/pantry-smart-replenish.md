# Pantry Smart Replenish implementation plan

Goal: Add spices storage, automatic shelf-life estimates, and unit-aware low-stock alerts without changing explicit expiry dates or stock matching completeness.

Architecture: Pure shared helpers classify names and calculate days/stock thresholds. The pantry POST boundary assigns default expiry to all restock callers; receipt parsing supplies reviewable estimates. Existing storage loops expose the fourth location.

Acceptance criteria:
- Spices persist through SQLite, backup validation, receipt review, and pantry filters.
- Shelf-life defaults cover the requested English and Greek categories; fresh herbs and vegetable peppers remain distinct from dried seasoning.
- Missing expiry is estimated; explicit timestamps and null are respected; merged stock keeps the earliest expiry.
- Low-stock uses 100 g/ml or one counted item, with kg/l and other compatible unit conversion; depleted stock is included.
- Recipe matches flag low available stock without consuming caller data or falsely changing completeness.

Implementation:
1. Extend shared storage types; add shelf-life and low-stock helpers, receipt estimates, and matching metadata.
2. Extend Drizzle storage constraint via a migration and share storage enum with backup validation; estimate missing expiry on POST.
3. Add pantry low-stock toggle/count/badges, recipe match warnings, and reviewable receipt date input; retain accessible native controls.
4. Test shared categories, boundaries, Greek names, receipt timestamps, API persistence/merging/explicit dates, migrations, and backups.
5. Run focused/full Vitest, Nuxt typecheck/build, desktop/mobile browser verification, adversarial diff review, Jev scoring, then commit on feat/pantry-smart-replenish.

Scope: Work and generated artifacts remain in /home/alex/repos/cookbook-codex. Use a separate worktree-local database for browser checks.

## Completed verification — 2026-10-01

- Nuxt 4.5.2, Vue 3.5.43, Vitest 4.1.11, Drizzle 0.45.3, SQLite via better-sqlite3 12.11.1.
- Required focused command: `npx vitest run tests/pantry-shelf-life.test.ts tests/pantry.test.ts` — 135 passed.
- `npm run test` — 58 files passed, 1,246 tests passed, one existing live market-price test skipped.
- `npx nuxi typecheck` — exit 0.
- `DATABASE_URL=$PWD/heirloom.db npm run build` — passed. Explicit database path keeps prerender reads in the worktree.
- Playwright at 1440px and 390px: persisted spices, estimated expiry, live low-stock counts/filtering, threshold and zero-stock transitions, recipe warnings, receipt date editing, explicit date preservation after storage changes, keyboard focus, no horizontal overflow, and simulated update failure retaining stock.
- No page errors, unexpected console errors, or failed requests. The deliberate 500 response was tested separately.
- Screenshots: `.data/pantry-1440.png`, `.data/pantry-390.png`; browser script/database/cache are worktree-local ignored verification artifacts.
- Jev command: `/home/alex/.local/bin/jev score --range 1-10 'Pantry smart replenish shelf-life and low stock alerts quality and completeness'`, supplied the implementation diff on stdin — score 8.19/10, ordinal label 9.
- Adversarial review covered API validation, unit conversion, immutable fetch state updates, explicit expiry/null, oldest nonempty lot preservation, empty-item replenishment, expired stock exclusion, zero-amount seasoning warnings, migration row/index preservation, and backup round trips. `git diff --check` passed.

Shelf-life values are planning estimates. Existing inventory is not backfilled. Explicit dates/null are retained; a nonempty merged lot keeps the earliest known expiry. Empty lots do not impose an obsolete expiry on newly purchased stock.
