# Phase 2 verification

Verified 2026-09-26 in `/home/alex/repos/cookbook` against the completed working tree.

| Check | Result |
| --- | --- |
| `pnpm test` | 155 tests passed across 12 files; zero errors or unhandled rejections |
| `pnpm run typecheck` | Exit 0 |
| `pnpm run build` | Exit 0; production Node bundle generated |
| `git diff --check` | Passed |
| Temporary SQLite migration | Passed with `/tmp/heirloom-phase2-qa.db`; existing cookbook database untouched |

## Automated coverage

- Existing 104 schema, migration, CRUD, Greek search, salt conversion, Host and CSRF tests retained.
- JSON-LD graphs, nested steps, durations, servings, fractions, quantity ranges, unit aliases, HTML cleanup, and inferred measurements.
- Private/reserved IPv4 and IPv6, alternate loopback representations, local hostnames, mixed public/private DNS answers, DNS pinning, private/malformed redirects, redirect loops and response-size limits.
- URL, prompt, and video HTTP handlers; caption extraction, description fallback, and rejection of generic YouTube error-page metadata.
- Five provider request/response formats using stubbed HTTP responses; keys excluded from URLs and request bodies; sanitized provider failures and deterministic no-key fallback.
- Cocktail rules, relevant science enrichment, and conditional substitution options.
- SSE event order, validated completion, error termination, origin protection, fragmented UTF-8/CRLF parsing, truncated streams, and provider cancellation through a real local HTTP connection.

## Production browser checks

Used Playwright against the built app at `127.0.0.1:3100`, with desktop 1365×900 and mobile 390×844 viewports.

- Memory draft streamed, remained unsaved until the explicit save action, then opened the stored recipe.
- Reader showed food science, sensory cues, and the poultry thermometer target; a cocktail showed stirred/dilution/glassware badges.
- Substitution dialog returned alternatives, supported Escape, and restored focus to its trigger. Mobile dialog and import view had no horizontal overflow.
- Private source URL and invalid/unavailable YouTube video produced errors without a completed draft.
- A real public URL (`bbcgoodfood.com/recipes/easy-pancakes`) returned HTTP 200 and parsed its structured recipe.
- Canceling a browser request held by a test route showed “Import cancelled”, restored the create button, and exposed no save action. Backend cancellation was independently covered by the real-socket test.
- Browser console: zero warnings and errors in the final checks.

Screenshots inspected: `/tmp/heirloom-phase2-import-desktop.png`, `/tmp/heirloom-phase2-import-mobile.png`, `/tmp/heirloom-phase2-substitution-mobile.png`.

## Review and limitations

Adversarial review covered source redirects/DNS rebinding, credential boundaries, provider errors, cancellation, untrusted text rendering, validation, source provenance, and accidental persistence. Review and browser checks fixed malformed redirect handling, generic YouTube descriptions, Nuxt shared-module resolution, and H3 event-stream cancellation rejections.

Live credentialed provider calls and an installed Ollama model were not exercised; provider contracts were checked using deterministic HTTP fixtures. Successful live YouTube caption availability is not guaranteed and was fixture-tested; blocked videos offer the memory-prompt path. Offline culinary generation and substitutions are intentionally bounded and explicitly labeled. See [implementation contracts and limitations](PHASE_2_IMPLEMENTATION.md).

No Phase 3 functionality or database schema changes were introduced.
