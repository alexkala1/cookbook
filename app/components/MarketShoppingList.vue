<script setup lang="ts">
import { marketSections, sectionInfo, type MenuCourse, type MarketSection } from '#shared/culinary/grocery'
import { shoppingListText, routeShoppingList, type MarketShoppingList, type ShoppingMode } from '../utils/shopping-list'

const props = defineProps<{ courses: { recipeId: string; course: MenuCourse }[]; servings?: number; servingsNoun?: string; autoGenerate?: boolean }>()
const list = ref<MarketShoppingList | null>(null)
const checked = ref<string[]>([])
const mode = ref<ShoppingMode>('market')
const destinations = ref<Record<string, MarketSection>>({})
// The cook's own walking order through the shops, remembered on this device.
const orderKey = 'heirloom-market-destination-order'
const sectionOrder = ref<MarketSection[]>([...marketSections])
const orderNote = ref('')
onMounted(() => {
  if (props.autoGenerate) void generate()
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(orderKey) ?? 'null')
    if (Array.isArray(saved)) {
      const known = saved.filter((section): section is MarketSection => marketSections.includes(section)).filter((section, i, all) => all.indexOf(section) === i)
      sectionOrder.value = [...known, ...marketSections.filter(section => !known.includes(section))]
    }
  } catch { /* Storage blocked or unreadable: keep the default order. */ }
})
watch(sectionOrder, value => { try { localStorage.setItem(orderKey, JSON.stringify(value)) } catch { /* Order simply won't persist. */ } })
const routedList = computed(() => list.value ? routeShoppingList(list.value, destinations.value, mode.value, sectionOrder.value) : null)

// Swap with the neighbouring stop that is actually on screen, so every click visibly moves the section.
async function moveSection(section: MarketSection, direction: -1 | 1) {
  const shown = routedList.value?.destinations.map(destination => destination.section) ?? []
  const neighbour = shown[shown.indexOf(section) + direction]
  if (!neighbour) return
  const next = [...sectionOrder.value], a = next.indexOf(section), b = next.indexOf(neighbour)
  next[a] = neighbour; next[b] = section
  sectionOrder.value = next
  orderNote.value = `${sectionInfo[section].name} moved to stop ${shown.indexOf(section) + direction + 1} of ${shown.length}.`
  await nextTick()
  const edge = (direction === -1 ? routedList.value?.destinations[0]?.section : routedList.value?.destinations.at(-1)?.section) === section
  document.getElementById(`move-${edge ? (direction === -1 ? 'down' : 'up') : direction === -1 ? 'up' : 'down'}-${section}`)?.focus()
}
const busy = ref(false)
const error = ref('')
const { state, label } = useActionFeedback(busy, error)
const copying = ref(false)
const copyError = ref('')
const { state: copyState, label: copyLabel } = useActionFeedback(copying, copyError)
const summary = computed(() => routedList.value ? shoppingListText(routedList.value, checked.value) : '')
const itemCount = computed(() => list.value?.destinations.reduce((count, store) => count + store.items.length, 0) ?? 0)
let controller: AbortController | undefined
let disposed = false
onBeforeUnmount(() => { disposed = true; controller?.abort() })

async function moveItem(id: string, destination: MarketSection) {
  destinations.value[id] = destination
  await nextTick()
  document.getElementById('destination-' + id)?.focus()
}

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
    destinations.value = {}
    mode.value = 'market'
  } catch {
    if (!disposed) error.value = 'Could not generate the shopping list. Your schedule is still available. Please try again.'
  } finally { if (!disposed) busy.value = false }
}

const vendorBadge: Record<MarketSection, { icon: string, category: string, tone: string }> = {
  laiki: { icon: 'i-lucide-carrot', category: 'Fresh produce', tone: 'border-olive/40 bg-olive/10 text-olive-ink' },
  chasapis: { icon: 'i-lucide-beef', category: 'Meat & poultry', tone: 'border-terracotta/40 bg-terracotta/10 text-terracotta-ink' },
  fournos: { icon: 'i-lucide-croissant', category: 'Bread & pastry', tone: 'border-rule bg-paper-3 text-ink' },
  supermarket: { icon: 'i-lucide-store', category: 'Pantry & dairy', tone: 'border-sage/50 bg-sage/10 text-sage-ink' }
}

