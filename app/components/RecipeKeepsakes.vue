<script setup lang="ts">
import type { RecipeMemory } from '#shared/types/memory'

const props = defineProps<{ recipeId: string }>()
const {
  data: memories,
  error: loadError,
  refresh
} = await useFetch<RecipeMemory[]>('/api/recipes/' + props.recipeId + '/memories')

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const cookDate = ref(localToday())
const rating = ref('')
const notes = ref('')
const familyMemories = ref('')
const busy = ref(false)
const error = ref('')
const saved = ref(false)
const { state, label } = useActionFeedback(busy, error)
let savedTimer: ReturnType<typeof setTimeout> | undefined

watch(saved, value => {
  clearTimeout(savedTimer)
  if (value)
    savedTimer = setTimeout(() => {
      saved.value = false
    }, 2000)
})

onBeforeUnmount(() => clearTimeout(savedTimer))

function date(value: number) {
  return new Date(value).toLocaleDateString('en-GB')
}

async function save() {
  busy.value = true
  error.value = ''
  saved.value = false
  try {
    await $fetch('/api/recipes/' + props.recipeId + '/memories', {
      method: 'POST',
      body: {
        cookDate: new Date(cookDate.value + 'T12:00:00').getTime(),
        rating: rating.value ? Number(rating.value) : null,
        notes: notes.value,
        familyMemories: familyMemories.value
      }
    })

    notes.value = ''
    familyMemories.value = ''
    rating.value = ''
    await refresh()
    saved.value = true
  } catch {
    error.value = 'Could not save this keepsake. Your entry is still here; try again.'
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <section class="border-t-2 border-terracotta py-8" aria-label="Recipe keepsakes">
    <h2 class="mt-3">Tasting notes & family keepsakes</h2>

    <form class="row-panel my-6 grid gap-4 sm:grid-cols-2" aria-label="Save a keepsake" @submit.prevent="save">
      <label>Cook date<input v-model="cookDate" type="date" class="field" required /></label>
      <label>Rating<select v-model="rating" class="field">
          <option value="">Not rated</option>
          <option v-for="number in 5" :key="number" :value="String(number)">{{ number }} / 5</option>
        </select></label>
      <label class="sm:col-span-2">Tasting
        notes<textarea v-model="notes" class="field" rows="3" maxlength="10000" /></label>
      <label class="sm:col-span-2">Family memory<textarea
          v-model="familyMemories"
          class="field"
          rows="3"
          maxlength="10000"
          placeholder="Cooked for Yiayia’s 80th birthday"
        /></label>
      <button
        class="button-primary justify-self-start"
        :disabled="busy"
        v-stable-action="state"
        :data-state="state"
        :aria-busy="busy"
      >{{ label('Save keepsake', 'Saving…') }}</button>
    </form>

    <p v-if="error" role="alert" class="notice">{{ error }}</p>

    <p v-if="saved" role="status" class="notice">Keepsake saved.</p>

    <p v-if="loadError" role="alert" class="notice">Keepsakes unavailable.
      <button class="text-action" @click="refresh()">Retry
      keepsakes</button>
    </p>

    <p v-else-if="!memories?.length" class="text-muted">Your first memory starts here.</p>

    <article v-for="memory in memories" :key="memory.id" class="row-panel mt-4 break-words">
      <h3 class="font-serif text-2xl">{{ date(memory.cookDate) }} <span v-if="memory.rating">·
        {{ memory.rating }} / 5</span>
      </h3>
      <p v-if="memory.notes" class="mt-3 whitespace-pre-line">{{ memory.notes }}</p>
      <p v-if="memory.familyMemories" class="mt-4 whitespace-pre-line italic">{{ memory.familyMemories }}</p>
    </article>
  </section>
</template>
