<script setup lang="ts">
import type { KitchenProfile, RecipeDetail } from '../../../../shared/types/recipe'
import { convertSalt, convertUnit, isPlainSalt, scaleIngredients, saltDensities, saltLabels } from '../../../utils/units'
import type { SaltType } from '../../../utils/units'
import { evaluateCocktail } from '#shared/culinary/cocktails'

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
const busy = ref(false)
const actionError = ref('')
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
        <p class="mt-6 max-w-2xl whitespace-pre-line break-words text-lg">{{ recipe.description }}</p>
        <p class="mt-6">{{ recipe.totalTimeMinutes }} min · {{ recipe.difficulty }} · {{ recipe.rating == null ? 'Not rated yet' : recipe.rating + ' / 5' }}</p>
        <div v-if="thermodynamics" class="notice mt-6"><p>{{ thermodynamics.technique }} · Dilution {{ thermodynamics.dilutionPercent.join('–') }}% · {{ thermodynamics.glassware }} · Estimated cooling {{ thermodynamics.temperatureDropC.join('–') }} °C</p><p class="mt-2 text-sm">{{ thermodynamics.note }}</p></div>
        <div class="mt-6 flex flex-wrap gap-3">
          <NuxtLink :to="'/recipes/' + id + '/cook'" class="button-primary">Start cooking</NuxtLink>
          <NuxtLink :to="'/recipes/' + id + '/print'" class="button-secondary">Print heirloom card</NuxtLink>
          <button class="button-secondary" :aria-pressed="recipe.isFavorite" :disabled="busy" :aria-busy="busy" v-stable-action="busy ? 'loading' : actionError ? 'error' : undefined" :data-state="busy ? 'loading' : actionError ? 'error' : undefined" @click="toggleFavorite"><UIcon name="i-lucide-heart" :class="{ 'fill-current': recipe.isFavorite }" aria-hidden="true" />{{ recipe.isFavorite ? 'Favorited' : 'Favorite' }}</button>
          <button class="button-secondary" @click="editing = true">Edit recipe</button>
          <button class="text-action px-3" @click="deleting = true">Delete recipe</button>
        </div>
        <div v-if="deleting" class="notice mt-6" role="alert">
          <p>Delete “{{ recipe.title }}” and its cooking history? This cannot be undone.</p>
          <div class="mt-4 flex gap-3"><button class="button-primary" :disabled="busy" @click="removeRecipe">{{ busy ? 'Deleting…' : 'Confirm delete' }}</button><button class="button-secondary" :disabled="busy" @click="deleting = false">Keep recipe</button></div>
        </div>
        <p v-if="actionError" role="alert" class="notice mt-4">{{ actionError }}</p>
      </header>
      <img v-if="recipe.imageUrl" :src="recipe.imageUrl" :alt="recipe.title" class="mt-8 max-h-96 w-full object-cover">
      <div class="grid gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <aside class="min-w-0">
          <h2>Ingredients</h2>
          <div class="row-panel mt-6 space-y-4">
            <label class="block">Servings<input v-model.number="servings" type="number" min="1" max="1000" class="field mt-2"></label>
            <p v-if="safeServings !== servings" role="status" class="text-sm">Enter 1–1000 servings. Showing the original quantities.</p>
            <div class="inline-flex gap-1 rounded-full border border-rule p-1" role="group" aria-label="Measurement system"><button class="filter-pill" :aria-pressed="!imperial" @click="imperial = false">Metric</button><button class="filter-pill" :aria-pressed="imperial" @click="imperial = true">US</button></div>
            <label class="block">Salt used in the recipe<select v-model="fromSalt" aria-label="Salt used in the recipe" class="field mt-2"><option :value="null">Unknown — no substitution</option><option v-for="(_, salt) in saltDensities" :key="salt" :value="salt">{{ saltLabels[salt] }}</option></select></label>
            <label class="block">Salt you are using<select v-model="toSalt" aria-label="Salt you are using" class="field mt-2"><option v-for="(_, salt) in saltDensities" :key="salt" :value="salt">{{ saltLabels[salt] }}</option></select></label>
            <p v-if="!fromSalt" role="status" class="text-sm">Original salt unknown. Density substitution is off until you choose it. Serving changes still scale all ingredient quantities.</p>
            <p class="text-sm">Volume substitutions preserve salt mass; weighed salt stays unchanged. Seasoned salts are excluded. Cups and spoons use US measures. Save the original salt in Edit recipe to remember it.</p>
          </div>
          <ul v-if="displayIngredients.length" class="mt-6 divide-y divide-espresso/15">
            <li v-for="ingredient in displayIngredients" :key="ingredient.id" class="py-4 break-words">
              <span class="font-semibold num">{{ ingredient.amount }} {{ ingredient.unit }}</span> {{ ingredient.name }}
              <p v-if="ingredient.notes" class="mt-1 text-sm">{{ ingredient.notes }}</p>
              <p v-if="ingredient.conversionNote" class="mt-1 text-sm">{{ ingredient.conversionNote }}</p>
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
          <section v-if="recipe.heirloomNotes" class="mt-12 border-t-2 border-terracotta pt-6">
            <h2 class="mt-3">Heirloom notes</h2><p class="mt-4 whitespace-pre-line break-words leading-relaxed">{{ recipe.heirloomNotes }}</p>
          </section>
        </div>
      </div>
      <RecipeKeepsakes :recipe-id="id" />
    </template>
  </section>
</template>
