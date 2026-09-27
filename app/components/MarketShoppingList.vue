<script setup lang="ts">
import type { MenuCourse } from '#shared/culinary/grocery'
import { shoppingListText, type MarketShoppingList } from '../utils/shopping-list'

const props = defineProps<{ courses: { recipeId: string; course: MenuCourse }[]; servings?: number }>()
const list = ref<MarketShoppingList | null>(null)
const checked = ref<string[]>([])
const busy = ref(false)
const error = ref('')
const { state, label } = useActionFeedback(busy, error)
const copying = ref(false)
const copyError = ref('')
const { state: copyState, label: copyLabel } = useActionFeedback(copying, copyError)
const summary = computed(() => list.value ? shoppingListText(list.value, checked.value) : '')
const itemCount = computed(() => list.value?.destinations.reduce((count, store) => count + store.items.length, 0) ?? 0)
let controller: AbortController | undefined
let disposed = false
onBeforeUnmount(() => { disposed = true; controller?.abort() })

async function generate() {
  if (busy.value || copying.value) return
  busy.value = true
  error.value = ''
  copyError.value = ''
  controller = new AbortController()
  try {
    const result = await $fetch<MarketShoppingList>('/api/grocery/generate', {
      method: 'POST', signal: controller.signal,
      body: { courses: props.courses.map(({ recipeId, course }) => ({ recipeId, course })), ...(props.servings ? { servings: props.servings } : {}) }
    })
    if (disposed) return
    list.value = result
    checked.value = []
  } catch {
    if (!disposed) error.value = 'Could not generate the shopping list. Your schedule is still available. Please try again.'
  } finally { if (!disposed) busy.value = false }
}

async function copy() {
  if (!list.value || copying.value || busy.value) return
  copying.value = true
  copyError.value = ''
  try {
    await navigator.clipboard.writeText(summary.value)
  } catch {
    if (!disposed) copyError.value = 'Clipboard unavailable. Select and copy the text below, or try again.'
  } finally { if (!disposed) copying.value = false }
}
</script>

<template>
  <section aria-labelledby="market-heading" class="market-shopping min-w-0 border-t border-rule pt-8 text-ink">
    <div class="section-heading">
      <h2 id="market-heading">Market shopping list</h2>
      <button type="button" class="button-primary market-action" :disabled="busy || copying" v-stable-action="state" :data-state="state" :aria-busy="busy" @click="generate">{{ label('Generate Market Shopping List', 'Generating…') }}</button>
    </div>
    <p class="mt-4">Grouped for your chosen courses{{ servings ? ' and ' + servings + ' guests' : ', using each recipe’s servings' }}. Check your pantry before buying; stock is not subtracted.</p>
    <p v-if="error" role="alert" class="mt-4 rounded-lg border border-error bg-paper p-4 text-error">{{ error }}</p>
    <div v-if="list" class="mt-6 space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p role="status" class="num">{{ checked.length }} of {{ itemCount }} items checked</p>
        <button type="button" class="button-secondary" :disabled="copying || busy" v-stable-action="copyState" :data-state="copyState" :aria-busy="copying" @click="copy">{{ copyLabel('Copy shopping list', 'Copying…') }}</button>
      </div>
      <p v-if="copyState === 'success'" role="status">Shopping list copied.</p>
      <div v-if="copyError" class="space-y-3">
        <p role="alert" class="text-error">{{ copyError }}</p>
        <label class="block">Shopping list text<textarea :value="summary" readonly rows="8" class="field mt-2" @focus="($event.target as HTMLTextAreaElement).select()" /></label>
      </div>
      <p class="text-sm">Checkoffs last while this list is open. Regenerating, changing the dinner inputs or leaving this page clears them. Copy the list to take it with you.</p>
      <section v-if="list.prepAlerts.length" aria-label="Prepare ahead" class="rounded-lg border border-rule bg-paper-2 p-5">
        <h3>Prepare ahead</h3>
        <ul class="mt-3 list-disc space-y-3 pl-5">
          <li v-for="(alert, index) in list.prepAlerts" :key="index"><strong>{{ alert.recipeTitle }}:</strong> {{ alert.text }}</li>
        </ul>
      </section>
      <p v-if="!itemCount" role="status">No shopping items were found. Add measured ingredients to your recipes, then rebuild the schedule and generate again.</p>
      <section v-for="destination in list.destinations" :key="destination.section" :aria-labelledby="'market-' + destination.section" class="min-w-0">
        <h3 :id="'market-' + destination.section" class="text-2xl">{{ destination.name }}</h3>
        <p lang="el" class="mt-1">{{ destination.localizedName }}</p>
        <ul class="mt-4 divide-y divide-rule border-y border-rule">
          <li v-for="item in destination.items" :key="item.id" class="py-5">
            <label class="flex min-h-11 items-start gap-3">
              <input v-model="checked" type="checkbox" :value="item.id" :aria-label="'Bought: ' + item.name" />
              <span class="min-w-0 pt-2 font-semibold" :class="{ 'line-through': checked.includes(item.id) }"><span class="num">{{ item.amount }} {{ item.unit }}</span> {{ item.name }}</span>
            </label>
            <div class="ml-0 mt-3 space-y-2 sm:ml-14">
              <p v-if="item.counterPhrase"><strong>At the counter:</strong> <span lang="el">{{ item.counterPhrase }}</span></p>
              <p v-if="item.packageSizeToBuy"><strong>Buy:</strong> {{ item.packageSizeToBuy }}</p>
              <p v-if="item.surplusLeftoverTip"><strong>Surplus:</strong> {{ item.surplusLeftoverTip }}</p>
              <p v-if="item.note">{{ item.note }}</p>
              <p v-for="(note, index) in item.prepNotes" :key="index"><strong>Prep:</strong> {{ note }}</p>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<style scoped>
.market-shopping { overflow-wrap: anywhere; font-style: normal; }
.market-action { max-width: 100%; white-space: normal; }
</style>
