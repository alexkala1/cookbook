# Phase 2 hardening verification

Verified 2026-09-26.

## Changes

- Poultry cooking targets are applied after merging authored/generated step fields and enforce `Math.max(existingTarget ?? 0, 74)`. Higher targets and non-cooking targets are preserved.
- Generated URL, video, and prompt drafts have `originalSaltType: null` and omit `imageUrl`, `rating`, and `isFavorite`. JSON-LD may retain a validated, explicitly supplied `originalSaltType` enum value and source image. Generic salt names and invalid salt specifications remain unknown.
- Offline substitutions use whole Latin words and Greek word boundaries with accent normalization. Requested compound exclusions return 422. Self-substitutions are filtered from both offline and live-provider options; insufficient distinct options return an actionable error.
- Garnish ingredients do not trigger shaking. Citrus with sparkling uses “Shaken, topped with sparkling” and a flute; carbonation is added after shaking. Stirred estimates use 40–45% dilution and 15–20 °C cooling; shaken estimates use 50–60% and 20–25 °C. Dilution refers to added water relative to the initial drink/base volume.
- SSE forwards actionable 4xx status messages while retaining the generic sanitized message for 5xx and unknown errors.

## Evidence

| Check | Result |
| --- | --- |
| `pnpm test` | 207 tests passed across 12 files, zero errors |
| `pnpm run typecheck` | Exit 0 |
| `pnpm run build` | Exit 0, production bundle generated |
| `git diff --check` | Passed |

Regression tests exercise low/missing/high poultry temperatures, non-cooking steps, metadata hygiene through all three ingestion routes, explicit/invalid/absent JSON-LD salt types, compound exclusions, Greek punctuation/case/diacritics, self-substitutions, all six garnish labels, French 75 classification, calibration ranges, private-address and missing-model SSE messages, and sanitized upstream 502 failures.

Production Playwright checks at 1365×900 and 390×844 confirmed the actionable private-address error, corrected French 75 badges, and a lemon substitution dialog containing lime and vinegar rather than lemon. No horizontal overflow or browser console warnings/errors. Screenshot inspected: `/tmp/heirloom-phase2-hardening-mobile.png`.

QA used `/tmp/heirloom-phase2-hardening-qa.db`; the cookbook database was not modified. Final diff review checked safety-field merge order, source provenance, substitution boundaries and output counts, carbonation handling, and error-message sanitization. Live paid providers were fixture-tested, not called.
