<script setup lang="ts">
import { PANTRY_STAPLES, pantryStepForUnit, storageLocations, type PantryItem, type PantryDraft, type PantryMatch } from '#shared/culinary/pantry'
import type { ChefAdvice } from '#shared/culinary/chef-advice'
useSeoMeta({ title: 'Your pantry — Heirloom' })

const { requestHeaders, ready: byokReady } = useByokSettings()

const { data: items, error: loadError, refresh } = await useFetch<PantryItem[]>('/api/pantry')
const location = ref('all')
const busy = ref(false)
const message = ref('')
const receipt = ref('')
const actionError = ref('')
const { state, label } = useActionFeedback(busy, actionError)
const now = ref(Date.now())

onMounted(() => {
  now.value = Date.now()
})

const visible = computed(() =>
  (items.value ?? []).filter(item => location.value === 'all' || item.storageLocation === location.value)
)
const counts = computed<Record<string, number>>(() => {
  const all = items.value ?? []
  return { all: all.length, ...Object.fromEntries(storageLocations.map(place => [place, all.filter(item => item.storageLocation === place).length])) }
})
const form = reactive<PantryDraft>({ name: '', quantity: 1, unit: 'item', storageLocation: 'pantry' })
const expiry = ref('')
const drafts = ref<PantryDraft[]>([])
const matches = ref<PantryMatch[] | null>(null)
type ChefAnswer = ChefAdvice & { mode: 'live' | 'fallback' }
const advice = ref<ChefAnswer | null>(null)

function errorText(error: unknown) {
  return (
    (error as { data?: { statusMessage?: string } }).data?.statusMessage ||
    'Unable to complete this action. Please try again.'
  )
}

async function act(action: () => Promise<void>) {
  busy.value = true
  message.value = ''
  actionError.value = ''
  try {
    await action()
  } catch (error) {
    message.value = errorText(error)
    actionError.value = message.value
  } finally {
    busy.value = false
  }
}

async function save(values: PantryDraft[]) {
  await $fetch('/api/pantry', { method: 'POST', body: values })
  await refresh()
  matches.value = null
}

function add() {
  void act(async () => {
    await save([{ ...form, expiresAt: expiry.value ? new Date(expiry.value + 'T23:59:59').getTime() : null }])
    form.name = ''
    expiry.value = ''
    message.value = 'Added to your pantry.'
  })
}

function quickAddStaple(staple: PantryDraft) {
  void act(async () => {
    await save([staple])
    message.value = `Restocked ${staple.name} (+${staple.quantity} ${staple.unit}) in your ${staple.storageLocation}.`
  })
}

function adjustQuantity(item: PantryItem, delta: number) {
  void act(async () => {
    const updated = await $fetch<PantryItem>('/api/pantry/' + item.id, {
      method: 'PATCH',
      body: { delta }
    })
    item.quantity = updated.quantity
    item.updatedAt = updated.updatedAt
    matches.value = null
    advice.value = null
  })
}

function remove(id: string) {
  void act(async () => {
    await $fetch('/api/pantry/' + id, { method: 'DELETE' })
    await refresh()
    matches.value = null
  })
}

function parse() {
  void act(async () => {
    const result = await $fetch<{ items: PantryDraft[]; notice: string }>('/api/pantry/receipt', {
      method: 'POST',
      body: { text: receipt.value }
    })

    drafts.value = result.items
    message.value = result.notice
  })
}

function findRecipes() {
  void act(async () => {
    matches.value = await $fetch<PantryMatch[]>('/api/pantry/match', { method: 'POST' })
  })
}

function askChef() {
  void act(async () => {
    advice.value = await $fetch<ChefAnswer>('/api/pantry/chef-advice', { method: 'POST', headers: requestHeaders() })
  })
}

