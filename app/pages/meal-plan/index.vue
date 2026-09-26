<script setup lang="ts">
import type { Recipe } from '#shared/types/recipe'
import { conductorCourses, phaseLabels, type Bottleneck, type ConductorCourse, type TimelineEvent } from '#shared/culinary/conductor'
import type { SeasonInfo, SeasonStatus } from '#shared/culinary/seasonality'

type Serve = { course: ConductorCourse, recipeId: string, recipeTitle: string, offset: number, label: string, clock: string, dayOffset: number }
type Plan = {
  serves: Serve[], timeline: TimelineEvent[], bottlenecks: Bottleneck[], warnings: string[], month: number,
  seasonality: { course: ConductorCourse, recipeId: string, recipeTitle: string, items: (SeasonInfo & { ingredient: string, advice: string[] })[] }[]
}
useSeoMeta({ title: 'Dinner conductor — Heirloom' })
const { data: recipes, status, error: loadError, refresh } = await useFetch<Recipe[]>('/api/recipes')
// Month comes from the server render so the client hydrates the same value.
const month = useState('conductor-month', () => new Date().getMonth() + 1)
const monthNames = Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1).toLocaleString('en-GB', { month: 'long' }))
const courseLabels: Record<ConductorCourse, string> = { appetizer: 'Appetizer', main: 'Main', side: 'Side', dessert: 'Dessert', beverage: 'Beverage' }
const courseTag: Record<ConductorCourse, string> = { appetizer: 'bg-sage text-cream', main: 'bg-[#9c3f1f] text-cream', side: 'bg-amber-200 text-espresso', dessert: 'bg-espresso text-cream', beverage: 'bg-sky-200 text-espresso' }
const seasonBadge: Record<SeasonStatus, [string, string]> = {
  peak: ['Peak season', 'bg-sage text-cream'], in_season: ['In season', 'border border-sage text-espresso'],
  greenhouse: ['Greenhouse', 'bg-amber-100 text-espresso'], off_season: ['Off-season', 'bg-terracotta/15 text-[#9c3f1f]']
}
const target = ref('20:30'), guestCount = ref<number | ''>(''), burners = ref(4), ovens = ref(1)
const courses = ref<{ recipeId: string, course: ConductorCourse, serveAt: string }[]>([
  { recipeId: '', course: 'appetizer', serveAt: '' }, { recipeId: '', course: 'main', serveAt: '' }, { recipeId: '', course: 'dessert', serveAt: '' }
])
const plan = ref<Plan | null>(null), busy = ref(false), error = ref(''), done = ref<string[]>([])
const chosen = computed(() => courses.value.filter(row => row.recipeId))
const conflictSteps = computed(() => new Set(plan.value?.bottlenecks.flatMap(item => item.steps.map(step => step.id)) ?? []))
const rows = computed(() => plan.value ? [
  ...plan.value.serves.map(serve => ({ kind: 'serve' as const, key: 'serve-' + serve.recipeId + serve.course, start: serve.offset, serve })),
  ...plan.value.timeline.map(event => ({ kind: 'step' as const, key: event.id, start: event.start, event }))
].sort((a, b) => a.start - b.start || (a.kind === 'serve' ? -1 : 1)) : [])
const dayNote = (offset: number) => offset < 0 ? ' · day before' : offset > 0 ? ' · next day' : ''

async function conduct() {
  if (!chosen.value.length) { error.value = 'Choose at least one recipe.'; return }
  busy.value = true; error.value = ''
  try {
    plan.value = await $fetch<Plan>('/api/meal-plan/orchestrate', { method: 'POST', body: {
      courses: chosen.value.map(row => ({ recipeId: row.recipeId, course: row.course, ...(row.serveAt ? { serveAt: row.serveAt } : {}) })),
      targetServeTime: target.value, burners: burners.value, ovens: ovens.value, month: month.value, ...(guestCount.value ? { guestCount: guestCount.value } : {})
    } })
    done.value = []
  } catch (cause) {
    const failure = cause as { data?: { statusMessage?: string, data?: { issues?: { message: string }[] } } }
    error.value = failure.data?.data?.issues?.[0]?.message || failure.data?.statusMessage || 'Could not build the schedule. Try again.'
  } finally { busy.value = false }
}
</script>

