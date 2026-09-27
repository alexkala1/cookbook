<!-- Hallmark · audit + implementation spec · genre: editorial · app shell: top bar + mobile tab bar · theme: custom (Heirloom editorial: cream paper · espresso ink · terracotta/sage/olive accents · Literata + Commissioner)
     Hallmark · pre-emit critique: P5 H4 E4 S5 R4 V4 -->

# Heirloom — Hallmark Responsive & Anti-Slop Spec

**Owner:** Codex (execution) · **Author:** Claude (Hallmark audit, 2026-09-27) · **Base commit:** `2127f8e`
**Status:** ready to execute. Every token below was contrast-checked; every finding was measured in a real browser (Chromium, 320 / 375 / 414 / 768 px, touch emulation) against the production build.

Execution rules: in-place edits and additive components only. No route, page, or component deletions. Preserve copy intent, the Greek/English content, and all existing tests. Colours and font families in touched files must come from the tokens in §2 — no new raw hex / `stone-*` / `amber-*` classes.

---

## 0. Pre-flight findings

| Signal | Finding | Source |
| --- | --- | --- |
| Framework | Nuxt 4.5 + Vue 3.5, `@nuxt/ui` 3.3.7 (bundles `@nuxt/fonts` 0.11.4, `@nuxt/icon` 1.15, `@nuxtjs/color-mode`) | `package.json`, `node_modules/.pnpm` |
| Styling | Tailwind v4 via `@nuxt/ui`; tokens in `@theme` as **hex** | `app/assets/css/main.css:4-11` |
| Fonts | `'Segoe UI', sans-serif` + `Georgia` — system stacks; Segoe UI does not exist on Android/iOS/Linux, so body text silently falls back per device | `main.css:9-10` |
| Icons | Lucide available (`@iconify-json/lucide`, used by `UButton` on home) | `app/pages/index.vue:18` |
| Motion | None installed (motion-cut project). Keep it that way. | `package.json` |
| PWA | **None.** No `@vite-pwa/nuxt`, no `public/`, no manifest, no icons, no `theme-color`, no Apple meta — despite `CLAUDE.md` declaring "Vite PWA" | `nuxt.config.ts`, repo root |
| Viewport | `width=device-width, initial-scale=1` — no `viewport-fit=cover`, so `env(safe-area-inset-*)` is 0 everywhere | measured in browser |
| design.md / .hallmark | none — this spec is the system record until a `design.md` is locked | repo root |

**Context (inferred):** audience = home cooks cooking Greek and Mediterranean food, often on a phone propped on the counter with wet hands · use case = find a recipe, then cook it hands-busy · tone = editorial (hand-set cookbook, warm paper, restraint).

---

## 1. Audit punch list

Format: `[severity] Tell — file:line` · why · → fix. Measured values in *italics*.

### Critical

1. **[critical] Wrap-to-multiple-lines primary nav (gate 49) — `app/layouts/default.vue:6-24`**
   Eight nav items in a `flex-wrap` row. *At 320 px the nav takes 3 rows and the header is 189 px tall (24 % of an 800 px screen); 157 px at 375/414.* Every page loses its first screen to navigation.
   → Replace with the app shell in §4: a 56 px top bar and a mobile bottom tab bar below 48 rem.
2. **[critical] Touch targets < 44 px on every page (Hit targets) — `default.vue:12-20`**
   *All 7 nav links measure 20 px tall; the wordmark is 36 px.* This fails the 44 × 44 floor on the most-used controls in the app.
   → The tab bar items are 56 px tall and span the full column width (§4).
3. **[critical] No PWA / standalone shell — `nuxt.config.ts`, missing `public/`**
   Kitchen Mode is built for a propped-up phone but can't be installed, has no offline shell, and has no safe-area handling.
   → §7.
4. **[critical] Mid-render token improvisation (gate 48) — 45 raw colour values across 8 files**
   - `app/layouts/kitchen.vue` has 14.
   - `app/pages/recipes/[id]/cook.vue` has 11: `text-amber-200` ×5, `bg-stone-900`, `border-stone-600`, `text-white`, …
   - `app/pages/recipes/[id]/print.vue` has 11.
   - The rest: `meal-plan/index.vue` (`bg-[#9c3f1f]`, `bg-sky-200`, `bg-amber-100/200`), `index.vue` (`text-emerald-800` ×2, `border-stone-200`), `pantry/index.vue` (`text-stone-600` ×4), `RescueDrawer.vue` (`text-amber-200` ×3).

   The emerald green on the home page belongs to no Heirloom colour.
   → Every value maps to a token in §2 (mapping table in §2.3).

### Major

5. **[major] Contrast failures on small text (gate 40) — `main.css:28` (`.eyebrow`), `pantry/index.vue:51`**
   - *Sage on cream is 4.43:1.* `.eyebrow` is 12 px sage text, so it fails AA.
   - *Terracotta on cream is 3.99:1* for the "Use soon" expiry warning.
   - *Cream on terracotta is 3.99:1* wherever terracotta is used as a fill.

   → Use `--color-sage-ink` (6.57:1) and `--color-terracotta-ink` (6.30:1) for text. Terracotta fills carry cream text only on `--color-terracotta-ink`.
