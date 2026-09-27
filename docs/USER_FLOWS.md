# Heirloom — End-to-End User Flows

From the landing page to the table: the seven journeys a home cook takes through Heirloom, as the app behaves today. Every flow is exercised automatically by `scripts/e2e-user-flows.js` at **1280 px (desktop)** and **375 px (mobile)**. Screenshots from the latest run are in [`docs/screenshots/e2e-flow/`](./screenshots/e2e-flow/).

```sh
pnpm run build          # the journey runs against the production bundle
pnpm run test:e2e       # = node scripts/e2e-user-flows.js
```

By default the script starts its own production server for each viewport, on a fresh temporary SQLite database that is migrated first (the documented setup). Flow 1 therefore always begins with an empty cookbook.

Environment options:
- `E2E_BASE_URL`: drive an already running app instead (for example `http://localhost:3000`).
- `E2E_PORT`: pin the isolated server's port.
- `CHROMIUM_PATH`: choose the browser binary.

On every step the script asserts:
- zero console errors, uncaught page errors, failed requests or HTTP 5xx responses;
- no horizontal overflow;
- no visible control shorter than 44 px;
- on mobile, the 5-tab bottom bar; on desktop, the 5-link top navigation. Kitchen Mode has its own shell.

## App shell (all flows)

| Viewport | Navigation |
| --- | --- |
| < 768 px | 56 px top bar (wordmark → `/`) and a fixed bottom tab bar: **Recipes · Pantry · Dinner · Guests · Settings**, with safe-area padding. The tab bar hides while a text field has focus. |
| ≥ 768 px | The same five destinations inline in the top bar; no tab bar. |
| Kitchen Mode | Its own dark shell: **Exit** · recipe title · **Rescue** in the top bar, plus a fixed bottom step bar. |

---

## Flow 1 — Landing → first-run Greek Starter Pack

**Route:** `/` → `/recipes`

1. **Landing (`/`).** Headline "Good food. Stories worth keeping." with **Open your cookbook**, plus secondary **Write a recipe →** and **Import Recipe**.
2. **Empty cookbook (`/recipes`).** On an unfiltered empty collection the page shows "Every collection starts with one recipe." with two actions:
   - **🌱 Load Starter Heirloom Recipes** → `POST /api/recipes/seed`
   - **Write your first recipe** → `/recipes/new`
3. **Starter Pack loads.** The seed returns `201 { created: 5 }`, the list refreshes, and five recipes appear: *Arni me Patates, Traditional Spanakopita, Santorini Fava, Classic Fasolada, Revani with Citrus Syrup*.
4. **Browse.** Search (Greek searches ignore accents and case), type filters (All · Food · Drinks · Baking · Desserts) and ♥ Favorites.

**States and edges:**
- The seed is idempotent. Once any recipe exists it returns `200 { created: 0 }` and touches nothing.
- The Starter action is never offered on a *filtered* empty state; that shows **Clear filters** instead.
- The seed button has loading, disabled and error-with-retry states.

**E2E:** Flow 1 · landing page; Flow 1 · open cookbook, empty state. **Screens:** `*-landing`, `*-recipes-empty-state`, `*-starter-pack-loaded`.

## Flow 2 — Recipe ingestion → post-save Metric Conversion Assistant

**Route:** `/recipes/import` → `/recipes/:id`

1. **Choose a source:**
   - **Web URL:** recipe JSON-LD is kept as structured data; otherwise page text is used.
   - **Video Link:** YouTube captions or description.
   - **Conversational Memory:** free text.
2. **Create recipe draft.** Progress streams over SSE (`POST /api/ai/recipe/stream`: `status → thought → recipe_chunk → complete`), and **Cancel** aborts it.
   - With no API key, a deterministic offline starting draft is produced. Inferred quantities are marked `[Inferred by AI]` and a warning explains the draft is not a recovered recipe.
   - With a BYOK key (Flow 7), the selected model normalises the source.
3. **Review and save.** Edit the title, review ingredients and "Method & food science", then **Save to Cookbook** (`POST /api/recipes`), which opens `/recipes/:id`. Nothing is saved automatically.
4. **Metric Conversion Assistant.** On a recipe page, a "Suggest Metric Conversions (g/ml)" panel appears whenever volume measures can be converted with a known density. That covers flour and sugars, liquids, butter, and salt by type (e.g. *2 tsp Greek fine sea salt → ~11 g*).
   - Each suggestion states its basis.
   - **Apply to recipe** rewrites those ingredients in grams/ml (`PUT /api/recipes/:id`); **Dismiss** hides the panel.
5. **Recipe page tools:**
   - servings scaling;
   - a **Metric / US** display toggle;
   - salt substitution, with the original salt "Unknown — no substitution" until chosen;
   - **Start cooking**, **Print heirloom card**, favourite, edit, delete (with confirmation);
   - keepsakes (dated tasting notes and family memories).

