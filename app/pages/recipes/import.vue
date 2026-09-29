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
const original = ref<{ input: string, text: string, kind: typeof kind.value, photo: string } | null>(null)
const captionsUnavailable = ref(false)
// A photographed recipe card, downsized in the browser so it stays light to send and to keep with the recipe.
const photoDataUrl = ref('')
const photoError = ref('')
const photoInput = ref<HTMLInputElement>()
const MAX_PHOTO_EDGE = 1600, MAX_PHOTO_CHARS = 1_400_000
async function downsize(file: File) {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('no canvas')
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.82, 0.65, 0.5]) {
      const url = canvas.toDataURL('image/jpeg', quality)
      if (url.length <= MAX_PHOTO_CHARS) return url
    }
    throw new Error('too large')
  } finally { bitmap.close() }
}
async function pickPhoto(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]
  photoError.value = ''
  if (!file) return
  try {
    if (!file.type.startsWith('image/')) throw new Error('not an image')
    photoDataUrl.value = await downsize(file)
  } catch { photoDataUrl.value = ''; photoError.value = 'We couldn’t read that photo. Try a JPEG or PNG, or paste the card’s text instead.' }
  finally { input.value = '' }
}
function removePhoto() { photoDataUrl.value = ''; photoError.value = ''; photoInput.value?.focus() }
const compareView = ref<'source' | 'parsed'>('source')
let controller: AbortController | undefined
onBeforeUnmount(() => controller?.abort())
watch(kind, () => { source.value = ''; photoDataUrl.value = ''; photoError.value = ''; captionsUnavailable.value = false; draft.value = null; original.value = null; error.value = ''; messages.value = [] })
async function generate() {
  controller = new AbortController(); busy.value = true; error.value = ''; draft.value = null; original.value = null; messages.value = []
  const input = source.value, inputKind = kind.value, photo = kind.value === 'ocr' ? photoDataUrl.value : ''
  captionsUnavailable.value = false
  try {
    const body = kind.value === 'url' ? { kind: kind.value, url: source.value } : kind.value === 'video' ? { kind: kind.value, videoUrl: source.value } : kind.value === 'ocr' ? { kind: kind.value, ...(photo ? { image: photo } : {}), text: source.value || undefined } : { kind: kind.value, prompt: source.value }
    const response = await fetch('/api/ai/recipe/stream', { method: 'POST', headers: { 'Content-Type': 'application/json', ...requestHeaders() }, body: JSON.stringify(body), signal: controller.signal })
    await readRecipeStream(response, (event, raw) => {
      const data = raw as { message?: string, recipe?: RecipeInput, warnings?: string[], provenance?: string, mode?: string, sourceText?: string, captionsUnavailable?: boolean }
      if (data.message) messages.value = [...messages.value.slice(-9), data.message]
      if (event === 'complete' && data.recipe) { draft.value = photo && !data.recipe.imageUrl ? { ...data.recipe, imageUrl: photo } : data.recipe; captionsUnavailable.value = !!data.captionsUnavailable; warnings.value = data.warnings || []; provenance.value = `${data.provenance} · ${data.mode}`; original.value = { input, text: data.sourceText || input, kind: inputKind, photo }; compareView.value = 'source' }
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
        <input ref="photoInput" type="file" accept="image/*" capture="environment" class="sr-only" tabindex="-1" aria-label="Recipe card photo" :disabled="busy || saving" @change="pickPhoto">
        <div v-if="photoDataUrl" class="row-panel flex flex-wrap items-start gap-4">
          <img :src="photoDataUrl" alt="Photo of your recipe card" class="max-h-64 max-w-full rounded-lg border border-rule object-contain">
          <button type="button" class="button-secondary" :disabled="busy || saving" @click="removePhoto"><UIcon name="i-lucide-trash-2" aria-hidden="true" /> Remove photo</button>
        </div>
        <button v-else type="button" class="button-secondary inline-flex items-center gap-2" :disabled="busy || saving" @click="photoInput?.click()"><UIcon name="i-lucide-camera" aria-hidden="true" />Take photo or choose card image</button>
        <p v-if="photoError" role="alert" class="notice mt-3">{{ photoError }}</p>
        <label class="mt-5 block">{{ photoDataUrl ? 'Card text (optional — adds detail to the photo)' : 'Scanned card text' }}
          <textarea v-model="source" class="field mt-2 font-mono text-sm" rows="10" :required="!photoDataUrl" minlength="5" maxlength="30000" :disabled="busy || saving" aria-describedby="ocr-help" placeholder="Yiayia’s Koulourakia&#10;Ingredients&#10;250 g butter…" />
        </label>
        <p id="ocr-help" class="mt-2 text-sm text-muted">Snap the card, or paste text from your phone’s text recognition (Live Text, Google Lens). With a photo, an AI model with vision reads the card; without a key you’ll get a starting draft to complete by hand.</p>
      </div>
      <label v-else class="block">{{ kind === 'prompt' ? 'What do you remember?' : kind === 'video' ? 'YouTube URL or video ID' : 'Recipe URL' }}
        <textarea v-if="kind === 'prompt'" v-model="source" class="field mt-2" rows="5" required minlength="5" maxlength="20000" :disabled="busy || saving" placeholder="Grandma’s lemon chicken, roasted on Sundays…" />
        <input v-else v-model="source" class="field mt-2" :type="kind === 'url' ? 'url' : 'text'" required maxlength="2000" :disabled="busy || saving">
      </label>
      <p class="text-sm">{{ settings.activeProvider === 'ollama' && settings.activeModel ? 'Uses your locally running Ollama model.' : settings.keys[settings.activeProvider] ? 'Uses your selected model. Source text' + (photoDataUrl ? ' and your card photo are' : ' is') + ' sent to that provider.' : 'No API key: structured recipe metadata is preserved; other sources use a clearly labeled starting draft.' }} <NuxtLink class="text-action" to="/settings">AI settings</NuxtLink></p>
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
          <img v-if="original.photo" :src="original.photo" alt="Photographed recipe card" class="mt-3 max-h-[28rem] w-full rounded-lg border border-rule object-contain">
          <pre v-if="original.text || !original.photo" class="mt-3 max-h-[28rem] overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">{{ original.text }}</pre>
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
      <p v-if="captionsUnavailable" role="note" class="notice mt-4"><UIcon name="i-lucide-info" class="mr-1 align-text-bottom" aria-hidden="true" />This video doesn’t have captions, so Heirloom built the recipe from the creator’s cooking notes and timestamps. Steps and amounts that were pieced together are tagged as inferred — give them a quick check before you save.</p>
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