6. **[major] Banned default type (typography § Banned defaults) — `main.css:9-10`**
   Georgia-as-default serif plus a font (Segoe UI) that doesn't exist on the target devices. The display and body weights are both 400, which fails the rule of at least 300 units of contrast.
   → Literata (display) + Commissioner (UI/body), self-hosted via `@nuxt/fonts`, with Greek subsets (§3).
7. **[major] Eyebrow on every section (gate 54 family) — 9 decorative page-intro eyebrows**
   Uppercase, tracked, accent-coloured kickers above every `h1`:
   - `recipes/new.vue:6`, `recipes/index.vue:18`, `guests/index.vue:30`, `settings.vue:35`
   - `recipes/import.vue:38`, `meal-plan/index.vue:56`, `pantry/index.vue:31`
   - `recipes/[id]/index.vue:143`, `RecipeKeepsakes.vue:22`, plus the emerald kicker at `index.vue:11`

   → Delete the decorative page-intro eyebrows. Keep *metadata* labels only (recipe type at `recipes/index.vue:43`, storage location at `pantry/index.vue:50`, conflict type at `guests/index.vue:58`, provenance at `import.vue:55`, type · cuisine at `recipes/[id]/index.vue:83`), restyled as `.meta-label` (§2.4). They label data; they aren't chapter numbers.
8. **[major] Hover-only / touch-sticky affordances — `main.css:30-32`**
   `hover:bg-*` sits outside `@media (hover: hover)`, so on touch the hover colour sticks after a tap. No button class has `:active`, loading, error or success styling. Disabled is `opacity-60` only, with no `aria-disabled` path for link-buttons.
   → The 8-state recipes in §5.
9. **[major] Generic emoji as icon (gate 30) — `RescueDrawer.vue:24` (🚨), `recipes/index.vue:26,43` and `recipes/[id]/index.vue:91` (♥ ♡)**
   → Lucide `i-lucide-siren` and `i-lucide-heart` (filled via `fill-current` when active). The print card's ❧ fleuron is typographic ornament, so keep it.
10. **[major] Kitchen Mode primary controls outside the thumb zone — `cook.vue:83`, `kitchen.vue:3-9`**
    *At 375 px the kitchen header stacks three rows (title, Exit, full-width Rescue) for 227 px* before the step text. Previous/Next sit mid-page and scroll away. There is no touch swipe; the only gesture is camera-based.
    → §6: a compact kitchen top bar, a fixed bottom step bar with safe-area padding, and `useSwipe` on the step card.
11. **[major] Off-palette progress bar — `cook.vue:76`**
    `accent-amber-300` doesn't apply, and the bar renders browser-default green.
    → Style the progress bar from tokens (§6.4).
12. **[major] Primary CTA under 44 px — `index.vue:18`**
    *`UButton size="xl"` measures 40 px tall.*
    → Use `.button-primary` (min 44 px) or `size="xl"` plus `min-h-11`.
13. **[major] Timer controls: no hierarchy, instant destructive remove — `cook.vue:98`**
    Pause, Reset and Remove look identical, and Remove deletes a running timer with no way back.
    → §6.5: Pause/Resume is primary; Reset and Remove are secondary; Remove gets a 5 s Undo instead of a confirm (Hallmark: undo over confirm).

### Minor

14. **[minor] Clickable text wraps at 320 px — `recipes/[id]/index.vue:108`** ("Metric · switch to US / imperial" filter pill) → shorten to "Metric" / "US" as a two-option toggle.
15. **[minor] Small secondary targets** — `recipes/[id]/index.vue:72` ("← All recipes", *17 px*), `pantry/index.vue:65` (receipt `<summary>`, *32 px*) → `min-h-11 inline-flex items-center`.
16. **[minor] Dead nav item** — `default.vue:21` "Shopping · soon" is a disabled `<span>` in the primary nav. → Remove it from the tab bar. The grocery page will get its own entry when it ships.
17. **[minor] Copy cliché** — `index.vue:11` "The family cookbook, reimagined" ("reimagined" is on-distribution filler). → Drop it with the eyebrow (item 7).
18. **[minor] `min-h-screen` (100vh) on mobile shells** — `default.vue:2`, `kitchen.vue:2` → `min-h-dvh`.
19. **[minor] Missing tabular figures on changing numbers** — timer countdown, amounts and T-labels already use `tabular-nums` in places. Apply it to every timer, amount and clock via `.num` (§3).

**Passes (keep):**
- Headings are roman everywhere. The only italics are body copy (the keepsake memory and the print-card memory), which is allowed.
- No horizontal overflow at any width.
- The home hero is left-biased with an aside, not the centred AI template.
- Kitchen Mode buttons are all at least 48 px and none of their labels wrap.
- Focus rings exist globally.

**Summary — 4 critical · 9 major · 6 minor**
**Verdict — reads as AI-generated on mobile.** The desktop editorial voice is close; phones get a wrapped nav, undersized targets, and system fonts.

