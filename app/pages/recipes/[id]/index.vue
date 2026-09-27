<script setup lang="ts">
import type { KitchenProfile, RecipeDetail } from '../../../../shared/types/recipe'
import { convertSalt, convertUnit, isPlainSalt, scaleIngredients, saltDensities, saltLabels } from '../../../utils/units'
import type { SaltType } from '../../../utils/units'
import { evaluateCocktail } from '#shared/culinary/cocktails'
import { suggestMetric, applyMetric } from '#shared/culinary/densities'
import { OFFLINE_DRAFT_DESCRIPTION, stripPromotional } from '#shared/culinary/structured-recipe'

const route = useRoute()
const id = String(route.params.id)
const { data: recipe, error, refresh } = await useFetch<RecipeDetail>('/api/recipes/' + id)
const { data: kitchen } = await useFetch<KitchenProfile>('/api/settings/kitchen')
useSeoMeta({ title: () => recipe.value ? recipe.value.title + ' — Heirloom' : 'Recipe — Heirloom' })
const servings = ref(recipe.value?.servings ?? 4)
const imperial = ref(false)
const fromSalt = ref<SaltType | null>(recipe.value?.originalSaltType ?? null)
watch(() => recipe.value?.originalSaltType, value => { fromSalt.value = value ?? null })
const toSalt = ref<SaltType>(kitchen.value?.preferredSaltType ?? 'table_salt')
const editing = ref(false)
const deleting = ref(false)
// Book-view simplification: long notes collapse, secondary actions live in a More menu.
const notesText = computed(() => stripPromotional(recipe.value?.heirloomNotes ?? ''))
const notesLong = computed(() => notesText.value.length > 360 || notesText.value.split('\n').length > 4)
const notesOpen = ref(false)
const isOfflineDraft = computed(() => (recipe.value?.description ?? '').startsWith(OFFLINE_DRAFT_DESCRIPTION))
const moreMenu = ref<HTMLDetailsElement>()
function closeMore(focusSummary = false) {
  if (!moreMenu.value?.open) return
  moreMenu.value.open = false
  if (focusSummary) moreMenu.value.querySelector('summary')?.focus()
}
onClickOutside(moreMenu, () => closeMore())
const adjustSummary = computed(() => [imperial.value ? 'US measures' : null, fromSalt.value && fromSalt.value !== toSalt.value ? `${saltLabels[fromSalt.value]} → ${saltLabels[toSalt.value]}` : null].filter(Boolean).join(' · '))
const quantityLabel = (row: { amount: number, unit: string }) => row.unit === 'as needed' && !row.amount ? 'As needed' : `${row.amount} ${row.unit}`
const busy = ref(false)
const actionError = ref('')
const metricDismissed = ref(false)
const metricBusy = ref(false)
const metricError = ref('')
const { state: metricState, label: metricLabel } = useActionFeedback(metricBusy, metricError)
const metricSuggestions = computed(() => recipe.value?.ingredients.flatMap(row => {
  const suggestion = suggestMetric(row, recipe.value?.originalSaltType)
  return suggestion ? [{ ...suggestion, name: row.name, id: row.id, originalAmount: row.amount, originalUnit: row.unit }] : []
}) ?? [])
async function applyConversions() {
  if (!recipe.value || busy.value) return
  busy.value = true
  metricBusy.value = true
  metricError.value = ''
  try {
    const ingredients = recipe.value.ingredients.map(({ id: _id, recipeId: _recipeId, ...row }) => applyMetric(row, recipe.value!.originalSaltType))
    recipe.value = await $fetch<RecipeDetail>('/api/recipes/' + id, { method: 'PUT', body: { ingredients } })
  } catch { metricError.value = 'Could not apply conversions. Your original measures are unchanged. Try again.' }
  finally { metricBusy.value = false; busy.value = false }
}
const thermodynamics = computed(() => recipe.value && ['drink', 'cocktail'].includes(recipe.value.recipeType) ? evaluateCocktail(recipe.value.ingredients, recipe.value.title + ' ' + recipe.value.steps.map(step => step.instruction).join(' ')) : null)
const safeServings = computed(() => Number.isFinite(servings.value) && servings.value > 0 && servings.value <= 1000 ? servings.value : recipe.value?.servings ?? 4)
const displayIngredients = computed(() => {
  if (!recipe.value) return []
  return scaleIngredients(recipe.value.ingredients, safeServings.value, recipe.value.servings).map(row => {
    let amount = row.amount
    let unit = row.unit.trim().toLowerCase()
    let note = ''
    if (isPlainSalt(row.name) && fromSalt.value && fromSalt.value !== toSalt.value) {
      try { amount = convertSalt(amount, fromSalt.value, toSalt.value, unit) }
      catch { note = 'Salt substitution unavailable for this unit.' }
    }
    const targets: Record<string, string> = imperial.value
      ? { g: 'oz', kg: 'lb', ml: 'fl oz', l: 'fl oz' }
      : { oz: 'g', lb: 'g', 'fl oz': 'ml', cup: 'ml' }
    const target = targets[unit]
    if (target) {
      amount = convertUnit(amount, unit, target)
      unit = target
    }
    return { ...row, amount: Number(amount.toPrecision(4)), unit, conversionNote: note }
  })
})
async function toggleFavorite() {
  if (!recipe.value || busy.value) return
  busy.value = true
  actionError.value = ''
  try {
    recipe.value = await $fetch<RecipeDetail>('/api/recipes/' + id, { method: 'PUT', body: { isFavorite: !recipe.value.isFavorite } })
  } catch { actionError.value = 'Could not update favorite. Try again.' }
  finally { busy.value = false }
}
async function removeRecipe() {
  busy.value = true
  actionError.value = ''
  try {
    await $fetch('/api/recipes/' + id, { method: 'DELETE' })
    await navigateTo('/recipes')
  } catch { actionError.value = 'Could not delete this recipe. Try again.' }
  finally { busy.value = false }
}
function saved(value: RecipeDetail) {
  recipe.value = value
  servings.value = value.servings
  fromSalt.value = value.originalSaltType
  editing.value = false
}
</script>

