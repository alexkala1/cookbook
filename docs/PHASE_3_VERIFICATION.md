# Phase 3 verification

Verified 2026-09-26 in `/home/alex/repos/cookbook`.

| Gate | Result |
| --- | --- |
| `pnpm test` | 244 tests passed across 16 files; zero errors |
| `pnpm run typecheck` | Exit 0 |
| `pnpm run build` | Exit 0; production bundle generated |
| `git diff --check` | Passed |

New Vitest coverage checks reversible oven temperature/time conversion, burner physics guidance, preservation of food-temperature targets, timer units/ranges/fractions/compound durations and delayed ticks, motion direction/noise rejection, rescue lookup, request validation, CSRF, request-scoped BYOK and sanitized failures. Existing Phase 0–2 tests remain green.

Production Playwright checks used `/tmp/heirloom-phase3-qa.db` at desktop 1365×900 and mobile 390×844:

- Recipe reader → Start cooking → dedicated Kitchen layout → Exit kitchen → original reader.
- Step pagination, ArrowLeft/ArrowRight/Space, progress, matching ingredients, sensory cues, and induction-specific guidance.
- Multiple concurrent timers continued between steps; pause, reset, resume, and visible completion were exercised. A finishing timer created three Web Audio oscillator nodes; sound initialization reported ready.
- Conventional 200 °C → fan 180 °C; the alternative time strategy changed 30 minutes to 24 minutes. The 74 °C food target stayed unchanged.
- Instant salt/scorch guides, potato-myth explanation, custom offline rescue API requests, mobile drawer, Escape dismissal, and empty-step state.
- Direct SSR page load had no hydration errors after gating wake-lock capability UI until mount. Wake lock reported active. Measured step text was 32 px on mobile and 48 px on desktop, with no horizontal overflow.
- Real local canvas MediaStreams exercised the full camera pipeline: left swipe advanced, right swipe returned, camera toggle and unmount stopped tracks, rescue opening stopped tracks, and a permission promise resolving after exit immediately stopped its newly acquired tracks. Camera permission denial showed the keyboard/button fallback. Camera and instant rescue-guide interactions issued zero POST requests.
- Final browser checks reported zero console errors or warnings.

Screenshots inspected: `/tmp/heirloom-phase3-kitchen-desktop-final.png`, `/tmp/heirloom-phase3-kitchen-mobile-final.png`, `/tmp/heirloom-phase3-mobile.png` (rescue drawer).

Final review covered route nesting, SSR/browser API boundaries, late camera-permission races, frame privacy, cleanup, timer deadlines, mutually exclusive oven adjustments, food-temperature exclusions, and rescue validation/error handling. No database schema changes or package additions were needed; the existing cookbook database was untouched.

Limits: gestures were verified with synthetic local video, not a physical-camera kitchen trial. Oscillator scheduling was verified programmatically, not by listening to a hardware speaker. Paid AI providers were fixture-tested. Camera/wake-lock support requires browser permission and a secure context (HTTPS or localhost); motion detection can react to background movement. Timers are page-local and background browsers can delay alerts. See [implementation and operating details](PHASE_3_IMPLEMENTATION.md).