**E2E:** Flow 2 · import a recipe from memory; save draft to cookbook; metric conversion assistant (on *Arni me Patates*: the panel appears, **Apply** runs, and the salt is re-listed in grams). **Screens:** `*-import-draft`, `*-imported-recipe`, `*-metric-assistant`, `*-metric-applied`.

## Flow 3 — Kitchen Mode cooking

**Route:** `/recipes/:id/cook`

1. **Enter.** **Start cooking** opens the dark Kitchen layout. The screen wake lock is requested and its status shown, and a progress bar runs under the top bar.
2. **Move between steps:**
   - Swipe left for next and right for previous. A swipe counts at 60 px or more, only when mostly horizontal; vertical scrolling still works.
   - ← / → keys, and Space for next.
   - The fixed bottom step bar: **← Prev · n / N · Next →**, which becomes **Done** on the last step.
   - Optional camera "air swipe" gestures (processed on device only).
3. **Step guidance.** Sensory cues (look, listen, aroma, texture), internal temperature targets, "Why" food science and failure prevention. Also listed: the ingredients the step mentions.
4. **Heat panels:**
   - **Oven adjustment** for oven steps: recipe oven vs your oven (default from Settings), adjusting temperature *or* time. Fan reductions never go below 120 °C / 250 °F.
   - **Your burner** advice for steps with a heat level, tuned to the stove type in your kitchen profile.
5. **Timers:**
   - **Start Timer · mm:ss** is parsed from the step text; Greek units and the lower bound of a range are used.
   - Each timer card has **Pause/Resume** (primary), **Reset** and **Remove**. Remove leaves "Timer removed · **Undo**" for 5 s, and Undo restores the original deadline.
   - When a timer finishes, an alert is pinned above the step bar (**Dismiss**, or swipe down), with a chime once sound is enabled.
   - Timers survive a reload in the same tab (sessionStorage).
6. **Rescue My Dish.** A drawer offers quick offline guides (split sauce, too salty, scorched, soggy sear, acidic, spicy, bitter, sweet, bland) and "Describe another problem" (`POST /api/ai/rescue`, with an offline fallback). Signs of spoilage always route to "Pause, isolate, and diagnose" (do not taste).
7. **Exit.** **Exit** (or any navigation) with a running timer asks "Timers are still running. Leave Kitchen Mode?"

**E2E:** enter Kitchen Mode (step bar fixed to the viewport bottom); swipe between steps (left → next, right → back, short swipe ignored); oven heat panel and timers (start, pause, resume, remove, **Undo**); Rescue drawer ("Too salty" corrects the potato myth); exit guard (the confirmation fires). **Screens:** `*-kitchen-step-1`, `*-kitchen-oven-panel`, `*-kitchen-timer-undo`, `*-kitchen-timer-running`, `*-rescue-drawer`.

## Flow 4 — Dinner Conductor → conflicts → Interactive Market Shopping List

**Route:** `/meal-plan`

1. **The menu.** Up to 8 courses. Each has a recipe, a course type (Appetizer · Main · Side · Dessert · Beverage) and an optional serve time.
2. **The evening.** Guests sit down (24 h), guests (optional), burners, ovens (1–2) and month (for seasonality).
3. **Build the schedule** (`POST /api/meal-plan/orchestrate`):
   - **Backward schedule.** Courses are served at T, T+25 and T+60 by default, and each recipe's steps are scheduled back from its serve time. A preheat step is added where missing, and advance prep is moved to finish 30 minutes before service.
   - **Timeline.** Colour-coded course tags, phases (Advance prep · Active cooking · Resting & holding · Plating & serving), equipment chips and done checkboxes ("n of N steps done").
   - **Equipment conflicts.** An oven clash is flagged when concurrent settings are more than 15 °C apart and there are more of them than ovens; a burner overload when more burners are in use than you have. Each banner lists resolutions: bake the dessert earlier and rewarm, a fan-equivalent setting only where appropriate, staggering, and confirming doneness by thermometer. Observed in the run: *Revani with Citrus Syrup at 170 °C vs Arni me Patates at 190 °C (20 °C apart) with 1 oven*.
   - **Seasonality.** Per-ingredient badges (Peak · In season · Greenhouse · Off-season) with a "Flavor fix" for off-season produce.
4. **Market shopping list.** **Generate Market Shopping List** (`POST /api/grocery/generate`, scaled to the guest count) groups items by Greek market: **Laiki market**, **Butcher**, **Bakery** and **Supermarket**, each with its Greek name.
   - Items show butcher counter phrases (Greek), pack sizes and surplus tips, and a "Prepare ahead" list is included.
   - **Per-item routing:** each item has a **Shop at** selector that moves it to another destination.
   - **Checkoffs:** "n of N items checked", and **Copy shopping list** copies it to the clipboard.
   - **One-Stop Supermarket** mode regroups everything into supermarket aisles and locks the destination selectors. **Market Route** restores your custom routing, and checkmarks are kept across modes.
   - Checkoffs last while the list is open; regenerating, changing inputs or leaving the page clears them. Pantry stock is not subtracted.