<template>
  <section class="page-section">
    <NuxtLink to="/recipes" class="text-action">← All recipes</NuxtLink>
    <div v-if="error || !recipe" class="empty-state mt-8" role="alert">
      <h1>{{ error?.statusCode === 404 ? 'This recipe isn’t in your cookbook.' : 'We couldn’t open this recipe.' }}</h1>
      <button v-if="error?.statusCode !== 404" class="button-secondary mt-6" @click="refresh()">Try again</button>
    </div>
    <template v-else-if="editing">
      <h1 class="mt-8">Edit {{ recipe.title }}</h1>
      <RecipeForm :recipe="recipe" @saved="saved" @cancel="editing = false" />
    </template>
    <template v-else>
      <header class="mt-8 border-b border-espresso/20 pb-10">
        <p class="meta-label">{{ recipe.recipeType }} · {{ recipe.cuisine || 'From your kitchen' }}</p>
        <h1 class="mt-4 max-w-4xl break-words">{{ recipe.title }}</h1>
        <p v-if="isOfflineDraft" class="draft-badge mt-6"><UIcon name="i-lucide-info" aria-hidden="true" />Imported draft · review quantities before cooking</p>
        <p v-else-if="recipe.description" class="mt-6 max-w-2xl whitespace-pre-line break-words text-lg">{{ recipe.description }}</p>
        <p class="mt-6">{{ recipe.totalTimeMinutes }} min · {{ recipe.difficulty }} · {{ recipe.rating == null ? 'Not rated yet' : recipe.rating + ' / 5' }}</p>
        <div v-if="thermodynamics" class="notice mt-6"><p>{{ thermodynamics.technique }} · Dilution {{ thermodynamics.dilutionPercent.join('–') }}% · {{ thermodynamics.glassware }} · Estimated cooling {{ thermodynamics.temperatureDropC.join('–') }} °C</p><p class="mt-2 text-sm">{{ thermodynamics.note }}</p></div>
        <div class="mt-8 flex flex-wrap items-center gap-3">
          <NuxtLink :to="'/recipes/' + id + '/cook'" class="button-primary start-cooking"><UIcon name="i-lucide-chef-hat" class="size-5" aria-hidden="true" />Start cooking</NuxtLink>
          <button class="button-secondary" :aria-pressed="recipe.isFavorite" :disabled="busy" :aria-busy="busy" v-stable-action="busy ? 'loading' : actionError ? 'error' : undefined" :data-state="busy ? 'loading' : actionError ? 'error' : undefined" @click="toggleFavorite"><UIcon name="i-lucide-heart" :class="{ 'fill-current': recipe.isFavorite }" aria-hidden="true" />{{ recipe.isFavorite ? 'Favorited' : 'Favorite' }}</button>
          <details ref="moreMenu" class="more-menu" @keydown.esc="closeMore(true)">
            <summary class="button-secondary">More<UIcon name="i-lucide-ellipsis" aria-hidden="true" /></summary>
            <div class="more-menu__panel">
              <NuxtLink :to="'/recipes/' + id + '/print'" class="more-menu__item"><UIcon name="i-lucide-printer" aria-hidden="true" />Print heirloom card</NuxtLink>
              <button type="button" class="more-menu__item" :disabled="busy" @click="closeMore(); editing = true"><UIcon name="i-lucide-pencil" aria-hidden="true" />Edit recipe</button>
              <button type="button" class="more-menu__item more-menu__item--danger" :disabled="busy" @click="closeMore(); deleting = true"><UIcon name="i-lucide-trash" aria-hidden="true" />Delete recipe</button>
            </div>
          </details>
        </div>
        <div v-if="deleting" class="notice mt-6" role="alert">
          <p>Delete “{{ recipe.title }}” and its cooking history? This cannot be undone.</p>
          <div class="mt-4 flex gap-3"><button class="button-primary" :disabled="busy" @click="removeRecipe">{{ busy ? 'Deleting…' : 'Confirm delete' }}</button><button class="button-secondary" :disabled="busy" @click="deleting = false">Keep recipe</button></div>
        </div>
        <p v-if="actionError" role="alert" class="notice mt-4">{{ actionError }}</p>
      </header>
      <section v-if="!metricDismissed && metricSuggestions.length" aria-labelledby="metric-heading" class="row-panel mt-8 text-ink">
        <h2 id="metric-heading" class="text-2xl">Suggest Metric Conversions (g/ml)</h2>
        <p class="mt-3">Review these estimates for the saved recipe’s original servings. Cups use a rounded 240 ml kitchen measure. Packing and ingredient brands vary; original measures will be kept in ingredient notes.</p>
        <ul class="my-4 space-y-3">
          <li v-for="item in metricSuggestions" :key="item.id" class="break-words"><strong>{{ item.originalAmount }} {{ item.originalUnit }} {{ item.name }} → ~{{ item.amount }} {{ item.unit }}</strong><p class="text-sm">{{ item.basis }}</p></li>
        </ul>
        <div class="flex flex-wrap gap-3">
          <button class="button-primary" :disabled="busy" v-stable-action="metricState" :data-state="metricState" :aria-busy="metricBusy" @click="applyConversions">{{ metricLabel('Apply to recipe', 'Applying…') }}</button>
          <button class="button-secondary" :disabled="busy" @click="metricDismissed = true">Dismiss</button>
        </div>
        <p v-if="metricError" role="alert" class="mt-4 text-error">{{ metricError }}</p>
      </section>
      <p v-if="metricState === 'success'" role="status" class="mt-4">Metric conversions saved. Original measures are preserved in ingredient notes.</p>
      <img v-if="recipe.imageUrl" :src="recipe.imageUrl" :alt="recipe.title" class="mt-8 max-h-96 w-full object-cover">
      <div class="grid gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <aside class="min-w-0">
          <h2>Ingredients</h2>
          <div class="row-panel mt-6 space-y-4">
            <label class="block">Servings<input v-model.number="servings" type="number" min="1" max="1000" class="field mt-2"></label>
            <p v-if="safeServings !== servings" role="status" class="text-sm">Enter 1–1000 servings. Showing the original quantities.</p>
            <details class="adjust-disclosure">
              <summary class="text-action">Adjust units &amp; salt<span v-if="adjustSummary" class="adjust-summary">· {{ adjustSummary }}</span></summary>
              <div class="mt-4 space-y-4">
                <div class="inline-flex gap-1 rounded-full border border-rule p-1" role="group" aria-label="Measurement system"><button class="filter-pill" :aria-pressed="!imperial" @click="imperial = false">Metric</button><button class="filter-pill" :aria-pressed="imperial" @click="imperial = true">US</button></div>
                <label class="block">Salt used in the recipe<select v-model="fromSalt" aria-label="Salt used in the recipe" class="field mt-2"><option :value="null">Unknown — no substitution</option><option v-for="(_, salt) in saltDensities" :key="salt" :value="salt">{{ saltLabels[salt] }}</option></select></label>
                <label class="block">Salt you are using<select v-model="toSalt" aria-label="Salt you are using" class="field mt-2"><option v-for="(_, salt) in saltDensities" :key="salt" :value="salt">{{ saltLabels[salt] }}</option></select></label>
                <p v-if="!fromSalt" role="status" class="text-sm">Original salt unknown. Density substitution is off until you choose it. Serving changes still scale all ingredient quantities.</p>
                <p class="text-sm">Volume substitutions preserve salt mass; weighed salt stays unchanged. Seasoned salts are excluded. Cups and spoons use US measures. Save the original salt in Edit recipe to remember it.</p>
              </div>
            </details>
          </div>
          <ul v-if="displayIngredients.length" class="mt-6 divide-y divide-espresso/15">
            <li v-for="ingredient in displayIngredients" :key="ingredient.id" class="ingredient-row flex items-start gap-2 py-3 break-words">
              <div class="min-w-0 flex-1 pt-2.5">
                <span class="font-semibold num">{{ quantityLabel(ingredient) }}</span> {{ ingredient.name }}
                <p v-if="ingredient.notes" class="mt-1 text-sm text-muted">{{ ingredient.notes }}</p>
                <p v-if="ingredient.conversionNote" class="mt-1 text-sm">{{ ingredient.conversionNote }}</p>
              </div>
              <SubstitutionDialog :ingredient="ingredient.name" :context="recipe.title + ': ' + recipe.steps.map(step => step.instruction).join(' ')" />
            </li>
          </ul>
          <p v-else class="mt-6">No ingredients recorded yet.</p>
          <h2 class="mt-10">Equipment</h2>
          <ul v-if="recipe.equipment.length" class="mt-4 space-y-3"><li v-for="tool in recipe.equipment" :key="tool.id" class="break-words">{{ tool.name }} <span class="text-sm">({{ tool.isEssential ? 'essential' : 'optional' }})</span><p v-if="tool.substituteTool" class="text-sm">Alternative: {{ tool.substituteTool }}</p></li></ul>
          <p v-else class="mt-4">No special equipment recorded.</p>
        </aside>
        <div class="min-w-0">
          <h2>The method</h2>
          <ol v-if="recipe.steps.length" class="mt-6 space-y-10">
            <li v-for="step in recipe.steps" :key="step.id" class="border-t border-espresso/20 pt-5">
              <div class="flex flex-wrap items-center gap-4"><span class="font-serif text-4xl text-sage">{{ step.stepNumber.toString().padStart(2, '0') }}</span><span v-if="step.durationMinutes != null" class="text-sm">{{ step.durationMinutes }} min</span><span v-if="step.heatLevel && step.heatLevel !== 'none'" class="text-sm">{{ step.heatLevel }} heat</span><span v-if="step.timerRequired" class="text-sm">Timer needed</span></div>
              <p class="mt-4 whitespace-pre-line break-words text-lg leading-relaxed">{{ step.instruction }}</p>
              <dl v-if="step.sensoryVisual || step.sensoryAudio || step.sensoryAroma || step.sensoryTexture || step.internalTempTargetC != null" class="mt-5 space-y-2 border-l-2 border-sage bg-sage/10 p-5">
                <template v-for="(value, label) in { 'Look for': step.sensoryVisual, 'Listen for': step.sensoryAudio, Aroma: step.sensoryAroma, Texture: step.sensoryTexture }" :key="label"><div v-if="value"><dt class="font-semibold">{{ label }}</dt><dd class="break-words">{{ value }}</dd></div></template>
                <div v-if="step.internalTempTargetC != null"><dt class="font-semibold">Internal temperature</dt><dd>{{ step.internalTempTargetC }} °C</dd></div>
              </dl>
              <p v-if="step.scienceWhy" class="mt-4 break-words"><strong>Food Science Why:</strong> {{ step.scienceWhy }}</p>
              <p v-if="step.failurePrevention" class="mt-4 break-words"><strong>Watch out:</strong> {{ step.failurePrevention }}</p>
            </li>
          </ol>
          <p v-else class="mt-6">No steps recorded yet. Add your method with “Edit recipe”.</p>
          <section v-if="notesText" class="mt-12 border-t-2 border-terracotta pt-6">
            <h2 class="mt-3">Heirloom notes</h2>
            <p id="heirloom-notes" class="mt-4 whitespace-pre-line break-words leading-relaxed" :class="{ 'line-clamp-4': notesLong && !notesOpen }">{{ notesText }}</p>
            <button v-if="notesLong" type="button" class="text-action mt-2" :aria-expanded="notesOpen" aria-controls="heirloom-notes" @click="notesOpen = !notesOpen">{{ notesOpen ? 'Show less' : 'Read full notes' }}</button>
          </section>
        </div>
      </div>
      <RecipeKeepsakes :recipe-id="id" />
    </template>
  </section>