---

## 2. Design tokens (lock these first)

### 2.1 Palette — OKLCH, contrast-verified

Replace the `@theme` block in `app/assets/css/main.css:4-11`. It stays **append-only** otherwise: keep `@import 'tailwindcss'` and `@import '@nuxt/ui'` at the top. The legacy names (`cream`, `espresso`, `sage`, `terracotta`) remain as aliases so no existing class breaks.

```css
@theme {
  /* Paper & ink — warm, never pure white/black */
  --color-paper:          oklch(98% 0.005 78);    /* #faf8f5 (was cream) */
  --color-paper-2:        oklch(95.5% 0.008 78);  /* hover surface */
  --color-paper-3:        oklch(92.5% 0.011 78);  /* pressed / selected surface */
  --color-rule:           oklch(84% 0.012 60);    /* hairlines, field borders */
  --color-muted:          oklch(46% 0.012 55);    /* secondary text — 6.76:1 on paper */
  --color-ink:            oklch(26.2% 0.017 43);  /* #2c221e (was espresso) — 14.6:1 */

  /* Accents — fills vs text are separate tokens */
  --color-terracotta:     oklch(59.9% 0.151 40);  /* decorative fills, rules, ≥24px text only */
  --color-terracotta-ink: oklch(48.9% 0.132 39);  /* text, links, warnings — 6.30:1; cream on it 6.30:1 */
  --color-sage:           oklch(55.3% 0.041 143); /* borders, checkbox accent, large text */
  --color-sage-ink:       oklch(46% 0.045 143);   /* small sage text — 6.57:1 */
  --color-olive:          oklch(50.3% 0.087 120); /* seasonality "peak", success marks — 5.47:1 */
  --color-olive-ink:      oklch(44% 0.08 120);    /* olive text / success fills w/ cream — 7.16:1 */
  --color-error:          oklch(48% 0.16 28);     /* 6.70:1 */
  --color-focus:          oklch(58% 0.14 40);     /* ring: 4.30:1 on paper, 3.40:1 on ink */

  /* Kitchen Mode (dark) */
  --color-k-paper:        oklch(15% 0.006 50);
  --color-k-paper-2:      oklch(22% 0.008 50);
  --color-k-rule:         oklch(52% 0.012 55);    /* control borders — 3.56:1 */
  --color-k-ink:          oklch(96% 0.008 80);    /* 17.5:1 */
  --color-k-muted:        oklch(78% 0.012 70);    /* 9.8:1 */
  --color-k-accent:       oklch(90% 0.11 90);     /* highlights, focus — 14.6:1 */
  --color-k-danger:       oklch(45% 0.16 27);     /* Rescue fill; k-danger-ink on it 7.37:1 */
  --color-k-danger-ink:   oklch(97% 0.01 27);

  /* Legacy aliases — keep until every class is migrated */
  --color-cream:     var(--color-paper);
  --color-espresso:  var(--color-ink);

  --font-display: 'Literata', ui-serif, Georgia, serif;
  --font-sans:    'Commissioner', ui-sans-serif, system-ui, sans-serif;
  --font-serif:   var(--font-display);

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-short: 120ms;
}
```

Accent budget: terracotta and olive together should cover under 5 % of any viewport. They mark active states, warnings, peak badges and focus; they are never section backgrounds.

### 2.2 Nuxt UI bridge

In `main.css`, after the imports, point Nuxt UI's primary colour at the tokens so `UButton` / `UIcon` stay in-system:

```css
:root { --ui-primary: var(--color-terracotta-ink); --ui-bg: var(--color-paper); --ui-text: var(--color-ink); }
```

Force light mode for the default layout (the app has no dark default theme). Kitchen Mode is dark by layout, not by `color-mode`. Set `colorMode: { preference: 'light', fallback: 'light' }` in `nuxt.config.ts`.

### 2.3 Raw-value → token mapping

| Raw value (current) | Token |
| --- | --- |
| `text-stone-600` | `text-muted` |
| `border-stone-200/300` | `border-rule` |
| `text-emerald-800`, `border-emerald-800` | `text-sage-ink`, `border-sage` |
| `bg-[#9c3f1f]` / `text-[#9c3f1f]` | `bg-terracotta-ink` / `text-terracotta-ink` |
| `bg-sky-200` (beverage tag) | `bg-paper-3 text-ink` |
| `bg-amber-100` (greenhouse badge) | `bg-paper-3 text-ink` + `border border-rule` |
| `bg-amber-200` (side tag) | `bg-olive text-paper` |
| kitchen `bg-stone-950`, `#1c1917` | `bg-k-paper` |
| kitchen `#292524`, `bg-stone-900` | `bg-k-paper-2` |
| kitchen `#a8a29e`, `border-stone-500/600`, `#57534e` | `border-k-rule` |
| kitchen `text-stone-50`, `#fafaf9`, `text-white` | `text-k-ink` |
| kitchen `text-amber-200`, `#fde68a`, `accent-amber-300` | `text-k-accent` |
| kitchen `bg-amber-200 text-stone-950` (alert) | `bg-k-accent text-k-paper` |
| kitchen `#991b1b`, `#fecaca` | `bg-k-danger`, `border-k-danger-ink/40` |
| print `#796249`, `#b6a18b`, `#657963`, `#2c221e`, `#21180f`, `#fffdf7` | `--color-rule`/`--color-sage`/`--color-ink`/`--color-paper` via `var()` in the `<style>` block |

