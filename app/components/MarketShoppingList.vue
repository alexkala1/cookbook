<script setup lang="ts">
import type { Component } from 'vue'
import IconLaiki from './icons/market/IconLaiki.vue'
import IconChasapis from './icons/market/IconChasapis.vue'
import IconFournos from './icons/market/IconFournos.vue'
import IconSupermarket from './icons/market/IconSupermarket.vue'
import { marketSections, sectionInfo, type MenuCourse, type MarketSection } from '#shared/culinary/grocery'
import { inferStorage, type PantryDraft } from '#shared/culinary/pantry'
import { shoppingListText, routeShoppingList, type MarketShoppingList, type ShoppingMode } from '../utils/shopping-list'
import { formatWhatsAppMarketList, encodeMarketPayload, generateMarketQrSvg } from '../utils/market-share'
import { formatPriceBadge, type PriceBadge } from '../utils/market-prices'
import type { PriceResponse } from '../../server/utils/market-prices'

const props = defineProps<{ courses: { recipeId: string; course: MenuCourse }[]; servings?: number; servingsNoun?: string; autoGenerate?: boolean; importedList?: MarketShoppingList }>()
// An imported list (scanned from another device) is shown as-is: there is nothing to generate.
const list = ref<MarketShoppingList | null>(props.importedList ?? null)
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
const priceController = new AbortController()
onBeforeUnmount(() => { disposed = true; controller?.abort(); priceController.abort() })

// Supermarket prices are a bonus: fetched quietly, three at a time, and never reported as an error.
const MAX_PRICE_LOOKUPS = 30, PRICE_CONCURRENCY = 3
const priceBadges = ref<Record<string, PriceBadge | null>>({})
const priceAsked = new Set<string>()
let priceQueue: { id: string, name: string }[] = [], priceActive = 0
function resetPrices() { priceBadges.value = {}; priceAsked.clear(); priceQueue = [] }
async function lookupPrice({ id, name }: { id: string, name: string }) {
  try {
    const result = await $fetch<PriceResponse>('/api/market/prices', { query: { q: name }, signal: priceController.signal })
    if (!disposed) priceBadges.value[id] = result.available ? formatPriceBadge(result.products) : null
  } catch { /* No price, no badge. */ }
}
function pumpPrices() {
  while (!disposed && priceActive < PRICE_CONCURRENCY && priceQueue.length) {
    priceActive++
    void lookupPrice(priceQueue.shift()!).finally(() => { priceActive--; pumpPrices() })
  }
}
watch(routedList, value => {
  if (!value || !import.meta.client || navigator.onLine === false) return
  for (const destination of value.destinations) {
    if (destination.section !== 'supermarket') continue
    for (const item of destination.items) {
      const name = item.name.trim()
      if (priceAsked.has(item.id) || priceAsked.size >= MAX_PRICE_LOOKUPS || !name || name.length > 80) continue
      priceAsked.add(item.id)
      priceQueue.push({ id: item.id, name })
    }
  }
  pumpPrices()
}, { immediate: true, flush: 'post' })

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
    restockedIds.value = []
    restockSuccess.value = null
    restockError.value = ''
    destinations.value = {}
    resetPrices()
    mode.value = 'market'
  } catch {
    if (!disposed) error.value = 'Could not generate the shopping list. Your schedule is still available. Please try again.'
  } finally { if (!disposed) busy.value = false }
}

const vendorBadge: Record<MarketSection, { icon: Component, category: string, tone: string }> = {
  laiki: { icon: IconLaiki, category: 'Fresh produce', tone: 'border-olive/40 bg-olive/10 text-olive-ink' },
  chasapis: { icon: IconChasapis, category: 'Meat & poultry', tone: 'border-terracotta/40 bg-terracotta/10 text-terracotta-ink' },
  fournos: { icon: IconFournos, category: 'Bread & pastry', tone: 'border-rule bg-paper-3 text-ink' },
  supermarket: { icon: IconSupermarket, category: 'Pantry & dairy', tone: 'border-sage/50 bg-sage/10 text-sage-ink' }
}

// Print only this list (see the unscoped print styles below), then restore the page.
function printList() {
  const root = document.documentElement
  root.dataset.print = 'market'
  window.addEventListener('afterprint', () => { delete root.dataset.print }, { once: true })
  window.print()
}

