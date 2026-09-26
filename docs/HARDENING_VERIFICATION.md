# Phase 1 architectural hardening

Verified 2026-09-26 against base commit `6c870f1`, with Nuxt 4.5.2, Nitro 2.13.4, H3 1.15.11, Drizzle ORM 0.45.3, better-sqlite3 12.11.1, Node.js 24.13.1, and pnpm 11.22.0.

## Changes

- Recipes store nullable `originalSaltType`. Create/edit forms persist it; the reader defaults to the stored value or “Unknown”. Unknown originals do not trigger density substitution. Explicit reader selections apply for that view; saving through Edit recipe remembers them. Serving scaling remains independent.
- `isPlainSalt()` recognizes English `salt` and Greek `αλάτι` / `αλατι`, including uppercase and decomposed Unicode. Garlic, celery, seasoned salt, and Greek garlic/celery variants are excluded. The canonical Greek type is now `greek_fine_sea_salt` at 5.5 g/tsp; existing kitchen preferences migrate from `greek_sea_salt`.
- Every database-generated timestamp uses SQLite `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`; application updates use `Date.toISOString()`. Both produce UTC ISO strings with milliseconds. Valid historical timestamps are normalized; null and unparseable historical values are preserved rather than discarded.
- The production SQLite connection registers deterministic `greek_lower`, using the shared `normalizeGreekText()` helper: NFD decomposition, removal of Unicode combining marks, then Greek locale lowercasing. Recipe search query handling explicitly uses the same helper; SQL normalizes both stored text and query values. `φασολάδα`, `φασολαδα`, and `ΦΑΣΟΛΑΔΑ` all match `Φασολάδα`. Cuisine filtering uses the same SQL function.
- `nuxt.config.ts` sets the development host to `127.0.0.1`. The preview/start scripts set `NITRO_HOST=127.0.0.1`. Direct execution of Nitro still requires that environment variable.
- Nitro middleware validates POST, PUT, PATCH, and DELETE source headers. A matching Origin or Referer is required; both must match when both are supplied. Checks include scheme and port, reject malformed/opaque origins and cross-site Fetch Metadata, and ignore forwarded host/protocol headers. These checks are CSRF protection, not authentication.
- Before the mutation checks, all requests must supply a valid, allowlisted Host. Defaults are `localhost`, `127.0.0.1`, and `[::1]`; `HEIRLOOM_PUBLIC_HOST` adds one exact public hostname. Wildcards, implicit subdomains, URL/IP aliases, and forwarded headers cannot grant access. This blocks matching malicious Host/Origin pairs used for DNS rebinding, including read requests.
- `getRecipe()` accepts the active query context; transaction writes read the resulting recipe through `tx` instead of the global database.

## Migration safety

`0002_mysterious_wolf_cub.sql` rebuilds timestamped tables and adds `original_salt_type`. Reviewed SQL snapshots recipe and grocery children before parent rebuilds, restores them, and drops temporary tables. Existing recipes explicitly receive a null original salt; no salt type is inferred.

Regression tests upgrade populated Phase 0 and Phase 1 databases with foreign keys enabled. They verify retained recipes, ingredients, steps, equipment, cooking history, pantry entries, grocery lists/items, guests, indexes, and kitchen preferences. They also cover offset timestamp normalization, nullable timestamps, foreign-key integrity, and repeated migration application. The project database and a separate browser-QA database migrated successfully.

## Verification

| Check | Result |
| --- | --- |
| `pnpm run db:generate` | Exit 0; no pending schema changes |
| `pnpm exec drizzle-kit check` | Exit 0; migration metadata valid |
| `pnpm run db:migrate` | Exit 0 |
| `pnpm test` | 104 tests passed across 5 files |
| `pnpm run typecheck` | Exit 0 |
| `pnpm run build` | Exit 0 |
| Runtime bind checks | Dev, preview, and production sockets observed at `127.0.0.1` on ports 3101, 3102, and 3100 |
| CSRF HTTP checks | Cross-origin and missing-origin POST rejected with 403; same-origin create/update accepted |
| CSRF regression matrix | All four mutation methods; missing/malformed/conflicting headers, scheme/port mismatch, credentialed URLs, forwarded-header spoofing, and safe methods |
| Host regression matrix | Local/public hosts accepted; missing, malformed, unlisted, lookalike, IP-alias, and spoofed forwarded hosts rejected; public-host configuration does not bypass origin checks |
| Transaction regression | Global reads deliberately fail during saves; transaction-based readback still succeeds |
| Browser salt checks | Unknown original unchanged; explicit selection converts plain Greek salt; seasoned English/Greek salts unchanged; saved original persists on reload |
| Search regression | Accented, unaccented, uppercase, lowercase, and decomposed Greek queries match stored accented titles |
| Production browser follow-up | Both `φασολαδα` and `ΦΑΣΟΛΑΔΑ` find `Φασολάδα`; collection, reader, and settings SSR load without console errors; forged Host returns 403 and configured public Host returns 200 |
| Responsive checks | Reader inspected at 1440 and 375 px; no horizontal overflow or console errors |
| Schema documentation | docs/07 table initializers match implementation |
| Final diff review | No blocking findings; migration preservation, validation, origin matching, secret boundaries, and update paths checked |

Existing upstream dependency notices and the third-party Rollup annotation warning remain non-fatal. No Phase 2 streaming, scraping, or AI calls were added. Temporary verification servers were stopped after checks.