### 2.4 Utility classes to add (`@layer components`)

```css
.num { font-variant-numeric: tabular-nums; }
.meta-label { font-size: .8125rem; letter-spacing: .06em; color: var(--color-muted); font-variant-caps: all-small-caps; }
```

`.eyebrow` stays defined, so existing metadata keeps rendering, but it is re-pointed: `color: var(--color-sage-ink)`. Page-intro usages are deleted (item 7).

---

## 3. Typography

- **Display: Literata**, roman only, weight **700** for `h1`/`h2`, 600 for `h3`, with optical sizing on (`font-optical-sizing: auto`). `letter-spacing: -0.02em` on `h1`.
- **Body/UI: Commissioner**, 400 for body and 600 for labels and buttons. It was designed by a Greek type designer, and its Greek glyphs are first-class, which matters for recipe titles like «Γιουβέτσι με μοσχάρι».
- Both load **Latin + Greek** subsets. Verified 2026-09-27: the Google Fonts CSS API serves `greek` for both families, and `greek-ext` for Literata too, so polytonic text is also covered.
- Self-host through `@nuxt/fonts` (already installed by Nuxt UI) so the fonts work offline in the PWA. In `nuxt.config.ts`:

```ts
fonts: {
  defaults: { subsets: ['latin', 'greek'], styles: ['normal'] },
  families: [
    { name: 'Literata', provider: 'google', weights: [600, 700] },
    { name: 'Commissioner', provider: 'google', weights: [400, 600] }
  ]
}
```

- **No italic headings, anywhere.** Add a base guard: `h1, h2, h3, h4 { font-style: normal; font-family: var(--font-display); }`. Italic stays allowed only inside body paragraphs (keepsake memory, print memory).
- Scale (perfect fourth): body 1rem · h3 1.333rem · h2 `clamp(1.75rem, 1.2rem + 1.5vw, 2.25rem)` · h1 `clamp(2.25rem, 1.4rem + 3.5vw, 4rem)`. Keep `overflow-wrap: anywhere; min-width: 0` on `h1`.
- Minimum UI text is 12 px, and only for tab-bar labels. Body is never below 16 px.
- `.num` on every timer, amount, T-label, clock and step counter.

---

## 4. App shell — top bar + mobile tab bar

Breakpoint: **48rem** (768 px).
- **Below 48rem:** top bar plus bottom tab bar.
- **48rem and up:** top bar with the same 5 destinations inline, on one row, with no tab bar.

### 4.1 Destinations (same order everywhere)

| Label | Route (active when path starts with) | Lucide icon |
| --- | --- | --- |
| Recipes | `/recipes` | `i-lucide-book-open` |
| Pantry | `/pantry` | `i-lucide-package` |
| Dinner | `/meal-plan` | `i-lucide-utensils` |
| Guests | `/guests` | `i-lucide-users` |
| Settings | `/settings` | `i-lucide-settings-2` |

- **Home** is reached through the wordmark.
- **Import Recipe** leaves the nav and becomes a secondary action beside "+ New Recipe" in the `recipes/index.vue` header (§8).
- **"Shopping · soon"** is removed (item 16).
- The tab is labelled **"Dinner"**, not "Dinner Conductor". Five columns at 320 px give 64 px each, and the longer label would wrap (gate 49). The page `h1` keeps the full name.

### 4.2 New files

`app/components/AppTopBar.vue`
- `<header>`: `position: sticky; top: 0; z-index: 30`, background `--color-paper`, bottom hairline `--color-rule`.
- `padding-top: env(safe-area-inset-top)` and `padding-inline: max(1rem, env(safe-area-inset-left))`.
- Inner row is 56 px tall: the wordmark (`font-display`, 1.5rem, links to `/`, 44 px hit target) on the left. From 48rem, a `<nav aria-label="Main">` with the 5 links inline (`white-space: nowrap`, 44 px targets, active = `aria-current="page"` plus a 2 px `--color-terracotta-ink` underline).
- On mobile the right side is empty. Pages that need an action put it in their own header.

`app/components/AppTabBar.vue`

```vue
<script setup lang="ts">
const route = useRoute()
const tabs = [
  { to: '/recipes', label: 'Recipes', icon: 'i-lucide-book-open' },
  { to: '/pantry', label: 'Pantry', icon: 'i-lucide-package' },
  { to: '/meal-plan', label: 'Dinner', icon: 'i-lucide-utensils' },
  { to: '/guests', label: 'Guests', icon: 'i-lucide-users' },
  { to: '/settings', label: 'Settings', icon: 'i-lucide-settings-2' }
]
const active = (to: string) => route.path === to || route.path.startsWith(to + '/')
</script>
<template>
  <nav class="tab-bar" aria-label="Main">
    <NuxtLink v-for="tab in tabs" :key="tab.to" :to="tab.to" class="tab" :aria-current="active(tab.to) ? 'page' : undefined">
      <UIcon :name="tab.icon" class="size-6" aria-hidden="true" />
      <span class="tab__label">{{ tab.label }}</span>
    </NuxtLink>
  </nav>
</template>
```

