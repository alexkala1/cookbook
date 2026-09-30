# Recipe translation verification

Implemented the five tasks from `docs/plans/recipe-translation.md` on branch `feat/recipe-translation`.

| Task | Evidence |
| --- | --- |
| 1. Acceptance tests | `d145a67`: Vitest failed because the translation route did not exist. |
| 2. Translation backend | `7437ab1`: 13 acceptance tests passed; Gemini rejected before fetch; source numeric and structural fields restored. |
| 3. Import draft translation | `c4550b2`: typecheck passed; remembered language, preserved source comparison, Save disabled during translation. |
| 4. Saved recipe translation | `2eae4cf`: typecheck and 14 tests passed; replacement or default family twist; strict input whitelist and fork cleanup. |
| 5. Full verification | All checks below passed; expanded regression and desktop/mobile coverage included. |

```sh
npx vitest run tests/recipe-translation.test.ts  # 16 passed
pnpm test                                     # 1,093 passed, 52 files
npx nuxi typecheck                            # exit 0
pnpm run build                               # exit 0
E2E_SCREENSHOT_DIR=/tmp/heirloom-translation-screenshots pnpm test:e2e
# 78 steps, 498 assertions, 108 screenshots; desktop 1280px and mobile 375px
git diff --check                             # exit 0
```

Browser coverage verifies draft translation, unchanged timer badges, disabled saving during translation, language preference storage, source comparison retention, focus transfer and restoration, family-twist lineage, replacement, failed fork cleanup, unchanged originals after failed replacement, 44px targets and no horizontal overflow. The built HTTP endpoint rejects Gemini with HTTP 400. No unexpected browser console errors, page errors or failed requests occurred; failure-path tests deliberately return HTTP 400 and check the resulting error UI.

Screenshots: `/tmp/heirloom-translation-screenshots/`. Desktop and mobile translation controls and failure states were visually inspected. The screenshot output override keeps test-generated images out of tracked baselines.

Adversarial review covered intent, correctness, security boundaries, silent failures, performance, reliability, maintainability and tests. No blocking findings remain. Existing provider configuration and `server/utils/ai/client.ts` are unchanged. Provider calls use deterministic test responses; no live paid-provider translation was performed. As specified in the plan, changed digits embedded in instructions produce warnings rather than automatic prose correction. Fork cleanup remains best effort.

The initial sandboxed full-suite attempt encountered existing tests requiring localhost sockets and child processes (`EPERM`). The complete suite passed with those permissions enabled. Tests were not skipped or weakened.

Logs: `/tmp/heirloom-translation-tests.log`, `/tmp/heirloom-translation-typecheck.log`, `/tmp/heirloom-translation-build.log`, `/tmp/heirloom-translation-e2e-final.log`.
