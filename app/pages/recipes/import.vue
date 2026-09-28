<script setup lang="ts">
import type { RecipeInput } from '../../../server/utils/validation'
import { readRecipeStream } from '../../utils/sse'
const { requestHeaders, ready, settings } = useByokSettings()
const kind = ref<'url' | 'video' | 'ocr' | 'prompt'>('url')
const tabs = { url: 'Web URL', video: 'Video Link', ocr: 'Scanned Card / Photo OCR', prompt: 'Conversational Memory' } as const
const source = ref('')
const busy = ref(false), saving = ref(false), error = ref('')
const { state: generateState, label: generateLabel } = useActionFeedback(busy, error)
const { state: saveState, label: saveLabel } = useActionFeedback(saving, error)
const messages = ref<string[]>([]), warnings = ref<string[]>([])
const draft = ref<RecipeInput | null>(null)
const provenance = ref('')
// What the cook gave us and the text the importer actually read, for side-by-side review.
const original = ref<{ input: string, text: string, kind: typeof kind.value } | null>(null)
const compareView = ref<'source' | 'parsed'>('source')
let controller: AbortController | undefined
onBeforeUnmount(() => controller?.abort())
watch(kind, () => { source.value = ''; draft.value = null; original.value = null; error.value = ''; messages.value = [] })
async function generate() {
  controller = new AbortController(); busy.value = true; error.value = ''; draft.value = null; original.value = null; messages.value = []
  const input = source.value, inputKind = kind.value
  try {
    const body = kind.value === 'url' ? { kind: kind.value, url: source.value } : kind.value === 'video' ? { kind: kind.value, videoUrl: source.value } : kind.value === 'ocr' ? { kind: kind.value, text: source.value } : { kind: kind.value, prompt: source.value }
    const response = await fetch('/api/ai/recipe/stream', { method: 'POST', headers: { 'Content-Type': 'application/json', ...requestHeaders() }, body: JSON.stringify(body), signal: controller.signal })
    await readRecipeStream(response, (event, raw) => {
      const data = raw as { message?: string, recipe?: RecipeInput, warnings?: string[], provenance?: string, mode?: string, sourceText?: string }
      if (data.message) messages.value = [...messages.value.slice(-9), data.message]
      if (event === 'complete' && data.recipe) { draft.value = data.recipe; warnings.value = data.warnings || []; provenance.value = `${data.provenance} · ${data.mode}`; original.value = { input, text: data.sourceText || input, kind: inputKind }; compareView.value = 'source' }
    })
  } catch (cause) { draft.value = null; error.value = controller.signal.aborted ? 'Import cancelled.' : cause instanceof Error ? cause.message : 'Import failed. Try again.' }
  finally { busy.value = false }
}
async function save() {
  if (!draft.value || saving.value) return
  saving.value = true; error.value = ''
  try { const recipe = await $fetch<{ id: string }>('/api/recipes', { method: 'POST', body: draft.value }); await navigateTo('/recipes/' + recipe.id) }
  catch { error.value = 'Could not save this draft. It is still here; try again.' }
  finally { saving.value = false }
}
const minutesLabel = (minutes: number) => minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`
useSeoMeta({ title: 'Import a recipe — Heirloom' })
</script>
<template>
  <section class="page-section max-w-3xl">
    <h1 class="mt-4">Bring a recipe home.</h1>
    <p class="mt-6">Recover a recipe, understand its method, and review the details before adding it to your cookbook.</p>
    <div class="mt-8 flex flex-wrap gap-3" aria-label="Import source">
      <button v-for="(name, tab) in tabs" :key="tab" class="filter-pill" :aria-pressed="kind === tab" :disabled="busy || saving" @click="kind = tab">{{ name }}</button>
    </div>
    <form class="mt-6 space-y-5" @submit.prevent="generate">
      <div v-if="kind === 'ocr'">
        <label class="block">Scanned card text
          <textarea v-model="source" class="field mt-2 font-mono text-sm" rows="10" required minlength="5" maxlength="30000" :disabled="busy || saving" aria-describedby="ocr-help" placeholder="Yiayia’s Koulourakia&#10;Ingredients&#10;250 g butter…" />
        </label>
        <p id="ocr-help" class="mt-2 text-sm text-muted">Scan the card with your phone’s text recognition (Live Text, Google Lens), then paste it here. Put the recipe name on the first line.</p>
      </div>
      <label v-else class="block">{{ kind === 'prompt' ? 'What do you remember?' : kind === 'video' ? 'YouTube URL or video ID' : 'Recipe URL' }}
        <textarea v-if="kind === 'prompt'" v-model="source" class="field mt-2" rows="5" required minlength="5" maxlength="20000" :disabled="busy || saving" placeholder="Grandma’s lemon chicken, roasted on Sundays…" />
        <input v-else v-model="source" class="field mt-2" :type="kind === 'url' ? 'url' : 'text'" required maxlength="2000" :disabled="busy || saving">
      </label>
      <p class="text-sm">{{ settings.activeProvider === 'ollama' && settings.activeModel ? 'Uses your locally running Ollama model.' : settings.keys[settings.activeProvider] ? 'Uses your selected model. Source text is sent to that provider.' : 'No API key: structured recipe metadata is preserved; other sources use a clearly labeled starting draft.' }} <NuxtLink class="text-action" to="/settings">AI settings</NuxtLink></p>
      <button class="button-primary" :disabled="busy || saving || !ready" v-stable-action="generateState" :data-state="generateState" :aria-busy="busy">{{ generateLabel('Create recipe draft', 'Creating draft…') }}</button>
      <button v-if="busy" type="button" class="button-secondary ml-3" @click="controller?.abort()">Cancel</button>
    </form>
    <ol v-if="messages.length" class="row-panel mt-6 space-y-2" aria-live="polite" aria-label="Import progress"><li v-for="(message, i) in messages" :key="i">{{ message }}</li></ol>
    <p v-if="error" role="alert" class="notice mt-6">{{ error }}</p>
    <details v-if="draft && original" class="group mt-10 rounded-xl border border-rule bg-paper-2/60 p-4" aria-label="Source comparison">
      <summary class="flex min-h-11 cursor-pointer select-none items-center justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
        <span class="flex items-center gap-2"><UIcon name="i-lucide-columns-2" class="flex-none" aria-hidden="true" />Original source vs parsed recipe</span>
        <UIcon name="i-lucide-chevron-down" class="size-5 flex-none transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>
      <p class="mt-2 text-sm text-muted">Check that every quantity, step and time made it across before you save.</p>
      <div class="mt-4 flex gap-2 lg:hidden" role="group" aria-label="Comparison view">
        <button type="button" class="filter-pill" :aria-pressed="compareView === 'source'" @click="compareView = 'source'">Original</button>
        <button type="button" class="filter-pill" :aria-pressed="compareView === 'parsed'" @click="compareView = 'parsed'">Parsed · {{ draft.steps?.length ?? 0 }} steps</button>
      </div>
      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <section class="min-w-0 rounded-lg border border-rule bg-paper p-4" :class="compareView === 'source' ? '' : 'hidden lg:block'" aria-labelledby="compare-source">
          <h2 id="compare-source" class="text-lg">Original source</h2>
          <p v-if="original.kind === 'url' || original.kind === 'video'" class="mt-1 break-all text-sm text-muted">Text read from {{ original.input }}</p>
          <pre class="mt-3 max-h-[28rem] overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">{{ original.text }}</pre>
        </section>
        <section class="min-w-0 rounded-lg border border-rule bg-paper p-4" :class="compareView === 'parsed' ? '' : 'hidden lg:block'" aria-labelledby="compare-parsed">
          <h2 id="compare-parsed" class="text-lg">Parsed recipe</h2>
          <h3 class="mt-3 text-sm font-semibold uppercase tracking-wide text-muted">Ingredients · {{ draft.ingredients?.length ?? 0 }}</h3>
          <ul class="mt-2 space-y-1 text-sm"><li v-for="(ingredient, i) in draft.ingredients" :key="i"><span class="font-semibold num">{{ ingredient.amount }} {{ ingredient.unit }}</span> {{ ingredient.name }}</li></ul>
          <h3 class="mt-4 text-sm font-semibold uppercase tracking-wide text-muted">Method · {{ draft.steps?.length ?? 0 }} steps</h3>
          <ul class="mt-2 space-y-2 text-sm">
            <li v-for="step in draft.steps" :key="step.stepNumber" class="flex gap-2"><span class="num w-6 flex-none font-semibold">{{ step.stepNumber }}.</span><span class="min-w-0">{{ step.instruction }}<span v-if="step.durationMinutes" class="ml-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-sage/15 px-2 text-xs font-semibold text-sage-ink"><UIcon :name="step.timerRequired ? 'i-lucide-timer' : 'i-lucide-clock'" aria-hidden="true" />{{ minutesLabel(step.durationMinutes) }}</span><span v-if="step.heatLevel && step.heatLevel !== 'none'" class="ml-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-terracotta/10 px-2 text-xs font-semibold text-terracotta-ink"><UIcon name="i-lucide-flame" aria-hidden="true" />{{ step.heatLevel }}</span></span></li>
          </ul>
        </section>
      </div>
    </details>
    <article v-if="draft" class="mt-6 border-t border-espresso/20 pt-8">
      <p class="meta-label">Review your draft · {{ provenance }}</p>
      <p v-for="warning in warnings" :key="warning" class="notice mt-4">{{ warning }}</p>
      <label class="mt-6 block">Recipe title<input v-model="draft.title" class="field mt-2" maxlength="200"></label>
      <p class="mt-4">{{ draft.description }}</p>
      <h2 class="mt-6">Ingredients</h2><ul class="mt-4 space-y-3"><li v-for="(ingredient, i) in draft.ingredients" :key="i">{{ ingredient.amount }} {{ ingredient.unit }} {{ ingredient.name }}<p class="text-sm">{{ ingredient.notes }}</p></li></ul>
      <h2 class="mt-6">Method &amp; food science</h2><ol class="mt-4 space-y-5"><li v-for="step in draft.steps" :key="step.stepNumber"><p>{{ step.stepNumber }}. {{ step.instruction }}</p><p v-if="step.durationMinutes || (step.heatLevel && step.heatLevel !== 'none')" class="mt-2 flex flex-wrap gap-2 text-sm font-semibold"><span v-if="step.durationMinutes" class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 border-sage/50 bg-sage/10 text-sage-ink"><UIcon :name="step.timerRequired ? 'i-lucide-timer' : 'i-lucide-clock'" aria-hidden="true" />{{ minutesLabel(step.durationMinutes) }}{{ step.timerRequired ? ' timer' : '' }}</span><span v-if="step.heatLevel && step.heatLevel !== 'none'" class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 border-terracotta/40 bg-terracotta/10 text-terracotta-ink"><UIcon name="i-lucide-flame" aria-hidden="true" />{{ step.heatLevel.replace('-', '–') }} heat</span></p><p v-if="step.scienceWhy" class="mt-2 text-sm text-sage-ink">{{ step.scienceWhy }}</p></li></ol>
      <p class="mt-6 text-sm">Save, then use Edit recipe to refine quantities, steps, equipment, and family notes.</p>
      <button class="button-primary mt-4" :disabled="busy || saving || !draft.title.trim()" v-stable-action="saveState" :data-state="saveState" :aria-busy="saving" @click="save">{{ saveLabel('Save to Cookbook', 'Saving…') }}</button>
    </article>
  </section>
</template>