```css
.tab-bar {
  position: fixed; inset-inline: 0; bottom: 0; z-index: 30;
  display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
  padding-bottom: env(safe-area-inset-bottom);
  padding-inline: env(safe-area-inset-left) env(safe-area-inset-right);
  background: var(--color-paper); border-top: 1px solid var(--color-rule);
}
.tab {
  min-height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  color: var(--color-muted); font: 600 .75rem/1 var(--font-sans); white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
}
.tab[aria-current='page'] { color: var(--color-terracotta-ink); box-shadow: inset 0 2px 0 var(--color-terracotta-ink); }
.tab:active { background: var(--color-paper-3); }
@media (hover: hover) { .tab:hover { color: var(--color-ink); } }
.tab:focus-visible { outline: 2px solid var(--color-focus); outline-offset: -4px; }
@media (min-width: 48rem) { .tab-bar { display: none; } }
/* Keep the bar from riding above the on-screen keyboard while a field is being edited. */
@media (max-width: 47.99rem) {
  body:has(:is(input:not([type='checkbox'], [type='radio']), textarea, select):focus) .tab-bar { display: none; }
}
```

### 4.3 `app/layouts/default.vue`

- Replace lines 6–24 with `<AppTopBar />` and render `<AppTabBar />` after `<footer>`.
- Root: `min-h-dvh`.
- `<main>`: add `pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0`, so the last content and the footer clear the tab bar.
- Add `scroll-padding-bottom: calc(4.5rem + env(safe-area-inset-bottom))` on `html` below 48rem, so focused fields and anchors never hide under the bar.
- Keep the skip link, and point it at `#main-content`.
- The kitchen layout and the print page (`layout: false`) must **not** render the tab bar. They don't use `default.vue`, so no extra work is needed. Verify it.

---

## 5. Eight-state interactive discipline

Every control class below must ship all eight states: default, hover, focus-visible, active, disabled, loading, error, success. Replace `main.css:30-32` and extend `.field`.

```css
@layer components {
  .button-primary, .button-secondary, .filter-pill, .kitchen-button {
    position: relative; display: inline-flex; min-height: 44px; align-items: center; justify-content: center; gap: .5rem;
    white-space: nowrap; border: 1px solid transparent; border-radius: 999px;
    font: 600 .875rem/1.25 var(--font-sans);
    transition: background-color var(--dur-short) var(--ease-out), transform 80ms var(--ease-out);
  }
  .button-primary   { background: var(--color-ink); color: var(--color-paper); padding: .75rem 1.5rem; }
  .button-secondary { background: transparent; color: var(--color-ink); border-color: var(--color-rule); padding: .75rem 1.25rem; }
  .filter-pill      { background: transparent; color: var(--color-ink); border-color: var(--color-rule); padding: .5rem 1.25rem; }
  .filter-pill[aria-pressed='true'] { background: var(--color-ink); color: var(--color-paper); border-color: var(--color-ink); }

  /* hover — pointer devices only, so taps never leave a stuck colour */
  @media (hover: hover) {
    .button-primary:hover   { background: oklch(from var(--color-ink) calc(l + .08) c h); }
    .button-secondary:hover, .filter-pill:hover { background: var(--color-paper-2); }
  }
  /* focus — instant, never animated, offset so it sits on paper (≥3:1 vs page and fill) */
  .button-primary:focus-visible, .button-secondary:focus-visible, .filter-pill:focus-visible, .field:focus-visible {
    outline: 2px solid var(--color-focus); outline-offset: 2px;
  }
  /* active */
  .button-primary:active, .button-secondary:active, .filter-pill:active { transform: translateY(1px); }
  .button-secondary:active, .filter-pill:active { background: var(--color-paper-3); }
  /* disabled — three signals; link-buttons use aria-disabled */
  :is(.button-primary, .button-secondary, .filter-pill):is(:disabled, [aria-disabled='true']) { opacity: .55; cursor: not-allowed; transform: none; }
  /* loading — label stays readable, width locked, spinner in the reserved slot */
  :is(.button-primary, .button-secondary)[data-state='loading'] { cursor: progress; }
  :is(.button-primary, .button-secondary)[data-state='loading']::after {
    content: ''; width: 1em; height: 1em; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent;
    animation: spin .8s linear infinite;
  }
  /* error / success — colour is never the only signal: the label changes too */
  :is(.button-primary, .button-secondary)[data-state='error']   { border-color: var(--color-error); color: var(--color-error); background: var(--color-paper); }
  :is(.button-primary, .button-secondary)[data-state='success'] { background: var(--color-olive-ink); color: var(--color-paper); }

  /* fields — border width constant in every state (no layout shift) */
  .field { border: 1px solid var(--color-rule); background: var(--color-paper); min-height: 44px; outline: 2px solid transparent; }
  @media (hover: hover) { .field:hover { background: var(--color-paper-2); } }
  .field:disabled { opacity: .55; cursor: not-allowed; }
  .field[aria-invalid='true'] { border-color: var(--color-error); }
  .field-help, .field-error { display: block; min-height: 1lh; font-size: .875rem; }
  .field-error { color: var(--color-error); }
}
@keyframes spin { to { transform: rotate(1turn); } }
@media (prefers-reduced-motion: reduce) {
  [data-state='loading']::after { animation: none; border-right-color: currentColor; opacity: .6; }
  .button-primary, .button-secondary, .filter-pill { transition: none; }
}
```

