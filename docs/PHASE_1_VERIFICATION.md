# Phase 1 implementation and verification

Verified 2026-09-26 with Node.js 24.13.1, pnpm 11.22.0, Nuxt 4.5.2, Nuxt UI 3.3.7, H3 1.15.11, Zod 4.6.5, Drizzle ORM 0.45.3, and better-sqlite3 12.11.1.

## Implemented behavior

- Recipe/drink collection with search, type pills (Drinks includes cocktails), favorites, empty/error/retry states, and new recipe navigation.
- Recipe creation and editing with dynamic ingredient, method, sensory, and equipment rows; editorial reader with favorite/delete controls, serving scaling, salt substitution, unit switching, and heirloom notes.
- Cream, espresso, sage, and terracotta design tokens, serif headings, responsive layouts, labelled form controls, and keyboard focus styles.
- Browser-local keys for OpenAI, Anthropic, Gemini, Groq, and Ollama, plus active provider/model. Explicit save/clear and storage failure feedback. No keys enter the server database, SSR payload, or API requests. Keys are unencrypted localStorage; the settings page explains this.
- Kitchen hardware settings use only the fixed `default` ID through the API. The preferred salt initializes the reader’s substitution selector.

## HTTP contract

| Method / route | Behavior |
| --- | --- |
| `GET /api/recipes` | Array of recipes; optional `search`, `type`, `difficulty`, `cuisine`, `isFavorite` filters |
| `GET /api/recipes/:id` | Recipe plus `ingredients`, `steps`, and `equipment`; steps ordered by `stepNumber` |
| `POST /api/recipes` | Creates parent and nested children atomically; returns detail with status 201 |
| `PUT /api/recipes/:id` | Partial update; refreshes `updatedAt`; returns updated detail |
| `DELETE /api/recipes/:id` | Cascades recipe children and cooking sessions; status 204 |
| `GET /api/settings/kitchen` | Creates or returns singleton `default` profile |
| `PUT /api/settings/kitchen` | Validated partial upsert of singleton profile |

Validation rejects unknown fields, invalid enums, non-finite/negative quantities, invalid servings, duplicate step numbers, non-HTTP image/source URLs, and client-supplied IDs. Missing recipes return 404; invalid requests return 400 with field issues.

Nested arrays omitted from PUT stay unchanged. Supplied arrays replace the corresponding collection, and an empty array clears it. Child IDs are server-generated. Ingredient order follows `sortOrder`; the form normalizes step numbering after removal. Changing prep/cook time recomputes total time unless an explicit total is provided. Favorite-only updates preserve children. `isFavorite` query values must be `true` or `false`; `type=drinks` groups `drink` and `cocktail`.

## Conversion contract

`app/utils/units.ts` exports `convertSalt`, `convertUnit`, and `scaleIngredients`. Salt type IDs are `diamond_crystal_kosher`, `morton_kosher`, `table_salt`, and `greek_sea_salt`, using 2.8, 4.8, 5.9, and 5.5 g/tsp respectively.

Salt substitution returns an amount in the same input unit while preserving salt mass. Mass quantities remain unchanged. Generic conversions support `g`, `kg`, `oz`, `lb`, `ml`, `l`, `tsp`, `tbsp`, `cup`, `fl oz`, and `piece`. Volume factors use US customary measures. Incompatible dimensions and unknown units throw; scaling requires positive finite servings and does not mutate inputs.

The reader recognizes ingredients containing the word “salt”. Users explicitly select the original salt; the kitchen preference supplies the target. Pinches and other unsupported units remain as written with feedback. Generic conversions never guess ingredient densities.

## Schema and migration

- Added the three requested foreign-key indexes.
- New recipes default to null ratings; existing ratings are preserved.
- ORM updates refresh `updatedAt`, and PUT explicitly refreshes it.
- Added the kitchen ID default and Greek sea salt type.
- Migration `0001_adorable_eternity.sql` preserves children during SQLite’s parent-table rebuild. Generated `PRAGMA foreign_keys=OFF` is ineffective inside Drizzle’s transaction; a regression test caught cascading data loss. Temporary snapshots now restore ingredients, steps, equipment, and sessions safely.
- Updated docs/07 to match the schema; AST comparison found no differences in table initializers.

## Verification

| Check | Result |
| --- | --- |
| `pnpm run db:generate` | Exit 0; schema and migration metadata synchronized |
| `pnpm test` | 51 tests passed in 4 files |
| `pnpm run typecheck` | Exit 0 |
| `pnpm run build` | Exit 0; client, SSR, and Nitro output built |
| `pnpm run db:migrate` | Exit 0 for project database and separate browser QA database |
| HTTP integration tests | Real H3 handlers against in-memory SQLite, including transactional rollback and cascade checks |
| Upgrade regression | Populated Phase 0 database retains recipe children and history with foreign keys enabled |
| Browser CRUD | Create, read, edit, favorite, cancel deletion, confirm deletion; long cocktail instruction and Drinks filter verified |
| Browser conversions | Serving scaling, Diamond Crystal substitution, imperial conversion, preferred salt verified |
| Browser settings | Save/reload/clear keys, kitchen persistence, corrupt storage recovery; dummy key absent from network requests |
| Browser states | Search/type/favorites, no matches, empty collection, missing recipe, API failure/retry, invalid form, keyboard skip link |
| Responsive review | Collection, new form, reader, and settings checked at 1440, 768, 375, and 320 px; no horizontal overflow; desktop/mobile screenshots inspected |
| Final review | No blocking findings; validation, transaction boundaries, secret handling, migration safety, UI state, and contract compatibility checked |

The final production build has no application errors. Existing upstream dependency notices and the third-party Rollup annotation warning remain. Browser fault-injection checks intentionally produced failed requests. Happy-path flows passed without console errors. Chromium reported `net::ERR_ABORTED` after receiving a successful HTTP 204 DELETE response; the deleted record was absent, navigation completed, and HTTP integration tests independently verified deletion and cascades. This browser network diagnostic is recorded rather than counted as a failed API response.

AI calls/ingestion, live kitchen controls, and grocery routing remain out of scope. No AI provider connectivity is claimed by the settings screen. Tests and browser QA use temporary data; the temporary browser server is stopped after verification.