// Print only this list (see the unscoped print styles below), then restore the page.
function printList() {
  const root = document.documentElement
  root.dataset.print = 'market'
  window.addEventListener('afterprint', () => { delete root.dataset.print }, { once: true })
  window.print()
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
    <p class="mt-4">Grouped for your chosen courses{{ servings ? ' and ' + servings + ' ' + (servingsNoun ?? 'guests') : ', using each recipe’s servings' }}. Check your pantry before buying; stock is not subtracted.</p>
    <p v-if="error" role="alert" class="mt-4 rounded-lg border border-error bg-paper p-4 text-error">{{ error }}</p>
    <div v-if="list && routedList" class="mt-6 space-y-6">
      <div role="group" aria-label="Shopping mode" class="flex flex-wrap gap-2">
        <button class="filter-pill" :aria-pressed="mode === 'market'" @click="mode = 'market'">Market Route</button>
        <button class="filter-pill" :aria-pressed="mode === 'supermarket'" @click="mode = 'supermarket'">One-Stop Supermarket</button>
      </div>
      <p v-if="mode === 'supermarket'" class="text-sm">All items are grouped into supermarket aisles. Return to Market Route to edit destinations; your custom route and checkmarks are kept.</p>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p role="status" class="num">{{ checked.length }} of {{ itemCount }} items checked</p>
        <div class="flex flex-wrap gap-3 print:hidden">
          <button type="button" class="button-secondary" :disabled="copying || busy" v-stable-action="copyState" :data-state="copyState" :aria-busy="copying" @click="copy">{{ copyLabel('Copy shopping list', 'Copying…') }}</button>
          <button type="button" class="button-secondary" :disabled="busy" @click="printList"><UIcon name="i-lucide-printer" aria-hidden="true" />Print or save PDF</button>
        </div>
      </div>
      <p v-if="copyState === 'success'" role="status">Shopping list copied.</p>
      <div v-if="copyError" class="space-y-3">
        <p role="alert" class="text-error">{{ copyError }}</p>
        <label class="block">Shopping list text<textarea :value="summary" readonly rows="8" class="field mt-2" @focus="($event.target as HTMLTextAreaElement).select()" /></label>
      </div>
      <p class="text-sm print:hidden">Checkoffs last while this list is open. Regenerating, changing the dinner inputs or leaving this page clears them. Copy the list to take it with you.</p>
      <section v-if="list.prepAlerts.length" aria-label="Prepare ahead" class="rounded-lg border border-rule bg-paper-2 p-5">
        <h3>Prepare ahead</h3>
        <ul class="mt-3 list-disc space-y-3 pl-5">
          <li v-for="(alert, index) in list.prepAlerts" :key="index"><strong>{{ alert.recipeTitle }}:</strong> {{ alert.text }}</li>
        </ul>
      </section>
      <p v-if="!itemCount" role="status">No shopping items were found. Add measured ingredients to your recipes, then rebuild the schedule and generate again.</p>
      <p v-if="mode === 'market' && routedList.destinations.length > 1" class="text-sm print:hidden">Order the stops to match how you walk the shops; we’ll remember it on this device.</p>
      <p role="status" class="sr-only">{{ orderNote }}</p>
      <section v-for="(destination, stop) in routedList.destinations" :key="destination.section" :aria-labelledby="'market-' + destination.section" class="min-w-0">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 :id="'market-' + destination.section" class="text-2xl">{{ destination.name }}</h3>
          <div v-if="mode === 'market' && routedList.destinations.length > 1" class="market-reorder flex gap-2 print:hidden" role="group" :aria-label="'Reorder ' + destination.name">
            <button :id="'move-up-' + destination.section" type="button" class="button-secondary min-h-11" :disabled="stop === 0" :aria-label="'Move ' + destination.name + ' up'" @click="moveSection(destination.section, -1)"><UIcon name="i-lucide-arrow-up" aria-hidden="true" />Move up</button>
            <button :id="'move-down-' + destination.section" type="button" class="button-secondary min-h-11" :disabled="stop === routedList.destinations.length - 1" :aria-label="'Move ' + destination.name + ' down'" @click="moveSection(destination.section, 1)"><UIcon name="i-lucide-arrow-down" aria-hidden="true" />Move down</button>
          </div>
        </div>
        <p class="mt-2 inline-flex max-w-full flex-wrap items-center gap-x-1.5 rounded-full border px-3 py-1 text-sm font-semibold" :class="vendorBadge[destination.section].tone">
          <UIcon :name="vendorBadge[destination.section].icon" class="flex-none" aria-hidden="true" /><span lang="el">{{ destination.localizedName }}</span><span class="font-normal">· {{ vendorBadge[destination.section].category }}</span>
        </p>
        <ul class="mt-4 divide-y divide-rule border-y border-rule">
          <li v-for="(item, index) in destination.items" :key="item.id" class="py-5">
            <h4 v-if="item.aisle && item.aisle !== destination.items[index - 1]?.aisle" class="mb-4 font-semibold">{{ item.aisle }}</h4>
            <label class="flex min-h-11 items-start gap-3">
              <input v-model="checked" type="checkbox" :value="item.id" :aria-label="'Bought: ' + item.name" />
              <span class="min-w-0 pt-2 font-semibold" :class="{ 'line-through': checked.includes(item.id) }"><span class="num">{{ item.amount }} {{ item.unit }}</span> {{ item.name }}</span>
            </label>
            <label class="market-destination mt-3 block max-w-sm">Shop at
              <select :id="'destination-' + item.id" :value="destination.section" :aria-label="'Destination for ' + item.name" :disabled="mode === 'supermarket'" class="field mt-2" @change="moveItem(item.id, ($event.target as HTMLSelectElement).value as MarketSection)">
                <option v-for="section in marketSections" :key="section" :value="section">{{ sectionInfo[section].name }}</option>
              </select>
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

<style>
/* Printing from the list hides everything that neither is nor contains it (app chrome, schedule, seasonality). */
@media print {
  html[data-print='market'] body *:not(:has(.market-shopping), .market-shopping, .market-shopping *) { display: none !important; }
  html[data-print='market'] .market-shopping { border: 0; padding: 0; }
  html[data-print='market'] .market-shopping :is(button, [role='group'], .market-reorder, .market-destination, [role='alert']) { display: none !important; }
}
</style>