**Wiring rules (per component):**
- **Async buttons** set `:data-state="busy ? 'loading' : failed ? 'error' : done ? 'success' : undefined"` and `:aria-busy="busy"`, and swap the label (Save → Saving… → Saved / Try again).
- **Success** auto-clears after 2 s, silently, with no toast.
- **Where the state machine lives:** in the existing `busy`/`saving`/`error` refs already present in `RecipeForm.vue`, `settings.vue`, `pantry/index.vue`, `guests/index.vue`, `meal-plan/index.vue`, `import.vue`, `RecipeKeepsakes.vue` and `SubstitutionDialog.vue`. Add a `done` ref where missing.
- **Server validation issues** (`issues[].path`) set `aria-invalid="true"` plus `aria-describedby` on the matching field. `RecipeForm.vue` currently only lists them in a banner.
- **Nav links in `NuxtLink`** get hover, focus, active and `aria-current`. Loading, error and success are N/A for pure navigation; document that in a comment.
- **Kitchen controls** use the same state set with Kitchen tokens (§6.2).
- **Build a demo wrapper** at `app/pages/dev/states.vue`, guarded by `import.meta.dev` (404 in production). It renders every class in all 8 states side by side using `.is-hover` / `.is-focus` / `.is-active` mirror classes. It is QA's single place to eyeball the matrix.

---

## 6. Kitchen Mode — mobile ergonomics

### 6.1 Layout (`app/layouts/kitchen.vue`)
- Root: `min-h-dvh bg-k-paper text-k-ink`.
- Top bar (sticky, `padding-top: env(safe-area-inset-top)`), a single 56 px row:
  - **left:** `Exit` (icon `i-lucide-x` plus label, 48 px)
  - **centre:** recipe title, one line, `text-ellipsis`
  - **right:** Rescue dock, a compact 48 px button with `i-lucide-siren` and the label "Rescue"; drop the full-width style (`kitchen.vue:24`)
- `<main>`: `padding-bottom: calc(5.5rem + env(safe-area-inset-bottom))` to clear the step bar.

### 6.2 Kitchen button states
`.kitchen-button` becomes:
- **Base:** `bg-k-paper-2`, `border-k-rule`, `text-k-ink`, min 48 px (56 px in the step bar).
- **Hover:** `(hover: hover)` → border `--color-k-muted`.
- **Focus-visible:** 3 px `--color-k-accent`, offset 3 px.
- **Active:** `translateY(1px)` plus background `oklch(from var(--color-k-paper-2) calc(l + .05) c h)`.
- **Disabled:** `.45` opacity.
- **Loading / error / success:** same `data-state` contract as §5, with `--color-k-accent` / `--color-k-danger` / `--color-olive`.

### 6.3 Fixed bottom step bar (`cook.vue:83`)
Move the Previous/Next `<nav>` into a fixed bar:
- **Position:** `bottom: 0`, `padding-bottom: max(.75rem, env(safe-area-inset-bottom))`, background `--color-k-paper` with a top hairline `--color-k-rule`.
- **Grid:** `grid-template-columns: minmax(0,1fr) auto minmax(0,1fr)`.
- **Buttons:** `← Prev` | `.num` step counter "3 / 7" | `Next →`, each 56 px tall.
- **Next** is the visually primary control (`bg-k-accent text-k-paper`). On the last step it becomes "Done" and links back to the recipe, subject to the exit guard.
- The inline "Final step…" line stays in the article.

### 6.4 Progress (`cook.vue:76`)
Replace `<progress>` styling:
- Track: `appearance: none; height: 6px; background: var(--color-k-paper-2)`.
- Fill: `::-webkit-progress-value` and `::-moz-progress-bar` use `var(--color-k-accent)`.
- Place it directly under the kitchen top bar, full width, so it doubles as a divider.

### 6.5 Swipe, timers, dismissal
- **Touch swipe:** `useSwipe` from `@vueuse/core` (already installed) on the step `<article>`.
  - `threshold: 60`. Left swipe goes to the next step, right swipe to the previous.
  - Fire only when `|Δx| > 1.5 × |Δy|`.
  - Ignore when `rescueOpen`, or when the gesture starts on `input, button, a, select, textarea`.
  - Add `touch-action: pan-y` on the article so vertical scroll stays native.
  - On navigation, move focus to the step heading with `preventScroll: true` for screen readers, and show no animation.
  - Update the "Contactless navigation" copy to mention swipe first, camera second.