// Restock: bought items go into the pantry once. Items already restocked aren't added twice if the cook re-ticks them.
const restocking = ref(false)
const restockError = ref('')
const restockSuccess = ref<string | null>(null)
const { state: restockState, label: restockLabel } = useActionFeedback(restocking, restockError)
const restockedIds = ref<string[]>([])
const pendingRestock = computed(() => (routedList.value?.destinations ?? []).flatMap(destination => destination.items.map(item => ({ item, destination }))).filter(({ item }) => checked.value.includes(item.id) && !restockedIds.value.includes(item.id)))
async function restockPantry() {
  if (restocking.value || busy.value || !list.value) return
  // Use the shop the item belongs to (the cook's own choice in Market Route), not One-Stop's single aisle group.
  const originalSection = new Map(list.value.destinations.flatMap(destination => destination.items.map(item => [item.id, destination.section] as const)))
  const rows = pendingRestock.value.map(({ item }) => ({
    id: item.id,
    draft: {
      name: item.name,
      quantity: item.amount > 0 ? item.amount : 1,
      unit: item.unit || 'item',
      storageLocation: inferStorage(item.name, destinations.value[item.id] ?? originalSection.get(item.id))
    } satisfies PantryDraft
  }))
  if (!rows.length) return
  restocking.value = true
  restockError.value = ''
  try {
    await $fetch('/api/pantry', { method: 'POST', body: rows.map(row => row.draft) })
    restockedIds.value = [...restockedIds.value, ...rows.map(row => row.id)]
    restockSuccess.value = `Restocked ${rows.length} item${rows.length === 1 ? '' : 's'} into your pantry.`
  } catch (cause) {
    if (!disposed) restockError.value = (cause as { data?: { statusMessage?: string } }).data?.statusMessage || 'We couldn’t update your pantry. Your list is unchanged — please try again.'
  } finally { if (!disposed) restocking.value = false }
}

// Share: the native share sheet where there is one (phones), otherwise WhatsApp's web link in a new tab.
const shareNote = ref('')
async function shareWhatsApp() {
  if (!routedList.value || busy.value) return
  const text = formatWhatsAppMarketList(routedList.value, checked.value)
  shareNote.value = ''
  if (typeof navigator !== 'undefined' && navigator.share) {
    try { await navigator.share({ title: routedList.value.title, text }) } catch (cause) {
      if ((cause as DOMException)?.name !== 'AbortError' && !disposed) shareNote.value = 'Sharing didn’t work. Use “Copy shopping list” instead.'
    }
    return
  }
  const opened = window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  if (!opened) {
    try { await navigator.clipboard.writeText(text); shareNote.value = 'WhatsApp couldn’t open, so the list was copied. Paste it into a chat.' } catch { shareNote.value = 'WhatsApp couldn’t open. Use “Copy shopping list” instead.' }
  }
}

