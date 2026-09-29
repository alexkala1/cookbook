<script setup lang="ts">
import type { RecipeDetail } from '#shared/types/recipe'
definePageMeta({ layout: false })
import { inSystem, parseServings } from '../../../utils/display-units'
import { scaleIngredients } from '../../../utils/units'
const route = useRoute()
const id = String(route.params.id)
const { data: recipe, error, refresh } = await useFetch<RecipeDetail>('/api/recipes/' + id)
const steps = computed(() => [...(recipe.value?.steps ?? [])].sort((a, b) => a.stepNumber - b.stepNumber))
// ?servings= and ?system=us|metric come from the recipe page so the card matches what the cook was looking at.
const targetServings = computed(() => parseServings(route.query.servings) ?? recipe.value?.servings ?? 4)
const scaled = computed(() => targetServings.value !== recipe.value?.servings)
const system = computed(() => route.query.system === 'us' ? 'us' : route.query.system === 'metric' ? 'metric' : null)
const printIngredients = computed(() => {
  if (!recipe.value) return []
  const rows = scaled.value ? scaleIngredients(recipe.value.ingredients, targetServings.value, recipe.value.servings) : recipe.value.ingredients
  return rows.map(row => {
    const shown = system.value ? inSystem(row.amount, row.unit, system.value === 'us') : { amount: row.amount, unit: row.unit }
    return { ...row, amount: Number(shown.amount.toPrecision(4)), unit: shown.unit }
  })
})
function printCard() { window.print() }
useSeoMeta({ title: () => (recipe.value?.title ?? 'Recipe') + ' — Heirloom card' })
</script>
<template>
  <main class="print-page">
    <nav class="print-controls" aria-label="Recipe card controls"><NuxtLink :to="'/recipes/' + id" class="button-secondary">← Back to recipe</NuxtLink><button v-if="recipe" class="button-primary" @click="printCard">Print card</button><p>{{ scaled || system ? 'Scaled and converted as chosen on the recipe page' : 'Original servings and measurements' }} · use your browser’s print dialog to save a PDF.</p></nav>
    <div v-if="error || !recipe" role="alert" class="notice"><h1>{{ error?.statusCode === 404 ? 'Recipe not found' : 'Recipe unavailable' }}</h1><button v-if="error?.statusCode !== 404" class="button-secondary mt-4" @click="refresh()">Retry recipe</button></div>
    <article v-else class="vintage-card">
      <header class="card-heading"><p class="card-ornament" aria-hidden="true">❧</p><p class="card-kicker">From the Heirloom kitchen</p><h1>{{ recipe.title }}</h1><p>{{ recipe.description }}</p><p class="card-meta">Serves {{ targetServings }}<span v-if="scaled"> (scaled from original {{ recipe.servings }})</span> · Prep {{ recipe.prepTimeMinutes }} min · Cook {{ recipe.cookTimeMinutes }} min<span v-if="recipe.cuisine"> · {{ recipe.cuisine }}</span></p></header>
      <section class="card-ingredients"><h2>Ingredients</h2><ul><li v-for="ingredient in printIngredients" :key="ingredient.id"><strong>{{ ingredient.amount }} {{ ingredient.unit }}</strong> {{ ingredient.name }}<span v-if="ingredient.notes"> — {{ ingredient.notes }}</span></li></ul><p v-if="!recipe.ingredients.length">No ingredients recorded.</p></section>
      <section><h2>The method</h2><ol class="card-method"><li v-for="step in steps" :key="step.id"><h3>Step {{ step.stepNumber }}<span v-if="step.durationMinutes"> · {{ step.durationMinutes }} min</span></h3><p>{{ step.instruction }}</p><dl class="card-senses"><template v-for="(value, label) in { 'Look for': step.sensoryVisual, 'Listen for': step.sensoryAudio, Aroma: step.sensoryAroma, Texture: step.sensoryTexture }" :key="label"><div v-if="value"><dt>{{ label }}</dt><dd>{{ value }}</dd></div></template><div v-if="step.internalTempTargetC != null"><dt>Internal temperature</dt><dd>{{ step.internalTempTargetC }} °C</dd></div></dl><p v-if="step.failurePrevention"><strong>Watch out:</strong> {{ step.failurePrevention }}</p></li></ol><p v-if="!steps.length">No method recorded.</p></section>
      <section v-if="recipe.heirloomNotes" class="card-memory"><h2>Passed down, kept close</h2><p>{{ recipe.heirloomNotes }}</p></section>
      <footer class="card-footer">Heirloom · A recipe worth passing down <span aria-hidden="true">❧</span></footer>
    </article>
  </main>
</template>
<style>
.print-page { max-width: 900px; margin: 0 auto; padding: 2rem 1rem; color: var(--color-ink); }
.print-controls { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; margin-bottom: 2rem; }
.print-controls p { width: 100%; font-size: .875rem; }
.vintage-card { border: 6px double var(--color-rule); padding: clamp(1rem, 4vw, 3rem); background: var(--color-paper); font-family: var(--font-display); overflow-wrap: anywhere; }
.card-heading { text-align: center; border-bottom: 1px solid var(--color-rule); padding-bottom: 1.5rem; }
.card-ornament { font-size: 2.5rem; line-height: 1; color: var(--color-sage); }
.card-kicker { letter-spacing: .2em; text-transform: uppercase; font-size: .75rem; margin: 1rem 0; }
.vintage-card h1 { font-size: clamp(2rem, 6vw, 3.5rem); line-height: 1.15; margin: 1rem 0; }
.vintage-card h2 { font-size: 1.6rem; margin: 1.75rem 0 .8rem; }
.vintage-card h3 { font-size: 1.15rem; font-weight: bold; margin-bottom: .5rem; }
.vintage-card p, .vintage-card dd { white-space: pre-line; }
.card-meta { font-size: .9rem; margin-top: 1rem; }
.card-ingredients ul { list-style: none; padding: 0; }
.card-ingredients li { padding: .4rem 0; border-bottom: 1px dotted var(--color-rule); }
.card-method { list-style: none; padding: 0; }
.card-method li { margin: 1.2rem 0; }
.card-senses { border-left: 2px solid var(--color-sage); padding-left: 1rem; margin: .8rem 0; font-size: .9rem; }
.card-senses:empty { display: none; }
.card-senses dt { display: inline; font-weight: bold; }
.card-senses dd { display: inline; margin-left: .4rem; }
.card-memory { border-top: 1px solid var(--color-rule); margin-top: 1.5rem; font-style: italic; }
.card-footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--color-rule); font-size: .8rem; text-align: center; }
@media print {
  @page { size: A4; margin: 14mm; }
  html, body { background: white !important; color: black !important; }
  .print-page { max-width: none; margin: 0; padding: 0; }
  .print-controls { display: none !important; }
  .vintage-card { background: white; color: #21180f; padding: 7mm; border: 1mm double #796249; font-size: 11pt; line-height: 1.45; print-color-adjust: exact; -webkit-print-color-adjust: exact; box-decoration-break: clone; }
  .vintage-card h1 { font-size: 27pt; }
  .vintage-card h2 { font-size: 16pt; break-after: avoid; }
  .vintage-card h3 { break-after: avoid; }
  .card-heading, .card-ingredients li, .card-senses div, .card-footer { break-inside: avoid; }
  .vintage-card p { orphans: 3; widows: 3; }
}
</style>