<template>
  <section class="page-section">
    <p class="eyebrow">Everything on the table at once</p><h1 class="mt-3">Dinner conductor</h1>
    <p class="mt-4 max-w-2xl">Choose your courses and when guests sit down. Heirloom works backwards from each course, flags oven and burner clashes, and checks what is in season.</p>

    <p v-if="status === 'pending'" role="status" class="py-10">Opening your cookbook…</p>
    <div v-else-if="loadError" role="alert" class="notice mt-8"><p>We couldn’t load your recipes.</p><button class="button-secondary mt-4" @click="refresh()">Try again</button></div>
    <div v-else-if="!recipes?.length" class="empty-state mt-8"><h2>Add a recipe first.</h2><p class="mt-4">The conductor schedules recipes from your cookbook.</p><NuxtLink to="/recipes/new" class="button-primary mt-6">Write a recipe</NuxtLink></div>

    <form v-else class="mt-10 space-y-8" @submit.prevent="conduct">
      <fieldset :disabled="busy" class="space-y-4">
        <legend class="form-legend">The menu</legend>
        <div v-for="(row, index) in courses" :key="index" class="row-panel grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <label>Recipe<select v-model="row.recipeId" class="field mt-2" :aria-label="'Recipe for course ' + (index + 1)"><option value="">— Choose a recipe —</option><option v-for="recipe in recipes" :key="recipe.id" :value="recipe.id">{{ recipe.title }}</option></select></label>
          <label>Course<select v-model="row.course" class="field mt-2" :aria-label="'Course type ' + (index + 1)"><option v-for="value in conductorCourses" :key="value" :value="value">{{ courseLabels[value] }}</option></select></label>
          <label>Serve at (optional)<input v-model="row.serveAt" type="time" class="field mt-2" :aria-label="'Serving time for course ' + (index + 1)"></label>
          <button type="button" class="text-action" :disabled="courses.length === 1" :aria-label="'Remove course ' + (index + 1)" @click="courses.splice(index, 1)">Remove</button>
        </div>
        <button type="button" class="button-secondary" :disabled="courses.length >= 8" @click="courses.push({ recipeId: '', course: 'main', serveAt: '' })">+ Add course</button>
      </fieldset>
      <fieldset :disabled="busy" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <legend class="form-legend lg:col-span-5">The evening</legend>
        <label>Guests sit down<input v-model="target" type="time" required class="field mt-2"></label>
        <label>Guests (optional)<input v-model.number="guestCount" type="number" min="1" max="100" class="field mt-2"></label>
        <label>Burners<input v-model.number="burners" type="number" min="1" max="10" required class="field mt-2"></label>
        <label>Ovens<select v-model.number="ovens" class="field mt-2"><option :value="1">1</option><option :value="2">2</option></select></label>
        <label>Month<select v-model.number="month" class="field mt-2"><option v-for="(name, i) in monthNames" :key="name" :value="i + 1">{{ name }}</option></select></label>
      </fieldset>
      <p class="text-sm">Serving defaults: first course at the sit-down time, mains and sides 25 minutes later, dessert after 60 minutes. Steps run one after another within each recipe.</p>
      <button class="button-primary" :disabled="busy">{{ busy ? 'Conducting…' : 'Build the schedule' }}</button>
      <p v-if="error" role="alert" class="notice">{{ error }}</p>
    </form>

    <div v-if="plan" class="mt-14 space-y-10" aria-live="polite">
      <section v-if="plan.bottlenecks.length" aria-label="Equipment conflicts" class="space-y-4">
        <div v-for="item in plan.bottlenecks" :key="item.type + item.start" role="alert" class="notice">
          <p class="font-semibold">{{ item.type === 'oven_temperature' ? 'Oven clash' : 'Burner overload' }} · {{ item.clock }} ({{ item.label }})</p>
          <p class="mt-2">{{ item.message }}</p>
          <ul class="mt-3 list-disc space-y-1 pl-5"><li v-for="tip in item.resolutions" :key="tip">{{ tip }}</li></ul>
        </div>
      </section>
      <p v-else role="status" class="row-panel">No oven or burner clashes with {{ ovens }} oven{{ ovens > 1 ? 's' : '' }} and {{ burners }} burners.</p>
      <ul v-if="plan.warnings.length" class="space-y-2"><li v-for="warning in plan.warnings" :key="warning" class="notice">{{ warning }}</li></ul>

      <section aria-label="Backwards timeline">
        <div class="section-heading"><h2>The timeline</h2><p class="text-sm" role="status">{{ done.length }} of {{ plan.timeline.length }} steps done</p></div>
        <ol class="mt-6 border-l-2 border-espresso/20">
          <li v-for="row in rows" :key="row.key" class="relative ml-5 border-b border-espresso/10 py-4 last:border-b-0">
            <span class="absolute -left-[1.72rem] top-6 size-3 rounded-full" :class="row.kind === 'serve' ? 'bg-terracotta' : 'bg-espresso/40'" aria-hidden="true" />
            <template v-if="row.kind === 'serve'">
              <p class="font-serif text-2xl"><span class="tabular-nums">{{ row.serve.clock }}</span> · Serve {{ courseLabels[row.serve.course].toLowerCase() }}: {{ row.serve.recipeTitle }}</p>
              <p class="text-sm">{{ row.serve.label }}{{ dayNote(row.serve.dayOffset) }}</p>
            </template>
            <div v-else class="grid gap-3 sm:grid-cols-[7rem_minmax(0,1fr)]" :class="[done.includes(row.event.id) && 'opacity-60', conflictSteps.has(row.event.id) && 'rounded-md bg-terracotta/5 px-3 ring-1 ring-terracotta/50']">
              <p class="tabular-nums"><span class="font-semibold">{{ row.event.clock }}</span><br><span class="text-sm">{{ row.event.label }}{{ dayNote(row.event.dayOffset) }}</span></p>
              <div class="min-w-0">
                <p class="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                  <span class="rounded-full px-3 py-1" :class="courseTag[row.event.course]">{{ courseLabels[row.event.course] }}</span>
                  <span class="rounded-full border border-espresso/25 px-3 py-1">{{ phaseLabels[row.event.phase] }}</span>
                  <span v-if="row.event.oven" class="rounded-full border border-espresso/25 px-3 py-1">Oven{{ row.event.ovenTempC ? ' ' + row.event.ovenTempC + ' °C' : '' }}</span>
                  <span v-if="row.event.burners" class="rounded-full border border-espresso/25 px-3 py-1">{{ row.event.burners }} burner{{ row.event.burners > 1 ? 's' : '' }}</span>
                  <span class="normal-case tracking-normal">{{ row.event.duration }} min · {{ row.event.recipeTitle }}</span>
                </p>
                <label class="mt-2 flex items-start gap-3 break-words text-lg" :class="done.includes(row.event.id) && 'line-through'">
                  <input v-model="done" type="checkbox" :value="row.event.id" class="mt-1.5 shrink-0" :aria-label="'Done: ' + row.event.instruction">
                  <span>{{ row.event.instruction }}<span v-if="row.event.synthetic" class="text-sm no-underline"> (added by Heirloom)</span></span>
                </label>
              </div>
            </div>
          </li>
        </ol>
      </section>

      <section aria-label="Seasonality">
        <h2>What’s in season · {{ monthNames[plan.month - 1] }}</h2>
        <p class="mt-3 text-sm">Greek harvest calendar. Canned, dried, and preserved ingredients are never flagged.</p>
        <div v-for="course in plan.seasonality" :key="course.recipeId + course.course" class="row-panel mt-5">
          <p class="flex flex-wrap items-center gap-3"><span class="rounded-full px-3 py-1 text-xs font-semibold uppercase" :class="courseTag[course.course]">{{ courseLabels[course.course] }}</span><span class="font-serif text-xl">{{ course.recipeTitle }}</span></p>
          <p v-if="!course.items.length" class="mt-3 text-sm">No seasonal produce to check.</p>
          <ul class="mt-3 space-y-3">
            <li v-for="item in course.items" :key="item.ingredient" class="break-words">
              <span class="font-semibold">{{ item.ingredient }}</span>
              <span class="ml-2 inline-block rounded-full px-3 py-0.5 text-xs font-semibold" :class="seasonBadge[item.status][1]">{{ seasonBadge[item.status][0] }}</span>
              <details v-if="item.advice.length" class="mt-2"><summary class="cursor-pointer text-sm font-semibold underline underline-offset-4">Flavor fix</summary><ul class="mt-2 list-disc space-y-1 pl-5 text-sm"><li v-for="tip in item.advice" :key="tip">{{ tip }}</li></ul></details>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </section>
</template>
