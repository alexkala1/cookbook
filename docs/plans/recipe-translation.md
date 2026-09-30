# Recipe Translation (Greek + preferred languages) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]` checkboxes. Work TDD: Task 1 writes the failing suite first.

**Goal:** Translate a recipe into Greek (`el`, Ελληνικά) or another preferred language, both for an unsaved import draft and for a saved recipe, without altering any number.

**Architecture:** One stateless route `POST /api/ai/recipe/translate` takes a `recipeCreateSchema` recipe + `targetLanguage`, asks the BYOK model to translate **text fields only**, then a deterministic post-step copies every numeric/structural field back from the source (the model's numbers are never trusted). Import page translates the in-memory draft; saved-recipe page translates, then either `PUT`s in place or forks a twist and `PUT`s the fork. No DB/schema change.

**Tech Stack:** Nuxt 4 / Nitro (h3), zod 4, Vitest (`npm test`), existing `aiClient` (`server/utils/ai/client.ts`), `recipeCreateSchema` (`server/utils/validation.ts`).

**Spec:** this file (task brief from planning architect).

## Global Constraints

- **NO GEMINI.** Allowed providers for translate: `openai`, `anthropic`, `groq`, `ollama` (BYOK headers `x-byok-*`). `x-byok-provider: gemini` → HTTP 400 before any fetch. Do not edit `client.ts` provider lists (other routes still use gemini).
- Never fabricate a translation: with no key (`client.mode === 'fallback'`) the route returns 400 `"Add an AI key (or choose Ollama) in Settings to translate recipes."` — it must not return the untranslated recipe as if translated.
- Preserved **exactly** (copied from source, not from model): every `ingredients[].amount`, `gramsEquivalent`, `sortOrder`; `steps[].stepNumber`, `durationMinutes`, `timerRequired`, `heatLevel`, `internalTempTargetC`, `sortOrder`; `servings`, `prepTimeMinutes`, `cookTimeMinutes`, `totalTimeMinutes`, `difficulty`, `recipeType`, `originalSaltType`, `rating`, `isFavorite`, `sourceUrl`, `sourceType`, `imageUrl`; array lengths/order of ingredients, steps, equipment; `equipment[].isEssential`.
- Translated (text) fields only: `title`, `description`, `cuisine`, `heirloomNotes`, `storageReheating`, `ingredients[].{name,unit,notes,category}`, `steps[].{instruction,scienceWhy,failurePrevention,sensoryVisual,sensoryAudio,sensoryAroma,sensoryTexture}`, `equipment[].{name,substituteTool}`.
- Supported `targetLanguage` codes (single source of truth `translationLanguages` in `server/utils/ai/translate.ts`): `el` Ελληνικά, `en` English, `es` Español, `fr` Français, `it` Italiano, `de` Deutsch, `pt` Português, `tr` Türkçe. Default everywhere: `el`.
- Errors from providers flow through `aiClient().generate` which already calls `humanizeProviderError`; the route must let those `createError`s propagate unchanged (status + statusMessage), never wrap with secrets/raw bodies.
- Code style: match repo (no semicolons, 2-space, compact one-line handlers, `defineEventHandler` from `h3`).

## Review Focus

- Model returns shifted numbers (`amount: 2` → `3`, `durationMinutes` 20 → 25): output must still equal source numbers.
- Model returns fewer/more steps or ingredients: route 502 `"Translation changed the recipe structure. Try again."`, never saves partial.
- Numbers embedded in prose (`"bake 20 min at 180°C"`): if digit tokens in a translated `instruction` differ as a multiset from source → add a warning string (not an error) in `warnings`.
- `gemini` provider header, missing model with key set (client already returns 400 "Choose an AI model in Settings"), no key.
- Saved-recipe fork path: fork succeeds but PUT fails → fork is deleted (best effort) and original untouched; in-place path failure leaves the recipe unchanged.
- Recipe with `null`/absent optional fields (`cuisine: null`, no equipment): output keeps them null/absent, no `"null"` strings.

---

### Task 1: Failing acceptance suite

**Files:**
- Create: `tests/recipe-translation.test.ts`

**Interfaces:**
- Consumes: `default` handler from `../server/api/ai/recipe/translate.post` (Task 2); `enforceInvariants`, `translationLanguages` from `../server/utils/ai/translate` (Task 2); `recipeCreateSchema`.
- Produces: the acceptance gate for Tasks 2–4.

Follow the harness in `tests/ai-stream.test.ts` (`createApp().use(csrf).use(handler)`, `toWebHandler`, `vi.stubGlobal('fetch', …)`, `afterEach(() => vi.unstubAllGlobals())`, headers `{ Host:'localhost', Origin:'http://localhost', 'Content-Type':'application/json' }`).

- [ ] **Step 1: Write the tests.** Fixture `source` (valid `recipeCreateSchema`): title "Lemon Chicken", 2 ingredients (`{name:'chicken thighs',amount:1.5,unit:'kg',gramsEquivalent:1500}`, `{name:'lemon',amount:2,unit:'whole'}`), 2 steps (step 1 `durationMinutes:20,timerRequired:true,heatLevel:'medium',internalTempTargetC:74, instruction:'Roast 20 minutes at 180°C.'`; step 2 plain), 1 equipment, `servings:4`, `prepTimeMinutes:15,cookTimeMinutes:45,totalTimeMinutes:60`. Helper `providerReply(obj)` returns `new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(obj)}}]}))` (openai shape, headers `x-byok-provider:openai,x-byok-key:secret-test,x-byok-model:test`). Required `it(...)` cases:
  1. `translationLanguages` includes `el` with label `Ελληνικά` and contains exactly codes `el,en,es,fr,it,de,pt,tr`.
  2. **Greek happy path:** provider reply = Greek text but **tampered numbers** (amount 3, durationMinutes 25, internalTempTargetC 90, servings 9); response `recipe` passes `recipeCreateSchema.safeParse`, text is Greek (`/[Α-Ω]/`), and every number listed in Global Constraints `toEqual` the source; `targetLanguage:'el'` appears in the outgoing provider request body (`fetchSpy.mock.calls[0][1].body` contains `Greek`); response has `mode:'live'`.
  3. **Default language** omitted → request body mentions Greek.
  4. **Structure change** (reply has 1 step) → status 502, message contains `changed the recipe structure`.
  5. **Prose-number warning:** reply instruction `'Ψήστε 25 λεπτά στους 180°C.'` → 200, `warnings` has 1 entry mentioning step 1; numeric fields still from source.
  6. **No key** → 400 containing `Add an AI key`; `fetch` not called.
  7. **Gemini** (`x-byok-provider:gemini`, key set) → 400 containing `Gemini`; `fetch` not called (assert no `generativelanguage` URL ever).
  8. **Unsupported language** `'xx'` → 400; **missing recipe** → 400; foreign Origin → 403 (csrf middleware).
  9. **Provider 401** → status 401 and message contains `API key was rejected` (proves `humanizeProviderError` path) and does not contain `secret-test`.
  10. `enforceInvariants(source, reply)` unit: null `cuisine` stays null, absent `equipment` stays absent.
- [ ] **Step 2: Run, verify FAIL (module not found):**
  `cd /home/alex/repos/cookbook && npx vitest run tests/recipe-translation.test.ts`
  Expected: FAIL, cannot resolve `translate.post` / `ai/translate`.
- [ ] **Step 3: Commit** only this file: `git add tests/recipe-translation.test.ts && git commit -m "test(translate): failing acceptance suite for recipe translation"`
  (Repo worktree is shared with other agents: never `git add -A`; `git diff` before editing.)

### Task 2: Backend util + route

**Files:**
- Create: `server/utils/ai/translate.ts`
- Create: `server/api/ai/recipe/translate.post.ts`

**Interfaces:**
- Produces (`translate.ts`):
  ```ts
  export const translationLanguages = [{ code: 'el', label: 'Ελληνικά', name: 'Greek' }, /* en es fr it de pt tr */] as const
  export type TranslationLanguage = typeof translationLanguages[number]['code']
  export const translateRequest: z.ZodType<{ recipe: RecipeInput, targetLanguage: TranslationLanguage }> // targetLanguage default 'el'
  export function enforceInvariants(source: RecipeInput, translated: RecipeInput): { recipe: RecipeInput, warnings: string[] } // throws createError 502 on length mismatch
  ```
- Route response: `{ recipe: RecipeInput, warnings: string[], mode: 'live', targetLanguage }`.

- [ ] **Step 1:** `translate.ts`: `translateRequest = z.object({ recipe: recipeCreateSchema, targetLanguage: z.enum(codes).default('el') }).strict()`. `enforceInvariants`: if `ingredients/steps/equipment` lengths differ → `createError({ statusCode: 502, statusMessage: 'Translation changed the recipe structure. Try again.' })`. Build result as `{ ...source, <text fields from translated, only where source field is non-null/non-empty> }`, mapping arrays by index (`{ ...src, name: t.name, unit: t.unit, notes: src.notes == null ? src.notes : t.notes, … }`). Empty/whitespace translated text falls back to source text. Warning per step when `instruction.match(/\d+(?:[.,]\d+)?/g)` sorted arrays differ: `` `Step ${n}: numbers in the translated text differ from the original — please check.` ``. Finally `recipeCreateSchema.parse(result)`.
- [ ] **Step 2:** `translate.post.ts`:
  ```ts
  import { createError, defineEventHandler, getHeader, readBody } from 'h3'
  import { aiClient } from '../../../utils/ai/client'
  import { enforceInvariants, translateRequest, translationLanguages } from '../../../utils/ai/translate'
  import { recipeCreateSchema, validate } from '../../../utils/validation'
  export default defineEventHandler(async event => {
    const { recipe, targetLanguage } = validate(translateRequest, await readBody(event))
    if ((getHeader(event, 'x-byok-provider') || '').toLowerCase() === 'gemini') throw createError({ statusCode: 400, statusMessage: 'Gemini is not supported for translation. Choose OpenAI, Anthropic, Groq or Ollama in Settings.' })
    const client = aiClient(event)
    const lang = translationLanguages.find(l => l.code === targetLanguage)!
    const translated = await client.generate(recipeCreateSchema, `Translate every human-readable text field of this recipe into ${lang.name} (${lang.label}). Keep the JSON structure, array order and array lengths identical. Copy every number, amount, durationMinutes, timerRequired, heatLevel, internalTempTargetC, servings and time value EXACTLY; never convert units or rescale. Translate unit words only.`, JSON.stringify(recipe), () => { throw createError({ statusCode: 400, statusMessage: 'Add an AI key (or choose Ollama) in Settings to translate recipes.' }) })
    return { ...enforceInvariants(recipe, translated), mode: client.mode, targetLanguage }
  })
  ```
  (Do not import `humanizeProviderError` directly unless needed; it is applied inside `generate`. If the executor prefers an explicit reference, re-use it only for a provider-error wrapper with identical output — test 9 is the gate.)
- [ ] **Step 3: Run:** `npx vitest run tests/recipe-translation.test.ts` → Expected: all PASS.
- [ ] **Step 4: Commit:** `git add server/utils/ai/translate.ts server/api/ai/recipe/translate.post.ts && git commit -m "feat(ai): recipe translation route with numeric invariants"`

### Task 3: Import draft UI

**Files:**
- Modify: `app/pages/recipes/import.vue` (script: near `save()`; template: inside draft `<article>` just above `<label class="mt-6 block">Recipe title`)
- Create: `app/utils/translation-prefs.ts` (shared with Task 4)

**Interfaces:**
- Produces (`translation-prefs.ts`): `translationLanguageOptions` (re-declared as `{ code, label }[]` for the client, same 8 codes; do NOT import from `server/`), `readTranslateLang(): string` (localStorage `heirloom.translate.lang.v1`, default `'el'`, try/catch), `writeTranslateLang(code: string): void`.

- [ ] **Step 1:** Script: `const targetLang = ref('el'); onMounted(() => { targetLang.value = readTranslateLang() })`, `translating = ref(false)`, `translateError = ref('')`, `translateNote = ref('')`. `async function translateDraft()`: guard `!draft.value || translating.value || saving.value`; `fetch('/api/ai/recipe/translate', { method:'POST', headers:{'Content-Type':'application/json', ...requestHeaders()}, body: JSON.stringify({ recipe: draft.value, targetLanguage: targetLang.value }) })`; on `!ok` read JSON `statusMessage`/`message` into `translateError`; on success `draft.value = data.recipe`, `warnings.value = [...warnings.value, ...data.warnings]`, `translateNote.value = 'Translated to ' + label + '. Numbers and timers are unchanged.'`, `writeTranslateLang`. Do **not** clear `original` (side-by-side compare keeps the source text). Disable Save while `translating`.
- [ ] **Step 2:** Template: a `row-panel` with `<label>` "Translate draft to" + `<select v-model="targetLang" class="field" data-testid="translate-lang">` (options from `translationLanguageOptions`, Greek first/default) and `<button type="button" class="button-secondary min-h-11" data-testid="translate-draft" :disabled="translating || busy || saving" @click="translateDraft">Translate draft</button>`, `aria-busy`, `role="alert"` for `translateError` with an "Open AI Settings" link when it mentions Settings, `aria-live="polite"` for `translateNote`. Touch targets ≥ 44px; works at 375px width.
- [ ] **Step 3: Verify:** `npm run typecheck` → 0 errors.
- [ ] **Step 4: Commit:** `git add app/pages/recipes/import.vue app/utils/translation-prefs.ts && git commit -m "feat(import): translate draft before saving"`

### Task 4: Saved recipe UI (More menu)

**Files:**
- Modify: `app/pages/recipes/[id]/index.vue` (script near `makeTwist` ~L38-54; More menu ~L174-176 add item after "Make a twist"; a panel after the twist `<form>` ~L181-192)
- Create: `app/utils/recipe-input.ts`

**Interfaces:**
- Produces: `toRecipeInput(detail: RecipeDetail): RecipeInput` — whitelist copy of `recipeCreateSchema` keys only (strip `id`, `recipeId`, `createdAt`, `updatedAt`, `parentRecipeId`, `variationName`, `parent`, `variations`; ingredients/steps/equipment likewise stripped of `id`/`recipeId`); null `imageUrl`/`sourceUrl` kept as-is when schema allows, else omitted.

- [ ] **Step 1:** `recipe-input.ts` as above. Add a tiny unit test block to `tests/recipe-translation.test.ts`: `toRecipeInput(detailFixture)` passes `recipeCreateSchema.safeParse` (proves `.strict()` compliance).
- [ ] **Step 2:** More menu button (icon `i-lucide-languages`) "Translate recipe" → `closeMore(); translating = true`. Panel (`keepsake-card`, same style as twist form): language `<select>` (default from `readTranslateLang()`), radio group **"Save as a family twist (keeps original)"** (default, checked) / **"Replace this recipe"**, submit "Translate", "Not now". Copy for replace: "The original wording will be overwritten."
- [ ] **Step 3:** `translateRecipe()`: `POST /api/ai/recipe/translate` with `headers: requestHeaders()` and `{ recipe: toRecipeInput(recipe.value), targetLanguage }` via `$fetch`. Then
  - **replace:** `await $fetch('/api/recipes/' + id, { method:'PUT', body: translated.recipe })`; `await refresh()`.
  - **twist:** `const fork = await $fetch<{id:string}>('/api/recipes/' + id + '/fork', { method:'POST', body:{ variationName: label, title: translated.recipe.title } })`; then `PUT /api/recipes/<fork.id>` with `translated.recipe`; on PUT failure `$fetch('/api/recipes/<fork.id>', { method:'DELETE' })` in `.catch(() => {})` and show error; success → `navigateTo('/recipes/' + fork.id)`.
  - Reuse `useActionFeedback` + `v-stable-action` like `makeTwist`. Error text from the API `statusMessage` when present; always say "Your recipe is untouched."
- [ ] **Step 4: Verify:** `npm run typecheck` → 0 errors.
- [ ] **Step 5: Commit:** `git add app/pages/recipes/[id]/index.vue app/utils/recipe-input.ts tests/recipe-translation.test.ts && git commit -m "feat(recipe): translate saved recipe in place or as twist"`

### Task 5: Full verification

- [ ] `npx vitest run tests/recipe-translation.test.ts` → all PASS
- [ ] `npm test` → full suite green (baseline was 1020 tests; no regressions)
- [ ] `npm run typecheck` → 0 errors
- [ ] `npm run build && npm run test:e2e` → green. Add one E2E step in `scripts/e2e-user-flows.js` (stub `/api/ai/recipe/translate` via route interception, as other AI steps do): import draft → pick Greek → "Translate draft" → title contains Greek letters and step timer badge text unchanged; saved recipe → More → "Translate recipe" → twist → lands on new recipe URL. Capture desktop + mobile screenshots; check console shows no errors.
- [ ] Manual no-Gemini check: `curl -s -X POST localhost:3000/api/ai/recipe/translate -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -H 'x-byok-provider: gemini' -H 'x-byok-key: x' -H 'x-byok-model: m' -d '{"recipe":{"title":"A","description":"B"}}'` → HTTP 400 mentioning Gemini.
- [ ] Review `git diff` for unrelated churn (shared worktree), then report pass counts.

## Acceptance Criteria (summary)

1. Route never reaches a Gemini endpoint; gemini header → 400; no key → 400, nothing fabricated.
2. Output numbers (amounts, grams, `durationMinutes`, `timerRequired`, `heatLevel`, `internalTempTargetC`, servings, times) are identical to input even if the model changes them; list lengths identical.
3. Output always satisfies `recipeCreateSchema`; provider errors surface via `humanizeProviderError` text, no key leakage.
4. Import page: language select (default Greek, remembered), "Translate draft" replaces the unsaved draft, Save stays unsaved until clicked.
5. Saved page: More → "Translate recipe" → twist (default, original untouched) or in-place; failed fork PUT cleans up the fork.
6. `npx vitest run tests/recipe-translation.test.ts`, `npm test`, `npm run typecheck`, `npm run build && npm run test:e2e` all green.

## Assumptions

- No DB column for "recipe language"; twists are labelled via `variationName` (e.g. "Ελληνικά").
- Two-step fork+PUT on the client is acceptable (non-atomic, cleanup on failure) to avoid changing `forkRecipe`.
- Non-`el` languages use the same code path; the eight-language list is the "preferred languages" scope for v1.