</template>

<style scoped>
/* One clear primary action; everything else is quieter or tucked into More. */
.start-cooking { min-height: 52px; padding-inline: 1.75rem; font-size: 1rem; }

.draft-badge { display: inline-flex; align-items: center; gap: .5rem; border: 1px solid var(--color-rule); border-radius: 999px; background: var(--color-paper-2); padding: .375rem .875rem; font-size: .875rem; color: var(--color-muted); }

.more-menu { position: relative; }
.more-menu > summary { list-style: none; }
.more-menu > summary::-webkit-details-marker { display: none; }
.more-menu[open] > summary { background: var(--color-paper-3); }
.more-menu__panel { position: absolute; z-index: 20; top: calc(100% + .5rem); left: 0; display: grid; min-width: 15rem; border: 1px solid var(--color-rule); border-radius: .75rem; background: var(--color-paper); padding: .375rem; box-shadow: 0 8px 24px color-mix(in oklch, var(--color-ink) 12%, transparent); }
@media (min-width: 40rem) { .more-menu__panel { left: auto; right: 0; } }
.more-menu__item { display: flex; min-height: 44px; align-items: center; gap: .625rem; border-radius: .5rem; padding: .5rem .75rem; text-align: left; font-size: .9375rem; font-weight: 600; white-space: nowrap; }
.more-menu__item:active { background: var(--color-paper-3); }
.more-menu__item:focus-visible { outline: 2px solid var(--color-focus); outline-offset: -2px; }
.more-menu__item:disabled { opacity: .55; cursor: not-allowed; }
.more-menu__item--danger { color: var(--color-error); }
@media (hover: hover) { .more-menu__item:hover { background: var(--color-paper-2); } }

.adjust-disclosure > summary { cursor: pointer; list-style: none; white-space: normal; }
.adjust-disclosure > summary::-webkit-details-marker { display: none; }
.adjust-disclosure > summary::before { content: '▸'; display: inline-block; margin-right: .5rem; transition: transform var(--dur-short) var(--ease-out); }
.adjust-disclosure[open] > summary::before { transform: rotate(90deg); }
.adjust-summary { margin-left: .375rem; font-weight: 400; text-decoration: none; color: var(--color-muted); }
@media (prefers-reduced-motion: reduce) { .adjust-disclosure > summary::before { transition: none; } }
</style>
