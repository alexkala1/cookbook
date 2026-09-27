# Starter heirloom pack

Implemented five original Greek starter recipes: Arni me Patates, Traditional Spanakopita, Santorini Fava, Classic Fasolada, and Revani with Citrus Syrup. Each includes measured ingredients, equipment, science guidance, sensory cues, and heirloom notes. Course labels use descriptions because the existing schema distinguishes food/baking/dessert, not courses.

`pnpm run db:seed` applies committed migrations and seeds an empty database. `POST /api/recipes/seed` returns `{ created: 5 }` with HTTP 201 on first load, or `{ created: 0 }` with HTTP 200 when any recipe already exists. An immediate SQLite transaction encloses the emptiness check and all nested writes. Both paths preserve existing cookbooks; neither auto-seeds on application startup.

The recipe collection offers the seed action only in its unfiltered empty state, with loading, disabled, error/retry, and refresh behavior. The existing CSRF middleware protects the endpoint.

## Verification — 2026-09-27

- `pnpm test`: 573 tests pass in 32 files, including five new seed integration tests.
- `npx nuxi typecheck`: exit 0.
- `pnpm run build`: exit 0.
- CLI: first run creates five recipes; second run skips, using `/tmp/heirloom-starter-cli.db`.
- Playwright production checks at 375px and 1280px: keyboard focus, failed POST/retry, loading/disabled state, five cards after success, repeated POST no-op, filtered empty state without seed action, and no horizontal overflow.
- Lamb reader renders oven and internal-temperature guidance. Normal browsing reports no console errors, page errors, or failed requests.
- Screenshots inspected for the mobile empty state and desktop populated grid. Browser fixtures use `/tmp/heirloom-starter-browser.db`; no user cookbook was seeded during verification.
- Regression tests cover complete nested records, existing-recipe preservation, rollback after a later ingredient write fails, repeated/simultaneous calls, and cross-origin rejection.
- Final adversarial review found no outstanding seed-specific blocker. Unrelated concurrent working-tree edits were left untouched.