- **Timer cards** (`cook.vue:98`), one card per timer:
  - **Header:** name.
  - **Countdown:** `.num`, 2.5rem.
  - **Row:** **Pause/Resume** (primary, 56 px, full-width on mobile), then **Reset** and **Remove** as 48 px secondary buttons.
  - Running, paused and finished are distinguished by label and icon (`i-lucide-play` / `pause` / `bell-ring`), not colour alone.
- **Remove → Undo, not confirm:** removing shows an inline row "Timer removed · **Undo**" for 5 s in the same slot (no layout shift, `role="status"`). Undo restores the timer with its original deadline. This needs a `restore(timer)` in `useCookingTimers.ts` that re-inserts it and calls `persist()`, and the removed timer is kept for 5 s.
- **Alert dismissal** (`cook.vue:99`):
  - The finished-alert banner becomes sticky just above the step bar: `bottom: calc(5.5rem + env(safe-area-inset-bottom))`, `bg-k-accent text-k-paper`, `role="alert"`.
  - One 56 px "Dismiss" button. A swipe-down on the banner also dismisses it, using `useSwipe` with direction `down`.
  - Dismissing never stops other running timers.
- **Exit guard:** if any timer is `running`, `Exit` and in-app route changes ask via `onBeforeRouteLeave` + `confirm()`: "Timers are still running. Leave Kitchen Mode?" Add a `beforeunload` handler for tab close. This closes the open finding from the Phase 4/5 review.
- **Rescue drawer** (`RescueDrawer.vue`): the dialog's close button is 48 px and sits at the top-right of `padding-top: env(safe-area-inset-top)`. The drawer body gets `padding-bottom: env(safe-area-inset-bottom)`.

---

## 7. PWA standalone

Add the dependency: `pnpm add -D @vite-pwa/nuxt` (npm latest is 1.1.1; peer dep `@vite-pwa/assets-generator ^1.0.0`, add that too). Prove compatibility with `pnpm run build` before writing further config.

`nuxt.config.ts`:

```ts
modules: ['@nuxt/ui', '@vueuse/nuxt', '@vite-pwa/nuxt'],
app: {
  head: {
    htmlAttrs: { lang: 'en' },
    viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
    meta: [
      { name: 'theme-color', content: '#faf8f5' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { name: 'apple-mobile-web-app-title', content: 'Heirloom' }
    ],
    link: [{ rel: 'apple-touch-icon', href: '/apple-touch-icon-180x180.png' }]
  }
},
pwa: {
  registerType: 'prompt',
  manifest: {
    name: 'Heirloom — Family Cookbook', short_name: 'Heirloom',
    description: 'Your family cookbook and kitchen companion.',
    start_url: '/recipes', scope: '/', display: 'standalone', orientation: 'portrait',
    background_color: '#faf8f5', theme_color: '#faf8f5', lang: 'en',
    icons: [
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  },
  workbox: {
    navigateFallback: '/',
    globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
    runtimeCaching: [{
      urlPattern: ({ url, request }) => request.method === 'GET' && /^\/api\/(recipes|settings\/kitchen|pantry|guests)(\/|$)/.test(url.pathname),
      handler: 'NetworkFirst', options: { cacheName: 'heirloom-api', networkTimeoutSeconds: 3, expiration: { maxEntries: 200, maxAgeSeconds: 604800 } }
    }]
  },
  client: { installPrompt: true },
  devOptions: { enabled: false }
}
```

Rules:
- **Never cache** POST/PUT/DELETE, `/api/ai/*`, `/api/ingest/*`, or any request carrying `x-byok-*` headers. The GET-only matcher above enforces this, so don't widen it.
- **Kitchen Mode status bar:** set `theme-color` to the Kitchen paper on the cook page via `useHead({ meta: [{ name: 'theme-color', content: '#0d0a09' }] })`, so the browser chrome goes dark with the page.
- **Icons:** create `public/` with a hand-built source mark `public/icon.svg`. It is **typographic**: the Literata "H" in `--color-ink` on `--color-paper`, with a terracotta full stop echoing the wordmark "Heirloom.". No illustration, no emoji, no gradient.
  - Generate the PNG set with `pwa-assets-generator --preset minimal-2023 public/icon.svg`.
  - Maskable safe zone: the glyph sits inside the central 80 %.
- **Update prompt:** use `registerType: 'prompt'` with a quiet in-app row ("A new version is ready · Reload"), not an auto-reload. A reload mid-recipe would drop in-memory Kitchen state.
- **Docker/self-hosting:** the service worker only registers on HTTPS or `localhost`. Note this in the README's self-hosting section.

---

## 8. Per-file punch list (execution order)

