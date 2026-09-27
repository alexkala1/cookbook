<script setup lang="ts">
import { storageLocations, type PantryItem, type PantryDraft, type PantryMatch } from '#shared/culinary/pantry'

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
const form = reactive<PantryDraft>({ name: '', quantity: 1, unit: 'item', storageLocation: 'pantry' })
const expiry = ref('')
const drafts = ref<PantryDraft[]>([])
const matches = ref<PantryMatch[] | null>(null)

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
      <div class="flex flex-wrap gap-2" aria-label="Filter by storage">
        <button
          v-for="place in ['all', 'fridge', 'freezer', 'pantry']"
          :key="place"
          class="filter-pill capitalize"
          :aria-pressed="location === place"
          @click="location = place"
        >{{ place }}</button>
      </div>
      <button
        class="button-primary"
        :disabled="busy"
        v-stable-action="state"
        :data-state="state"
        :aria-busy="busy"
        @click="findRecipes"
      >{{ label('Cook With What I Have') }}</button>
    </div>

    <p v-if="!visible.length" class="empty-state mt-6">Nothing here yet. Add an ingredient above.</p>

    <ul class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Pantry inventory">
      <li v-for="item in visible" :key="item.id" class="row-panel min-w-0 break-words">
        <p class="meta-label">{{ item.storageLocation }}</p>
        <h2 class="mt-2 font-serif text-2xl">{{ item.name }}</h2>
        <p>{{ Number(item.quantity.toFixed(3)) }} {{ item.unit }}</p>
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
