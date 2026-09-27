<!-- Hallmark · pre-emit critique: P5 H4 E4 S5 R5 V4 -->
# Hallmark responsive implementation

Implemented 2026-09-27 against `HALLMARK_RESPONSIVE_SPEC.md`, in its §8 execution order. Existing routes and culinary behavior are preserved; no server, shared culinary logic, schema, or migration files changed.

## Delivered

1. Locked OKLCH palette, legacy aliases, Nuxt UI bridge, heading guards, numeric/metadata utilities, reduced-motion support, root overflow clipping, and eight-state control styles.
2. Self-hosted Literata and Commissioner with Greek/Latin subsets, light default mode, safe-area viewport metadata, manifest and service worker.
3. Compact 56px top row, five-destination desktop navigation, and mobile bottom tabs. Import moved into recipe-list actions.
4. Safe-area layout spacing, editorial page polish, heart/siren icons, segmented Metric/US control, 44px targets, and metadata labels replacing decorative eyebrows.
5. Async feedback with silent two-second success reset, stable button widths with reserved spinner space, and field-specific server-validation descriptions in RecipeForm.
6. Compact Kitchen header, token-based progress, fixed 56px step controls, directional touch swipes, focused step headings, keyboard fallback, and dark theme-color.
7. Timer removal with five-second Undo preserving deadlines, completion reconciliation on restore, named timer states/icons, alert dismissal by button/downward swipe, and running-timer exit guards.
8. Token-based screen styling for vintage cards, preserving the dedicated physical-print palette as requested.
9. Literata “H.” outline source and generated standard/maskable/Apple icons. The glyph remains inside the central 80% safe zone.
10. Development-only eight-state matrix at `/dev/states`; production returns 404.

## Verification

| Check | Result |
|---|---|
| `pnpm test` | 565 tests pass in 31 files |
| `npx nuxi typecheck` | Pass |
| `pnpm run build` | Pass; production output and service worker generated |
| `node scripts/check-contrast.mjs` | All 16 declared text/ring/control pair checks pass |
| Playwright, 320 / 375 / 414 / 768px | 32 route/viewport combinations pass |
| Lighthouse 11, mobile, production localhost | PWA 100; installable manifest, maskable icon, theme-color and viewport checks pass |
| Chrome installation diagnostics | No installability errors |
| `git diff --check` | Pass |

The viewport script covers Home, recipes, recipe reader, cook, pantry, dinner, guests, and settings. It checks horizontal overflow, text-node `Range.getClientRects()` for wrapped labels, 44px targets including checkboxes, header height, tab visibility/current destination, fixed Kitchen controls, and computed button borders/fills. It fails on browser console errors, uncaught page errors, unexpected redirects, or failed requests. Home intentionally has no active destination tab; Kitchen intentionally has none of the default-layout tabs.

Additional browser checks exercised horizontal touch navigation and heading focus, unchanged deadline after Undo, pantry tab hiding/restoration on input focus/blur, invalid-title field error association, cancelled/accepted timer exit prompts, offline reopening of a previously visited recipe, and exclusion of a GET carrying `x-byok-key` from the API cache. The development matrix rendered all 40 class/state combinations. Chrome reported the Greek Kitchen title rendered with a custom Literata font, not fallback.

Verification uses an isolated `/tmp/heirloom-hallmark.db` and production port 3110. The repository's working database was not used for test fixtures. Screenshots use a temporary Greek recipe, not personal data.

## Integration corrections

- **Nuxt navigation:** an unrestricted Workbox `navigateFallback: '/'` served prerendered Home HTML for every route, and its Nuxt payload redirected navigation to Home. The fallback now applies only to Home; other visited documents use their own NetworkFirst cache. Unknown/unvisited routes are not promised offline. API reads have a separate GET-only cache; foreign origins, BYOK-bearing requests, AI/ingest routes, and mutations are excluded.
- **SSR title:** the Kitchen layout resolves its recipe title before rendering. Updating layout state from the child page caused a server/client hydration mismatch.
- **CSS layers:** Lucide CSS-mode icons prepend a component layer even ahead of head declarations during hydration. Icons now use Nuxt Icon's SVG mode, and an early head declaration locks `properties, theme, base, components, utilities` ordering so resets cannot override component controls. Browser assertions inspect computed styles, not only class names and dimensions.
- **Assets:** librsvg did not resolve CSS variables during PNG generation. Committed SVG paint attributes contain the exported palette values; the asset config resolves the paper background from the SVG token block, avoiding the generator's default white padding.
- **Dependency compatibility:** `@vite-pwa/nuxt` 1.1.1 uses assets-generator 1.0.4, within its declared peer range. Existing Nuxt dependency tooling reports an unrelated `unctx`/`unplugin` peer warning; tests, typecheck, and production builds pass. Rollup also removes a dependency's misplaced annotation during build; there are no build errors.

## Reproduce

```sh
pnpm test
npx nuxi typecheck
pnpm run build
node scripts/check-contrast.mjs
DATABASE_URL=/tmp/heirloom-hallmark.db pnpm run db:migrate
DATABASE_URL=/tmp/heirloom-hallmark.db NITRO_HOST=127.0.0.1 NITRO_PORT=3110 node .output/server/index.mjs
```

Run `scripts/hallmark-browser-checks.js` through the Playwright MCP code-file runner against port 3110. It creates/reuses a fixture only in the database behind that test server. For icons:

```sh
pnpm exec pwa-assets-generator --config scripts/pwa-assets.config.mjs
# To reconstruct the source outline from an original Literata variable font:
uv run --with fonttools python scripts/icon-mark.py /path/to/Literata.ttf
```

The outline command prints SVG for review; it does not overwrite the committed source automatically. Browser cache storage can contain personal recipe/guest data after offline use; README documents clearing it on shared devices and the HTTPS/localhost requirement. Updates offer explicit Reload outside Kitchen Mode.

## Screenshots

| Page | Mobile 375px | Desktop 1280px |
|---|---|---|
| Home | [Mobile](screenshots/hallmark/home-375.png) | [Desktop](screenshots/hallmark/home-1280.png) |
| Recipes | [Mobile](screenshots/hallmark/recipes-375.png) | [Desktop](screenshots/hallmark/recipes-1280.png) |
| Kitchen, timers and alert | [Mobile](screenshots/hallmark/cook-375.png) | [Desktop](screenshots/hallmark/cook-1280.png) |
| Dinner | [Mobile](screenshots/hallmark/meal-plan-375.png) | [Desktop](screenshots/hallmark/meal-plan-1280.png) |

## Remaining manual checks

Physical iOS Safari Add to Home Screen, Android Chrome installation, and real-device notch/home-indicator behavior were not available in this environment. CSS safe areas, browser installability and viewport behavior are implemented and exercised in Chromium; those physical-device checks remain manual. Camera hardware recognition and audible output were not re-certified by this visual change.