// Send to phone: the whole list travels inside the link, so nothing is uploaded anywhere.
const qrDialog = ref<HTMLDialogElement>()
const qrSvg = ref('')
const qrLink = ref('')
const qrError = ref('')
const qrCopied = ref(false)
function openQrModal() {
  if (!routedList.value) return
  qrError.value = ''
  qrCopied.value = false
  qrSvg.value = ''
  try {
    qrLink.value = `${window.location.origin}/market?import=${encodeMarketPayload(routedList.value)}`
    qrSvg.value = generateMarketQrSvg(qrLink.value)
  } catch { qrError.value = 'This list is too long for a code. Use “Share on WhatsApp” or copy the list instead.' }
  qrDialog.value?.showModal()
}
async function copyPhoneLink() {
  try { await navigator.clipboard.writeText(qrLink.value); qrCopied.value = true; qrError.value = '' } catch { qrError.value = 'Clipboard unavailable. Scan the code instead.' }
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
      <button v-if="!importedList" type="button" class="button-primary market-action" :disabled="busy || copying" v-stable-action="state" :data-state="state" :aria-busy="busy" @click="generate">{{ label('Generate Market Shopping List', 'Generating…') }}</button>
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
          <button v-if="pendingRestock.length" type="button" class="button-primary min-h-11 inline-flex items-center gap-2" :disabled="restocking || busy" v-stable-action="restockState" :data-state="restockState" :aria-busy="restocking" @click="restockPantry"><UIcon name="i-lucide-archive" aria-hidden="true" />{{ restockLabel('Restock pantry (' + pendingRestock.length + ')', 'Restocking…') }}</button>
          <button type="button" class="button-secondary" :disabled="copying || busy" v-stable-action="copyState" :data-state="copyState" :aria-busy="copying" @click="copy">{{ copyLabel('Copy shopping list', 'Copying…') }}</button>
          <button type="button" class="button-secondary min-h-11 min-w-11 inline-flex items-center gap-2" :disabled="busy" @click="shareWhatsApp"><UIcon name="i-lucide-share-2" aria-hidden="true" />Share on WhatsApp</button>
          <button type="button" class="button-secondary min-h-11 min-w-11 inline-flex items-center gap-2" :disabled="busy" @click="openQrModal"><UIcon name="i-lucide-qr-code" aria-hidden="true" />Send to phone</button>
          <button type="button" class="button-secondary" :disabled="busy" @click="printList"><UIcon name="i-lucide-printer" aria-hidden="true" />Print or save PDF</button>
        </div>
      </div>
      <p v-if="copyState === 'success'" role="status">Shopping list copied.</p>
      <p role="status" class="print:hidden">{{ shareNote }}</p>
      <dialog ref="qrDialog" class="m-auto w-[min(92vw,28rem)] rounded-xl border border-rule bg-paper p-6 text-ink shadow-2xl backdrop:bg-black/50 print:hidden" aria-labelledby="qr-heading">
        <h3 id="qr-heading" class="font-serif text-2xl">Scan with your phone</h3>
        <p class="mt-2 text-sm text-muted">Point your phone camera at the code below to take this list with you. Interactive checkboxes work offline at the market.</p>
        <div v-if="qrSvg" class="qr-code mt-4 flex justify-center rounded-lg border border-rule bg-white p-4" role="img" aria-label="QR code for this market list" v-html="qrSvg" />
        <p role="status" class="mt-3 text-sm">{{ qrCopied ? 'Phone link copied.' : '' }}</p>
        <p v-if="qrError" role="alert" class="mt-3 text-sm text-error">{{ qrError }}</p>
        <form method="dialog" class="mt-4 flex flex-wrap justify-end gap-3">
          <button type="button" class="button-secondary min-h-11" :disabled="!qrLink || !qrSvg" @click="copyPhoneLink">Copy phone link</button>
          <button class="button-primary min-h-11" autofocus>Close</button>
        </form>
      </dialog>
      <div role="status" class="market-restock-notice print:hidden">
        <p v-if="restockSuccess" class="restock-notice">
          <UIcon name="i-lucide-circle-check" class="size-5 flex-none" aria-hidden="true" />
          <span class="flex min-w-0 flex-col items-start"><span>{{ restockSuccess }} Storage places are our best guess; adjust them in your pantry.</span><NuxtLink to="/pantry" class="text-action font-semibold">View Pantry →</NuxtLink></span>
        </p>
      </div>
      <p v-if="restockError" role="alert" class="rounded-lg border border-error bg-paper p-4 text-error print:hidden">{{ restockError }}</p>
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
          <h3 :id="'market-' + destination.section" class="flex min-w-0 items-center gap-3 text-2xl">
            <component :is="vendorBadge[destination.section].icon" class="size-8 flex-none" />
            <span>{{ destination.name }}</span>
          </h3>
          <div v-if="mode === 'market' && routedList.destinations.length > 1" class="market-reorder flex gap-2 print:hidden" role="group" :aria-label="'Reorder ' + destination.name">
            <button :id="'move-up-' + destination.section" type="button" class="button-secondary min-h-11" :disabled="stop === 0" :aria-label="'Move ' + destination.name + ' up'" @click="moveSection(destination.section, -1)"><UIcon name="i-lucide-arrow-up" aria-hidden="true" />Move up</button>
            <button :id="'move-down-' + destination.section" type="button" class="button-secondary min-h-11" :disabled="stop === routedList.destinations.length - 1" :aria-label="'Move ' + destination.name + ' down'" @click="moveSection(destination.section, 1)"><UIcon name="i-lucide-arrow-down" aria-hidden="true" />Move down</button>
          </div>
        </div>
        <p class="mt-2 inline-flex max-w-full flex-wrap items-center gap-x-1.5 rounded-full border px-3 py-1 text-sm font-semibold" :class="vendorBadge[destination.section].tone">
          <span lang="el">{{ destination.localizedName }}</span><span class="font-normal">· {{ vendorBadge[destination.section].category }}</span>
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
            <div v-if="destination.section === 'supermarket'" class="market-price ml-0 mt-2 min-h-6 sm:ml-14 print:hidden" data-testid="market-price-slot">
              <span v-if="priceBadges[item.id]" data-testid="market-price" class="market-price__badge inline-flex max-w-full items-center gap-1 rounded-full border border-sage/50 bg-sage/10 px-2.5 py-0.5 text-xs font-semibold text-sage-ink" :title="priceBadges[item.id]!.label" :aria-label="priceBadges[item.id]!.label"><UIcon name="i-lucide-tag" class="size-3.5 flex-none" aria-hidden="true" /><span lang="el" class="truncate">{{ priceBadges[item.id]!.text }}</span></span>
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
.restock-notice { display: flex; align-items: flex-start; gap: .5rem; border-left: 3px solid var(--color-sage-ink); background: var(--color-paper-2); padding: .75rem 1rem; color: var(--color-ink); }
.qr-code :deep(svg) { width: 100%; max-width: 16rem; height: auto; }
.market-price__badge { animation: market-price-in .2s ease-out; }
@keyframes market-price-in { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .market-price__badge { animation: none; } }
.restock-notice a { display: inline-flex; min-height: 44px; align-items: center; }
</style>

<style>
/* Printing from the list hides everything that neither is nor contains it (app chrome, schedule, seasonality). */
@media print {
  html[data-print='market'] body *:not(:has(.market-shopping), .market-shopping, .market-shopping *) { display: none !important; }
  html[data-print='market'] .market-shopping { border: 0; padding: 0; }
  html[data-print='market'] .market-shopping :is(button, [role='group'], .market-restock-notice, .market-reorder, .market-destination, [role='alert']) { display: none !important; }
}
</style>
