<script setup lang="ts">
import { TONIGHT_CHIPS, matchTonight, type TonightMatchInput, type TonightMatchResult } from '~~/shared/culinary/tonight'

const props = defineProps<{ recipes?: TonightMatchInput[] | null }>()

// Client-only: `/` is prerendered at build time, so an SSR fetch would freeze an empty cookbook into the page.
const { data: fetched } = useFetch<TonightMatchInput[]>('/api/recipes/tonight', { server: false, lazy: true, immediate: !props.recipes, default: () => [] })
const source = computed(() => props.recipes ?? fetched.value ?? [])

const selected = ref<string[]>([])
const customInput = ref('')

const knownQueries = new Set<string>(TONIGHT_CHIPS.map(chip => chip.query))
const customChips = computed(() => selected.value.filter(query => !knownQueries.has(query)))

function toggle(query: string) {
  selected.value = selected.value.includes(query) ? selected.value.filter(item => item !== query) : [...selected.value, query]
}
function addCustom() {
  const value = customInput.value.trim().toLowerCase().slice(0, 60)
  if (value && !selected.value.includes(value)) selected.value = [...selected.value, value]
  customInput.value = ''
}

const matches = computed<TonightMatchResult[]>(() => matchTonight(source.value, selected.value).filter(match => match.tier !== 'other'))
const ready = computed(() => matches.value.filter(match => match.tier === 'ready').length)
const almost = computed(() => matches.value.length - ready.value)
const summary = computed(() => {
  const dinners = (n: number) => `${n} dinner${n === 1 ? '' : 's'}`
  if (!matches.value.length) return 'No dinners match yet'
  if (!almost.value) return `🎉 ${dinners(ready.value)} ready to cook tonight (0 missing)`
  if (!ready.value) return `${almost.value} recipe${almost.value === 1 ? '' : 's'} missing 1–2 ingredients`
  return `⚡ ${dinners(ready.value)} ready · ${almost.value} recipe${almost.value === 1 ? '' : 's'} missing 1–2 ingredients`
})
const badge = (match: TonightMatchResult) => match.tier === 'ready' ? '⚡ Ready to cook' : `Missing: ${match.missingIngredients.slice(0, 2).join(', ')}`
</script>

<template>
  <div class="tonight-picker">
    <div class="flex flex-wrap gap-2" role="group" aria-label="Ingredients in your kitchen">
      <button
        v-for="chip in TONIGHT_CHIPS" :key="chip.id" type="button"
        class="tonight-chip" :class="selected.includes(chip.query) ? 'border-olive bg-olive/15 text-olive-ink font-semibold' : 'border-rule hover:bg-paper-2'"
        :aria-pressed="selected.includes(chip.query)" @click="toggle(chip.query)"
      ><span aria-hidden="true">{{ chip.emoji }}</span> {{ chip.label }}</button>
      <button
        v-for="query in customChips" :key="query" type="button"
        class="tonight-chip border-olive bg-olive/15 text-olive-ink font-semibold capitalize"
        aria-pressed="true" @click="toggle(query)"
      >{{ query }}<span class="sr-only"> (remove)</span><span aria-hidden="true"> ×</span></button>
    </div>

    <form class="mt-4 flex flex-wrap items-end gap-2" @submit.prevent="addCustom">
      <label class="min-w-0 flex-1 basis-48 text-sm">Something else in the fridge?
        <input v-model="customInput" type="text" class="field mt-1" placeholder="zucchini, spinach…" maxlength="60" autocomplete="off">
      </label>
      <button type="submit" class="button-secondary min-h-11 min-w-11">+ Add</button>
      <button v-if="selected.length" type="button" class="button-secondary min-h-11 min-w-11" @click="selected = []">Clear</button>
    </form>

    <div class="mt-6" role="status" aria-live="polite">
      <p v-if="selected.length" class="font-serif text-xl" data-testid="tonight-summary">{{ summary }}</p>
      <p v-else class="text-muted">Tap what you have and we’ll show what you can cook right now. Salt, pepper, oil and water are assumed.</p>
    </div>

    <ul v-if="selected.length && matches.length" class="mt-4 grid gap-4 sm:grid-cols-2" data-testid="tonight-results">
      <li v-for="match in matches" :key="match.id" class="flex min-w-0 flex-col rounded-xl border border-rule bg-paper p-4" data-testid="tonight-match">
        <h3 class="break-words font-serif text-xl leading-snug">{{ match.title }}</h3>
        <p v-if="match.totalTimeMinutes" class="mt-1 text-sm text-muted">⏱️ {{ match.totalTimeMinutes }} min</p>
        <p class="mt-3">
          <span class="inline-block rounded-full px-3 py-1 text-sm font-semibold" :class="match.tier === 'ready' ? 'bg-olive/15 text-olive-ink' : 'bg-allergen-wash text-allergen-ink'">{{ badge(match) }}</span>
        </p>
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <NuxtLink :to="`/recipes/${match.id}/cook`" class="button-primary">Cook tonight<span class="sr-only"> · {{ match.title }}</span></NuxtLink>
          <NuxtLink :to="`/recipes/${match.id}`" class="text-action inline-flex min-h-11 items-center">View recipe<span class="sr-only"> · {{ match.title }}</span></NuxtLink>
        </div>
      </li>
    </ul>
    <p v-else-if="selected.length" class="mt-4 rounded-xl border border-dashed border-rule p-4 text-muted">Nothing cookable from that yet — tap another ingredient and the list fills in.</p>
  </div>
</template>

<style scoped>
.tonight-chip { display: inline-flex; min-height: 44px; min-width: 44px; align-items: center; justify-content: center; gap: .375rem; border-width: 1px; border-radius: 999px; padding: .5rem 1rem; font-size: .9375rem; }
</style>