**E2E:**
- **Build a three-course schedule:** Fava, Arni me Patates and Revani for 6 guests in January. Asserts serves at 20:00, 20:25 and 21:00, a conflicts-or-all-clear report, and the step checkoff count.
- **Market shopping list and routing:** asserts the destinations, a re-routed item staying routed, the checked count, One-Stop locking, and the route surviving a mode switch.

**Screens:** `*-conductor-schedule`, `*-conductor-conflicts`, `*-market-route`, `*-market-one-stop`.

## Flow 5 — Virtual Pantry and receipt matching

**Route:** `/pantry`

1. **Add an item:** name, quantity, unit, storage (pantry · fridge · freezer) and an optional expiry. The same item in the same place is merged (compatible units only).
2. **Filter** by storage. Expiry labels read "Use soon", "Expires …" or "Expired — excluded from matches".
3. **Add from a receipt:**
   - Paste OCR or receipt text, then **Parse receipt**. Totals, dates and prices are skipped, and weights like `0,450 KG` become quantities.
   - Review each drafted item, edit or discard it, then **Save reviewed items**.
4. **Cook With What I Have** (`POST /api/pantry/match`) ranks recipes by "% in stock" and gives a reason for each missing item.

**E2E:** add pantry items and parse a receipt (a two-line Greek receipt yields exactly two items and the total line is skipped); cook with what I have. **Screens:** `*-pantry-receipt-review`, `*-pantry-matches`.

## Flow 6 — Guests and allergen cross-referencing

**Route:** `/guests`

1. **Guest profile.** Name; allergies (gluten · dairy · nuts · shellfish · eggs · soy · fish · sesame, plus others); dietary requirements (vegan · vegetarian · halal · kosher · pregnant, plus others); dislikes; notes. Profiles can be edited and deleted (with confirmation).
2. **Check a meal.** Choose up to 20 guests and 20 recipes, then **Audit meal** (`POST /api/meal-plan/dietary-audit`).
   - The result always carries the notice that ingredient-name screening is not a safety clearance.
   - Conflicts are ordered **critical allergen** (with a cross-contact warning), then **dietary conflict**, then **dislike**, each with conditional substitutions.
   - Unknown allergies or requirements produce manual-review warnings.

**E2E:** a guest allergic to dairy and eggs, and vegetarian, is checked against *Traditional Spanakopita*. The barrel-aged feta is flagged as a critical dairy allergen. The starter's village pastry contains no egg, so exactly one conflict is correct. **Screen:** `*-guests-audit`.

## Flow 7 — Settings, BYOK keys, kitchen hardware, Cook's Handbook

**Routes:** `/settings`, `/handbook`

1. **Your AI providers (BYOK).**
   - Keys for OpenAI, Anthropic, Gemini, Groq and Ollama, plus an active provider and model, are saved in this browser's localStorage, unencrypted, and the page says so.
   - A key is sent only as a request header on an AI call you trigger. It is never stored on the server.
2. **Your kitchen hardware.** Stove (gas · induction · electric radiant), oven (convection fan · static conventional), appliances and preferred salt, saved with `PUT /api/settings/kitchen`. These drive Kitchen Mode's oven and burner guidance and the default salt.
3. **Cook's Handbook.** A link from Settings opens `/handbook`, the in-app reader for [`USER_GUIDE.md`](./USER_GUIDE.md), with **Back to Settings** and **Back to top**.

**E2E:**
- **BYOK keys stay in the browser:** the key persists across a reload, and no request body or header contains it.
- **Kitchen hardware profile:** induction and static oven persist after a reload.
- **Cook's Handbook:** the article renders its sections.

**Screens:** `*-settings`, `*-handbook`.

---

## Latest verification run

| Check | Result |
| --- | --- |
| `pnpm run test:e2e` | **PASS**: 36 steps and 142 assertions across 2 viewports; 42 screenshots; zero console errors, page errors, failed requests or 5xx |
| `pnpm test` | **PASS**: 610 tests in 34 files |
| `npx nuxi typecheck` | **PASS**: exit 0, no type errors |

## Issues found while verifying these flows

1. **The boot-time migration is a no-op in production builds** (`server/plugins/migrations.ts`).
   - The plugin resolves `../db/migrations` from `import.meta.url`, which inside `.output/server/chunks/…` doesn't exist, so it silently skips.
   - A fresh database started with `node .output/server/index.mjs` / `pnpm start` has no tables, and every API returns 500.
   - Docker is unaffected, because `docker/entrypoint.sh` runs `migrate.mjs` first. The e2e script migrates explicitly for the same reason.
   - Suggested fix: fall back to `join(process.cwd(), 'server/db/migrations')`, and log when no folder is found.
2. **Pluralisation.** The audit headline reads "1 conflicts to review" (`app/pages/guests/index.vue`).
3. **Emoji as icon.** The Starter action label uses "🌱" (Hallmark gate 30, generic emoji as icon). Consider the Lucide `sprout` icon, matching the rest of the app.