function expiryLabel(item: PantryItem) {
  if (item.expiresAt === null) return 'No expiry set'
  const days = Math.ceil((item.expiresAt - now.value) / 86400000)
  return days <= 0
    ? 'Expired — excluded from matches'
    : days <= 3
      ? 'Use soon · ' + new Date(item.expiresAt).toLocaleDateString('en-GB')
      : 'Expires ' + new Date(item.expiresAt).toLocaleDateString('en-GB')
}
</script>
<template>
  <section class="page-section">
    <h1 class="mt-3 font-serif">Your pantry</h1>

    <p class="mt-4 max-w-2xl text-muted">Keep track of what you have, use what is freshest, and find tonight’s
      recipe.</p>
    <p v-if="loadError" role="alert" class="notice mt-4">Inventory unavailable.
      <button class="text-action" @click="refresh()">Retry</button>
    </p>

    <p v-if="message" role="status" class="notice mt-4">{{ message }}</p>

    <form
      class="row-panel my-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Add pantry item"
      @submit.prevent="add"
    >
      <label>Name<input v-model="form.name" class="field" required maxlength="200" placeholder="Chickpeas" /></label>
      <label>Quantity<input
          v-model.number="form.quantity"
          class="field"
          type="number"
          min="0.001"
          max="1000000"
          step="any"
          required
      /></label>
      <label>Unit<input v-model="form.unit" class="field" required maxlength="40" placeholder="item, g, kg, ml"
      /></label>
      <label>Storage location<select v-model="form.storageLocation" class="field">
          <option v-for="place in storageLocations" :key="place" :value="place">{{ place }}</option>
        </select></label>
      <label>Expiry date (optional)<input v-model="expiry" class="field" type="date" /></label>
      <button
        class="button-primary self-end"
        :disabled="busy"
        v-stable-action="state"
        :data-state="state"
        :aria-busy="busy"
      >{{ label('Add item') }}</button>
    </form>

    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex flex-wrap gap-2" role="group" aria-label="Filter by storage">
        <button
          v-for="place in ['all', ...storageLocations]"
          :key="place"
          class="filter-pill min-h-11 capitalize"
          :aria-pressed="location === place"
          @click="location = place"
        >{{ place }} <span class="num">({{ counts[place] }})</span></button>
      </div>
      <div class="flex flex-wrap gap-3">
        <button
          class="button-primary inline-flex items-center gap-2"
          :disabled="busy || !byokReady"
          v-stable-action="state"
          :data-state="state"
          :aria-busy="busy"
          @click="askChef"
        ><UIcon name="i-lucide-chef-hat" aria-hidden="true" />{{ label('What can I cook tonight?', 'Asking the chef…') }}</button>
        <button
          class="button-secondary"
          :disabled="busy"
          v-stable-action="state"
          :data-state="state"
          :aria-busy="busy"
          @click="findRecipes"
        >{{ label('Cook With What I Have') }}</button>
      </div>
    </div>

    <section class="mt-6" aria-labelledby="staples-heading">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-sparkles" class="size-4 text-terracotta-ink" aria-hidden="true" />
        <h2 id="staples-heading" class="meta-label">Quick-add kitchen staples</h2>
      </div>
      <div class="mt-2 flex flex-wrap gap-2" role="group" aria-label="Kitchen staples quick-add">
        <button
          v-for="staple in PANTRY_STAPLES"
          :key="staple.name"
          type="button"
          class="filter-pill min-h-11 inline-flex items-center gap-1.5"
          :disabled="busy"
          :aria-label="'Add ' + staple.quantity + ' ' + staple.unit + ' of ' + staple.name + ' to pantry'"
          @click="quickAddStaple(staple)"
        >
          <UIcon name="i-lucide-plus" class="size-3.5" aria-hidden="true" />
          <span>{{ staple.name }}</span>
          <span class="text-xs text-muted">({{ staple.quantity }} {{ staple.unit }})</span>
        </button>
      </div>
    </section>

    <details v-if="advice" open class="keepsake-advice mt-8" aria-label="Chef advice">
      <summary class="flex min-h-11 cursor-pointer select-none items-center justify-between gap-3 font-serif text-2xl [&::-webkit-details-marker]:hidden">
        <span class="flex items-center gap-2"><UIcon name="i-lucide-chef-hat" class="flex-none text-terracotta-ink" aria-hidden="true" />Tonight, from your kitchen</span>
        <UIcon name="i-lucide-chevron-down" class="size-5 flex-none" aria-hidden="true" />
      </summary>
      <p class="mt-2 text-sm text-muted">{{ advice.mode === 'live' ? 'Tips refined by your AI model — verify swaps before cooking.' : 'Suggestions from your cookbook and pantry. Add an AI key in Settings for friendlier, tailored swaps.' }}</p>
      <p v-if="!advice.ready.length && !advice.swaps.length && !advice.useItUp.length" role="status" class="mt-4">Nothing to suggest yet. Save a few recipes and add what’s in your kitchen, and we’ll help you plan tonight.</p>

      <section v-if="advice.ready.length" class="mt-6" aria-labelledby="advice-ready">
        <h3 id="advice-ready" class="font-serif text-xl">Ready to cook now</h3>
        <ul class="mt-3 space-y-2">
          <li v-for="item in advice.ready" :key="item.id"><NuxtLink :to="'/recipes/' + item.id" class="text-action font-semibold">{{ item.title }}</NuxtLink> <span class="text-muted">— {{ item.note }}</span></li>
        </ul>
      </section>

      <section v-if="advice.swaps.length" class="mt-6" aria-labelledby="advice-swaps">
        <h3 id="advice-swaps" class="font-serif text-xl">Almost there — smart swaps</h3>
        <article v-for="swap in advice.swaps" :key="swap.recipeId" class="mt-3 min-w-0 break-words">
          <p><NuxtLink :to="'/recipes/' + swap.recipeId" class="text-action font-semibold">{{ swap.title }}</NuxtLink> needs <strong>{{ swap.missing }}</strong><span v-if="swap.stillNeeded.length"> (and {{ swap.stillNeeded.join(', ') }})</span>.</p>
          <ul class="mt-1 space-y-1 pl-5">
            <li v-for="option in swap.options" :key="option.name" class="list-disc"><strong>{{ option.name }}</strong> — {{ option.ratio }} {{ option.adjustment }}</li>
          </ul>
        </article>
      </section>

      <section v-if="advice.useItUp.length" class="mt-6" aria-labelledby="advice-use">
        <h3 id="advice-use" class="font-serif text-xl">Use it up before it turns</h3>
        <ul class="mt-3 space-y-2">
          <li v-for="entry in advice.useItUp" :key="entry.itemId" class="break-words"><UIcon name="i-lucide-leaf" class="mr-1 text-sage-ink" aria-hidden="true" />{{ entry.tip }}</li>
        </ul>
      </section>
    </details>

    <p v-if="!visible.length" class="empty-state mt-6">{{ location === 'all' ? 'Nothing here yet. Add an ingredient above.' : 'Nothing in the ' + location + ' yet. Add an ingredient above, or pick another shelf.' }}</p>

    <ul class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Pantry inventory">
      <li v-for="item in visible" :key="item.id" class="row-panel min-w-0 break-words">
        <p class="meta-label">{{ item.storageLocation }}</p>
        <h2 class="mt-2 font-serif text-2xl">{{ item.name }}</h2>
        <div class="mt-3 flex items-center justify-between gap-3">
          <div>
            <span class="font-serif text-2xl font-bold tabular-nums">{{ Number(item.quantity.toFixed(3)) }}</span>
            <span class="ml-1 text-muted">{{ item.unit }}</span>
            <span v-if="item.quantity <= 0" class="ml-2 rounded bg-terracotta/10 px-1.5 py-0.5 text-xs font-semibold text-terracotta-ink">Out of stock</span>
          </div>
          <div class="inline-flex items-center gap-1 rounded-lg border border-rule bg-paper p-0.5 shadow-sm" role="group" :aria-label="'Adjust quantity for ' + item.name">
            <button
              type="button"
              class="min-h-11 min-w-11 inline-flex items-center justify-center rounded text-muted hover:bg-paper-2 hover:text-ink disabled:opacity-30 disabled:pointer-events-none"
              :disabled="busy || item.quantity <= 0"
              :aria-label="'Decrease ' + item.name + ' quantity'"
              @click="adjustQuantity(item, -pantryStepForUnit(item.unit))"
            >
              <UIcon name="i-lucide-minus" class="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="min-h-11 min-w-11 inline-flex items-center justify-center rounded text-muted hover:bg-paper-2 hover:text-ink disabled:opacity-30 disabled:pointer-events-none"
              :disabled="busy"
              :aria-label="'Increase ' + item.name + ' quantity'"
              @click="adjustQuantity(item, pantryStepForUnit(item.unit))"
            >
              <UIcon name="i-lucide-plus" class="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <p
          class="mt-3 text-sm"
          :class="
            item.expiresAt !== null && item.expiresAt - now < 259200000
              ? 'font-semibold text-terracotta-ink'
              : 'text-muted'
          "
        >{{ expiryLabel(item) }}</p>
        <button
          class="text-action mt-4"
          :disabled="busy"
          v-stable-action="state"
          :data-state="state"
          :aria-busy="busy"
          :aria-label="'Remove ' + item.name"
          @click="remove(item.id)"
        >Remove</button>
      </li>
    </ul>

    <section v-if="matches !== null" class="mt-10" aria-label="Recipe matches" aria-live="polite">
      <h2 class="font-serif text-3xl">Cook with what you have</h2>
      <p class="mt-3 text-sm text-muted">Matches check quantities for the recipe’s original servings. Expired
        stock is excluded. Different measurement
        types need your review.</p>
      <p v-if="!matches.length" class="empty-state">Save a recipe to see matches here.</p>
      <article v-for="match in matches" :key="match.id" class="row-panel mt-4">
        <NuxtLink :to="'/recipes/' + match.id" class="text-action max-w-full truncate font-serif text-2xl">{{
          match.title
        }}</NuxtLink>
        <p class="mt-2 font-semibold">{{ match.completeness }}% in stock</p>
        <p class="mt-2">In stock: {{ match.in_stock.map(item => item.name).join(', ') || 'None' }}</p>
        <ul class="mt-2">
          <li v-for="(item, i) in match.missing" :key="i">Missing: {{ item.name }} · {{ item.reason }}</li>
        </ul>
      </article>
    </section>

    <details class="row-panel mt-10">
      <summary class="min-h-11 flex items-center whitespace-nowrap cursor-pointer font-serif text-2xl">Add
        from a
        receipt</summary>
      <p class="my-4 text-sm text-muted">Paste receipt text or text from your OCR app. Review every line and
        storage suggestion before saving.</p>
      <form @submit.prevent="parse">
        <label>Receipt text<textarea v-model="receipt" class="field" rows="5" required maxlength="30000" /></label>
        <button
          class="button-secondary mt-3"
          :disabled="busy"
          v-stable-action="state"
          :data-state="state"
          :aria-busy="busy"
        >{{ label('Parse receipt') }}</button>
      </form>
      <form
        v-if="drafts.length"
        class="mt-5 space-y-4"
        aria-label="Review receipt items"
        @submit.prevent="
          act(async () => {
            await save(drafts);
            drafts = [];
            receipt = '';
            message = 'Receipt items saved.';
          })
        "
      >
        <fieldset v-for="(draft, i) in drafts" :key="i" class="grid gap-3 border-t border-rule pt-4 sm:grid-cols-2">
          <legend>Item {{ i + 1 }}</legend>
          <label>Name<input v-model="draft.name" class="field" required maxlength="200" /></label>
          <label>Quantity<input v-model.number="draft.quantity" class="field" type="number" min="0.001" step="any" required
          /></label>
          <label>Unit<input v-model="draft.unit" class="field" required maxlength="40" /></label>
          <label>Storage location<select v-model="draft.storageLocation" class="field">
              <option v-for="place in storageLocations" :key="place">{{ place }}</option>
            </select></label>
          <button type="button" class="text-action justify-self-start" @click="drafts.splice(i, 1)">Discard
            item
            {{ i + 1 }}</button>
        </fieldset>
        <button
          class="button-primary"
          :disabled="busy"
          v-stable-action="state"
          :data-state="state"
          :aria-busy="busy"
        >{{ label('Save reviewed items') }}</button>
      </form>
    </details>
  </section>
</template>
<style scoped>
.keepsake-advice { border: 1px solid color-mix(in oklch, var(--color-terracotta) 30%, transparent); border-radius: .75rem; background: var(--color-paper-2); padding: 1.25rem 1.5rem; }
</style>