| # | File | Task | Findings closed |
| --- | --- | --- | --- |
| 1 | `app/assets/css/main.css` | §2.1 tokens, §2.2 bridge, §2.4 utilities, §3 heading guard, §5 state classes, `html,body { overflow-x: clip }` | 4, 5, 6, 8, 19 |
| 2 | `nuxt.config.ts` | `fonts` (§3), `colorMode`, `app.head` + `pwa` (§7) | 3, 6 |
| 3 | `app/components/AppTopBar.vue` (new), `AppTabBar.vue` (new) | §4.2 | 1, 2, 16 |
| 4 | `app/layouts/default.vue` | §4.3, `min-h-dvh` | 1, 2, 18 |
| 5 | `app/pages/index.vue` | Remove eyebrow + "reimagined"; tokens for emerald/stone; CTA min 44 px | 4, 7, 12, 17 |
| 6 | `app/pages/recipes/index.vue` | Delete page eyebrow (L18); Import Recipe as `.button-secondary` beside "+ New Recipe"; ♥ → `i-lucide-heart`; recipe-type label → `.meta-label` | 7, 9 |
| 7 | `app/pages/recipes/[id]/index.vue` | ♥/♡ → icon; metric toggle as two-option segmented control ("Metric" / "US"); "← All recipes" 44 px; type·cuisine → `.meta-label`; delete eyebrow at L143 | 7, 9, 14, 15 |
| 8 | `new.vue`, `import.vue`, `settings.vue`, `guests/index.vue`, `pantry/index.vue`, `meal-plan/index.vue`, `RecipeKeepsakes.vue` | Delete page-intro eyebrows; metadata eyebrows → `.meta-label`; raw colours → tokens (§2.3); async buttons get `data-state` (§5); pantry `<summary>` 44 px; pantry warning text → `text-terracotta-ink` | 4, 5, 7, 8, 15 |
| 9 | `app/layouts/kitchen.vue` | §6.1 top bar; tokens; `min-h-dvh`; compact Rescue dock | 4, 10, 18 |
| 10 | `app/pages/recipes/[id]/cook.vue` | §6.3 step bar, §6.4 progress, §6.5 swipe + timer cards + undo + alert + exit guard; tokens; `.num`; dark `theme-color` | 4, 10, 11, 13 |
| 11 | `app/composables/useCookingTimers.ts` | `restore()` for Undo (keeps persist-on-state-change contract) | 13 |
| 12 | `app/components/RescueDrawer.vue` | 🚨 → `i-lucide-siren`; tokens; safe-area padding | 4, 9 |
| 13 | `app/pages/recipes/[id]/print.vue` | Style block uses `var(--color-*)` / `var(--font-display)`; screen-only | 4 |
| 14 | `public/icon.svg` + generated PNGs | §7 icons | 3 |
| 15 | `app/pages/dev/states.vue` (dev-only) | 8-state matrix wrapper (§5) | 8 |

---

## 9. Acceptance criteria (all must pass)

**Automated, required in the PR:**
1. `pnpm test`, `pnpm run typecheck` and `pnpm run build` are all green. Existing tests are unchanged apart from intended copy updates.
2. New unit tests:
   - Tab-bar `active()` matching (`/recipes/abc/cook` → Recipes).
   - `useCookingTimers.restore()`, verifying the original deadline survives and exactly one storage write happens.
   - Swipe handler direction and threshold logic, extracted as a pure function `swipeIntent(dx, dy)`.
3. Playwright script (extend the existing QA pattern) at **320 / 375 / 414 / 768** on `/`, `/recipes`, `/recipes/:id`, `/recipes/:id/cook`, `/pantry`, `/meal-plan`, `/guests` and `/settings`:
   - No horizontal overflow.
   - **Zero** multi-line labels on `a, button, summary`, counted with `Range.getClientRects()`, not element height.
   - **Zero** interactive elements under 44 px tall, excluding the visually hidden skip link.
   - Below 768 px: header ≤ 64 px, tab bar visible with 5 links and `aria-current` on exactly one. At 768: tab bar hidden, nav on one row.
   - Kitchen: step bar visible and fixed; Next reachable without scrolling; swipe left advances (`page.touchscreen` or dispatched `TouchEvent`s).
   - No console errors or failed requests on any page.
4. Contrast: every text/background pair in §2.1 meets the stated ratio. Re-run the checker if any token value changes.
5. Lighthouse (mobile) on the production build served over `localhost`: **installable** (manifest + service worker + icons), `theme-color` set, viewport `viewport-fit=cover`.

**Manual:**
6. iOS Safari "Add to Home Screen" and Android Chrome install. In standalone mode:
   - The top bar clears the notch or status bar.
   - The tab bar and step bar clear the home indicator.
   - Focusing a pantry input hides the tab bar.
7. Greek recipe titles render in Literata/Commissioner, not a fallback face. Check «Γιουβέτσι» at 320 px in the tab-bar-free Kitchen top bar (ellipsis, no overflow).
8. Screenshots at 375 and 1280 attached to the PR: home, recipes, cook (step bar + a running timer + a finished alert), and meal-plan.

**Out of scope (do not do):**
- No dark mode for the default layout.
- No motion library.
- No redesign of page content or information architecture beyond §4.1.
- No new marketing sections.
- No invented metrics or testimonials.
- Don't touch server code or the database.
