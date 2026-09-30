# Re-import from source

Goal: restore recipe `fb84b092-a750-401d-a1a2-057f63490d95` with the canonical 12-step cinnamon-bun method and add a reusable source-refresh action.

Implementation (Nuxt 4.5.2, Drizzle SQLite, Vitest 4.1.11):

- Fix URL extraction to supplement incomplete JSON-LD with visible ingredient and ordered method lists. Preserve source section labels, numbered list boundaries, human-readable metadata times, and additive measurements with explicit metric equivalents.
- Add `POST /api/recipes/:id/reimport` with an optional edited URL. Reuse guarded source fetching; reject empty/placeholder parses; parse before writing; preserve personal metadata, classification and history; reject a concurrent edit with HTTP 409.
- Add an accessible inline form under recipe More, visible only with `sourceUrl`, with editable URL, replacement explanation, loading/error/status feedback, and focus restoration.
- Add regression tests for the 3/1/5/3 method sections and API replacement, preserved metadata, edited sources, missing sources, failed/empty imports, validation, and concurrent edits.
- Back up the existing recipe, refresh it from the canonical URL, verify all 12 steps and source measurements in `heirloom.db` and on port 3000.
- Run `npm run test`, `npx nuxi typecheck`, build, adversarial diff review, and desktop/mobile browser checks including failed requests and keyboard focus.

Acceptance: all 12 source steps remain ordered and complete, timing ranges remain in instructions, ingredients preserve source measurements, the same recipe URL displays them, and failed re-imports never replace saved content.
