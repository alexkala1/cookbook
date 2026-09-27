# Cook's Handbook delivery report

Verified 2026-09-27. The handbook is available from **Settings → Cook's Handbook**, at `/handbook`, and as repository Markdown. The browser page renders the same reviewed source document rather than maintaining a second copy.

## Files changed

| File | Result |
| --- | --- |
| `docs/USER_GUIDE.md` | Approximately 3,400 words across 13 main sections, with a linked contents list, practical procedures, reference tables, troubleshooting, Docker commands and backup guidance |
| `app/pages/handbook.vue` | Server-rendered reading page; stable heading anchors, navigation back to Settings, responsive tables/code blocks, normal-style headings, Hallmark color/font tokens |
| `app/pages/settings.vue` | Prominent Cook's Handbook link with explanatory copy, using the existing `button-secondary` class |
| `package.json`, `pnpm-lock.yaml` | Direct, locked `marked` dependency for rendering the trusted repository Markdown |
| `README.md` | Handbook documentation link |
| `scripts/handbook-browser-checks.js` | Repeatable Playwright checks for desktop/mobile navigation, anchors, focus, dimensions, reload, overflow, italic text and browser errors |
| `docs/screenshots/handbook/` | Five screenshots: Settings and guide at both widths, plus the starter-recipes table on mobile |
| `docs/HANDBOOK_VERIFICATION.md` | This report |

## Content coverage and accuracy

- First-run loading of all five Greek starter recipes and preservation of existing cookbooks.
- URL metadata/text ingestion, conversational notes, YouTube captions/description fallback, inferred quantities, review-before-save and prompt-injection defense limits.
- Recipe scaling, salt tracking, substitutions, food science and sensory cues.
- Kitchen touch swipes versus camera air waves, keyboard controls, wake lock, concurrent timers, original-deadline five-second Undo, heat mapping and Rescue.
- Backward dinner scheduling, serving times, equipment conflicts, seasonality and Greek grocery destinations.
- Pantry locations, expiry, receipt-text review, matching and manual stock reconciliation.
- Guest selection, menu ingredient audits, unsupported cases, cross-contact guidance and substitution review.
- Keepsakes, printable cards, local storage/BYOK privacy, offline limitations, Docker Compose, SQLite persistence and backups.

Two requested topics needed explicit boundaries based on the implementation: **Done does not auto-deduct pantry inventory**, and **grouped grocery generation is currently API-only**. The handbook documents the available manual/API workflows. This delivery does not add those product features or claim they exist. Touch `useSwipe` also remains distinct from hands-free camera motion detection.

## Verification results

| Check | Result |
| --- | --- |
| `pnpm test` | 573 tests pass in 32 files |
| `npx nuxi typecheck` | Exit 0 after correcting the Markdown renderer's TypeScript API usage |
| `pnpm run build` | Exit 0 for the final source; production server serves `/handbook` |
| `node scripts/check-contrast.mjs` | All existing token-pair checks pass; new link and guide text use ink/paper, 14.64:1 |
| `git diff --check` | Pass |
| Playwright at 375×900 and 1280×900 | Settings link, keyboard Enter navigation, visible focus, all contents targets, back-to-top, return to Settings and direct reload pass |
| Touch targets | Settings link measured 44px; all handbook contents links meet 44px height |
| Responsive/typography | No horizontal overflow; no italic content; mobile table and desktop/mobile screenshots visually inspected |
| Browser diagnostics | No console errors, page errors or failed requests during normal workflow |
| Failure path | With a deliberately failed kitchen-profile request on client navigation, Settings displays its error and the handbook link remains usable |

The new navigation link inherits the existing eight-state button styling. Navigation does not fabricate loading, success, error or disabled states; those shared styles remain available for controls that use them. Hover/pressed surfaces use the existing paper tokens. No new server endpoint, database mutation, user HTML renderer or remote document fetch was introduced.

Tests used an isolated `/tmp/heirloom-handbook-browser.db` and production port 3113. No personal cookbook data or API keys were required. Camera hardware, actual oven behavior, physical-device installation and Docker deployment were not rerun for this documentation change. Docker instructions were checked against the current Compose file and existing deployment documentation.

## Screenshots

- [Settings · mobile](screenshots/handbook/settings-375.png)
- [Settings · desktop](screenshots/handbook/settings-1280.png)
- [Handbook · mobile](screenshots/handbook/guide-375.png)
- [Handbook · desktop](screenshots/handbook/guide-1280.png)
- [Recipe table · mobile](screenshots/handbook/recipes-table-375.png)

## Final review

Reviewed intent, correctness, security, error handling, performance, reliability, maintainability and verification. Rendering is restricted to a build-time import of the reviewed Markdown file, with no user-controlled input. Contents links were checked against actual generated heading IDs. The Docker build context includes the source document, and the compiled output embeds it. No outstanding blocker was found in this change.
