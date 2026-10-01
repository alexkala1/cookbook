# Safe storage and texture-preserving reheating

Goal: One deterministic shared engine and one accessible card reused on recipe details and cooking completion. No persisted recipe changes or AI/network dependency at runtime.

Implementation:
1. Classify Greek/English dish names, tags, and supporting description/method evidence into six requested categories, with a clearly generic fallback for unrecognized cooked dishes. Ingredient names determine the shortest storage limit; side-dish suggestions must not override a recognized title.
2. Return typed fridge/freezer advice, prompt shallow-container cooling tips, texture-specific appliance guidance, chemistry notes, and a mandatory 74°C centre-temperature check when reheating. Appliance temperature and elapsed time do not prove safety.
3. Reuse a card in the recipe details and finish dialog. Maintain kitchen-theme contrast, native dialog focus/Escape behavior, and scrolling on short/mobile screens. Exclude drinks/cocktails and advice about reheating uncooked salads.
4. Test all categories, Greek accents, overlapping dishes, ingredient-based shortest lifespans, unsupported evidence, and pure return values. Run focused/full tests, typecheck/build, desktop/mobile Playwright, adversarial review, Jev score, then commit on feat/storage-reheating.

Safety decisions:
- Refrigerate shallow portions promptly, within 2 hours (1 hour above 32°C), at 4°C or colder. Do not wait for room-temperature cooling before refrigeration.
- Cooked meat/poultry: 3 days; vegetables/pasta: 4 days maximum; seafood: conservative 2 days. These are defaults, conditional on correct cooling/storage.
- Cooked rice takes precedence: cool within 1 hour, refrigerate for no more than 24 hours, reheat once. This stricter rice-specific guidance replaces the requested generic grains lifespan for rice-containing dishes.
- Freezer months express texture/quality estimates at -18°C; egg-lemon emulsions and custard fillings are marked unsuitable for freezing because of texture.
- Ladera may be served briefly at room temperature after refrigeration; the same room-temperature limits still apply.

Authoritative safety sources (verified 2026-10-01):
- [USDA leftovers: cooling, storage and reheating](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety)
- [FoodSafety.gov cold storage chart](https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts)
- [FoodSafety.gov safe internal temperatures](https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures)
- [FSA rice cooling/reheating guidance](https://www.food.gov.uk/sites/default/files/media/document/5-cminders-cookingsafely-01-cooking-and-reheating-safely.pdf)
- [EFSA safe handling](https://www.efsa.europa.eu/enIE/safe2eat/proper-food-handling)

Texture instructions (oven temperatures, time ranges, extra liquid, gelatin, starch and emulsion explanations) are culinary heuristics, not official safety limits; a thermometer and correct storage remain necessary.

## Final verification — 2026-10-01

- `npx vitest run tests/storage-reheating.test.ts`: 77 tests passed.
- `npm run test`: 60 files passed; 1,334 tests passed, one existing live market-price test skipped.
- `npx nuxi typecheck`: passed.
- `DATABASE_URL=$PWD/heirloom.db npm run build`: passed; final production entry point generated. An explicit database path keeps prerendering in this worktree.
- Playwright against the final production build: 1440px desktop and 390px mobile; all six categories, SSR/client output, correct rice/seafood limits, crispy microwave warning, egg-lemon freezing warning, keyboard-operated storage tips, cold-dish exclusion, native completion-dialog focus/Escape/scrolling, successful journal/pantry completion, and retained advice after a simulated journal save failure.
- No page errors, unexpected console errors, or failed requests. The deliberate 500 response was checked separately.
- Worktree-local screenshots: `.data/storage-card-1440.png`, `.data/storage-card-390.png`, `.data/storage-finish-1440.png`, `.data/storage-finish-390.png`, with additional scrolled advice screenshots. Browser binaries, temporary profiles, test database, and verification script remain under ignored `.data/`.
- Jev: `/home/alex/.local/bin/jev score --range 1-10 'Food storage and texture-preserving reheating engine quality'`, supplied the staged implementation diff on stdin: 8.84/10, ordinal label 9.
- Adversarial review: no runtime network calls or writes; input/output purity; bilingual word boundaries; named-dish precedence over serving suggestions; shortest actual-ingredient storage limit; preservation of separate Rice + Flour ingredient evidence; generic category tags not treated as ingredients; appliance vs centre temperature; microwave foil exclusion; freezer quality vs safety; native dialog behavior; and unrelated changes. `git diff --check` passed.

Classification is a culinary heuristic, not a complete food-identification database. An unrecognized dish receives clearly generic cooked-leftover guidance; drinks and cold salads are excluded from the UI. Correct cooling and refrigeration are prerequisites, and shorter package instructions take precedence.
