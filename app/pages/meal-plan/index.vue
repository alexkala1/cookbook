<script setup lang="ts">
import type { Recipe } from '#shared/types/recipe'
import {

  conductorCourses,
  phaseLabels,
  type Bottleneck,
  type ConductorCourse,
  type TimelineEvent
} from '#shared/culinary/conductor'
import type { SeasonInfo, SeasonStatus } from '#shared/culinary/seasonality'
import type { DietaryAudit, Guest } from '#shared/culinary/dietary'
import { recommendPairingForMenu } from '#shared/culinary/beverage-pairings'
import { chefBriefing, dayPrefix, milestones } from '../../utils/chef-briefing'

type Serve = {
  course: ConductorCourse
  recipeId: string
  recipeTitle: string
  offset: number
  label: string
  clock: string
  dayOffset: number
}

type Plan = {
  serves: Serve[]
  timeline: TimelineEvent[]
  bottlenecks: Bottleneck[]
  warnings: string[]
  month: number
  seasonality: {
    course: ConductorCourse
    recipeId: string
    recipeTitle: string
    items: (SeasonInfo & { ingredient: string; advice: string[] })[]
  }[]
}

useSeoMeta({ title: 'Dinner conductor — Heirloom' })
const { data: recipes, status, error: loadError, refresh } = await useFetch<Recipe[]>('/api/recipes')
// Month comes from the server render so the client hydrates the same value.
const month = useState('conductor-month', () => new Date().getMonth() + 1)
const monthNames = Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1).toLocaleString('en-GB', { month: 'long' }))
const courseLabels: Record<ConductorCourse, string> = {
  appetizer: 'Appetizer',
  main: 'Main',
  side: 'Side',
  dessert: 'Dessert',
  beverage: 'Beverage'
}

const courseTag: Record<ConductorCourse, string> = {
  appetizer: 'bg-olive-ink text-paper',
  main: 'bg-terracotta-ink text-cream',
  side: 'bg-olive text-paper',
  dessert: 'bg-espresso text-cream',
  beverage: 'bg-paper-3 text-ink'
}

const seasonBadge: Record<SeasonStatus, [string, string]> = {
  peak: ['Peak season', 'bg-olive-ink text-paper'],
  in_season: ['In season', 'border border-sage text-espresso'],
  greenhouse: ['Greenhouse', 'bg-paper-3 text-ink border border-rule'],
  off_season: ['Off-season', 'bg-terracotta/15 text-terracotta-ink']
}

const { data: guests, error: guestError, refresh: refreshGuests } = await useFetch<Guest[]>('/api/guests')

// Single-task stepper: one decision per screen (guests → menu → plan); the plan unlocks once it is built.
const stages = [
  { title: 'Who is at the table?', short: 'Guests', icon: 'i-lucide-users' },
  { title: 'What are we cooking?', short: 'Menu', icon: 'i-lucide-utensils' },
  { title: 'The plan', short: 'Plan', icon: 'i-lucide-chef-hat' }
] as const
const stage = ref<1 | 2 | 3>(1)
const stageHeading = ref<HTMLElement>()
function goTo(next: 1 | 2 | 3) {
  if (next === 3 && !plan.value) return
  if (next === 2 && guestCount.value === '' && selectedGuests.value.length) guestCount.value = selectedGuests.value.length
  stage.value = next
}
watch(stage, () => nextTick(() => {
  stageHeading.value?.focus({ preventScroll: true })
  stageHeading.value?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}))

const selectedGuests = ref<string[]>([])
const tableGuests = computed(() => (guests.value ?? []).filter(guest => selectedGuests.value.includes(guest.id)))
const allergyTotal = computed(() => new Set(tableGuests.value.flatMap(guest => guest.allergies)).size)
function toggleGuest(id: string) {
  selectedGuests.value = selectedGuests.value.includes(id) ? selectedGuests.value.filter(value => value !== id) : [...selectedGuests.value, id]
}
const audit = ref<DietaryAudit | null | 'failed'>(null)

const target = ref('20:30')
const guestCount = ref<number | ''>('')
const burners = ref(4)
const ovens = ref(1)
const courses = ref<{ recipeId: string; course: ConductorCourse; serveAt: string }[]>([
  { recipeId: '', course: 'appetizer', serveAt: '' },
  { recipeId: '', course: 'main', serveAt: '' },
  { recipeId: '', course: 'dessert', serveAt: '' }
])
const plan = ref<Plan | null>(null)
const busy = ref(false)
const error = ref('')
const done = ref<string[]>([])
const { state, label } = useActionFeedback(busy, error)

watch(
  [target, guestCount, burners, ovens, month, courses, selectedGuests],
  () => {
    plan.value = null
    audit.value = null
    done.value = []
    error.value = ''
  },
  { deep: true }
)
// 1-click menus built from recipes already in the cookbook; dishes the cook hasn't saved are skipped and named.
const presets = [
  { id: 'sunday', label: 'Greek Sunday Feast', icon: 'i-lucide-sun', courses: [['appetizer', 'Traditional Spanakopita'], ['side', 'Santorini Fava'], ['main', 'Arni me Patates'], ['dessert', 'Revani with Citrus Syrup']] },
  { id: 'lenten', label: 'Lenten Table', icon: 'i-lucide-leaf', courses: [['appetizer', 'Santorini Fava'], ['main', 'Classic Fasolada']] }
] as const satisfies readonly { id: string, label: string, icon: string, courses: readonly (readonly [ConductorCourse, string])[] }[]
const findRecipe = (title: string) => recipes.value?.find(recipe => recipe.title.trim().toLowerCase() === title.toLowerCase())
const presetMatches = (preset: typeof presets[number]) => preset.courses.filter(([, title]) => findRecipe(title)).length
const presetNotice = ref('')
function applyPreset(preset: typeof presets[number]) {
  const found = preset.courses.flatMap(([course, title]) => { const recipe = findRecipe(title); return recipe ? [{ recipeId: recipe.id, course, serveAt: '' }] : [] })
  if (!found.length) return
  courses.value = found
  const missing = preset.courses.filter(([, title]) => !findRecipe(title)).map(([, title]) => title)
  presetNotice.value = `${preset.label}: ${found.length} course${found.length > 1 ? 's' : ''} filled.` + (missing.length ? ` Not in your cookbook yet: ${missing.join(', ')}.` : ' Adjust anything below.')
}
const chosen = computed(() => courses.value.filter(row => row.recipeId))
const conflictSteps = computed(
  () => new Set(plan.value?.bottlenecks.flatMap(item => item.steps.map(step => step.id)) ?? [])
)
const rows = computed(() =>
  plan.value
    ? [
        ...plan.value.serves.map(serve => ({
          kind: 'serve' as const,
          key: 'serve-' + serve.recipeId + serve.course,
          start: serve.offset,
          serve
        })),
        ...plan.value.timeline.map(event => ({ kind: 'step' as const, key: event.id, start: event.start, event }))
      ].sort((a, b) => a.start - b.start || (a.kind === 'serve' ? -1 : 1))
    : []
)
const menuPairings = computed(() => plan.value ? recommendPairingForMenu(plan.value.serves.filter(serve => serve.course !== 'beverage' && serve.course !== 'side').slice().sort((a, b) => a.offset - b.offset).map(serve => ({ title: serve.recipeTitle, course: serve.course }))) : [])
const briefing = computed(() => plan.value ? chefBriefing(plan.value, ovens.value, { names: tableGuests.value.map(guest => guest.name), audit: audit.value }) : [])
const keyTimes = computed(() => plan.value ? milestones(plan.value) : [])
const milestoneIcon = { start: 'i-lucide-play', oven: 'i-lucide-heater', serve: 'i-lucide-utensils' } as const
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const dayNote = (offset: number) =>
  offset < -1
    ? ` · ${-offset} days before`
    : offset === -1
      ? ' · day before'
      : offset > 1
        ? ` · ${offset} days later`
        : offset === 1
          ? ' · next day'
          : ''

// Shift dinner time (wrapping past midnight) and recalibrate every step offset and arrival time.
async function adjustTarget(deltaMinutes: number) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(target.value)
  if (!match || busy.value) return
  const total = ((Number(match[1]) * 60 + Number(match[2]) + deltaMinutes) % 1440 + 1440) % 1440
  target.value = String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0')
  await conduct()
}

async function conduct() {
  if (!chosen.value.length) {
    error.value = 'Choose at least one recipe.'
    return
  }

  busy.value = true
  error.value = ''
  plan.value = null
  done.value = []
  try {
    plan.value = await $fetch<Plan>('/api/meal-plan/orchestrate', {
      method: 'POST',
      body: {
        courses: chosen.value.map(row => ({
          recipeId: row.recipeId,
          course: row.course,
          ...(row.serveAt ? { serveAt: row.serveAt } : {})
        })),
        targetServeTime: target.value,
        burners: burners.value,
        ovens: ovens.value,
        month: month.value,
        ...(guestCount.value ? { guestCount: guestCount.value } : {})
      }
    })

    done.value = []
    // The allergen cross-check is advisory: a failure never blocks the schedule.
    audit.value = null
    if (selectedGuests.value.length) {
      try {
        audit.value = await $fetch<DietaryAudit>('/api/meal-plan/dietary-audit', {
          method: 'POST',
          body: { guestIds: selectedGuests.value.slice(0, 20), recipeIds: [...new Set(chosen.value.map(row => row.recipeId))].slice(0, 20) }
        })
      } catch { audit.value = 'failed' }
    }
    stage.value = 3
  } catch (cause) {
    const failure = cause as { data?: { statusMessage?: string; data?: { issues?: { message: string }[] } } }
    error.value =
      failure.data?.data?.issues?.[0]?.message ||
      failure.data?.statusMessage ||
      'Could not build the schedule. Try again.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="page-section">
    <h1 class="mt-3">Dinner conductor</h1>

    <p class="mt-4 max-w-2xl">Three short steps: who is coming, what you are cooking, then a plan that works
      backwards from the moment guests sit down.</p>

    <p v-if="status === 'pending'" role="status" class="py-10">Opening your cookbook…</p>

    <div v-else-if="loadError" role="alert" class="notice mt-8">
      <p>We couldn’t load your recipes.</p>
      <button class="button-secondary mt-4" @click="refresh()">Try again</button>
    </div>

    <div v-else-if="!recipes?.length" class="empty-state mt-8">
      <h2>Add a recipe first.</h2>
      <p class="mt-4">The conductor schedules recipes from your cookbook.</p>
      <NuxtLink to="/recipes/new" class="button-primary mt-6">Write a recipe</NuxtLink>
    </div>

    <template v-else>
    <nav aria-label="Dinner planning steps" class="mt-8">
      <ol class="grid grid-cols-3 gap-2">
        <li v-for="(item, i) in stages" :key="item.short">
          <button
            type="button"
            class="stepper-item"
            :class="{ 'is-current': stage === i + 1, 'is-done': stage > i + 1 }"
            :aria-current="stage === i + 1 ? 'step' : undefined"
            :disabled="busy || (i === 2 && !plan)"
            @click="goTo((i + 1) as 1 | 2 | 3)"
          >
            <span class="stepper-dot num" aria-hidden="true"><UIcon v-if="stage > i + 1" name="i-lucide-check" /><template v-else>{{ i + 1 }}</template></span>
            <span class="min-w-0"><span class="block text-xs font-semibold uppercase tracking-wide text-muted">Step {{ i + 1 }}</span><span class="hidden sm:inline">{{ item.title }}</span><span class="sm:hidden">{{ item.short }}</span></span>
          </button>
        </li>
      </ol>
      <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-3" aria-hidden="true"><div class="h-full rounded-full bg-terracotta transition-[width] duration-300 motion-reduce:transition-none" :style="{ width: (stage / 3) * 100 + '%' }" /></div>
    </nav>

    <section v-if="stage === 1" aria-labelledby="stage-guests" class="mt-8">
      <h2 id="stage-guests" ref="stageHeading" tabindex="-1" class="text-3xl">Who is at the table?</h2>
      <p class="mt-3 max-w-2xl text-muted">Tap everyone who is coming. Heirloom checks their allergies and diets against the menu when it builds the plan.</p>
      <div v-if="guestError" role="alert" class="notice mt-6"><p>Guest profiles are unavailable right now. You can still plan without dietary checks.</p><button type="button" class="button-secondary mt-4" @click="refreshGuests()">Try again</button></div>
      <div v-else-if="!guests?.length" class="row-panel mt-6">
        <p class="font-semibold">No guest profiles yet.</p>
        <p class="mt-2 text-muted">Save allergies and diets once, and every menu gets checked automatically.</p>
        <NuxtLink to="/guests" class="text-action mt-2">Add guests<UIcon name="i-lucide-arrow-right" class="ml-1.5" aria-hidden="true" /></NuxtLink>
      </div>
      <template v-else>
        <div class="mt-6 flex flex-wrap gap-2" role="group" aria-label="Guests at the table">
          <button v-for="guest in guests" :key="guest.id" type="button" class="filter-pill" :aria-pressed="selectedGuests.includes(guest.id)" @click="toggleGuest(guest.id)">
            <UIcon :name="selectedGuests.includes(guest.id) ? 'i-lucide-check' : 'i-lucide-user'" aria-hidden="true" />{{ guest.name }}<span v-if="guest.allergies.length" class="text-xs font-normal text-muted">· {{ guest.allergies.length }} allerg{{ guest.allergies.length === 1 ? 'y' : 'ies' }}</span>
          </button>
        </div>
        <p class="mt-3 text-sm" role="status">{{ tableGuests.length ? `${tableGuests.length} at the table · ${allergyTotal} allerg${allergyTotal === 1 ? 'y' : 'ies'} to respect` : 'Nobody selected yet · dietary checks will be skipped' }}</p>
        <ul v-if="tableGuests.length" class="mt-5 grid gap-4 sm:grid-cols-2" aria-label="Allergen review">
          <li v-for="guest in tableGuests" :key="guest.id" class="row-panel min-w-0 break-words">
            <p class="flex items-center gap-2 font-serif text-xl"><UIcon :name="guest.allergies.length ? 'i-lucide-shield-alert' : 'i-lucide-shield-check'" :class="guest.allergies.length ? 'text-terracotta-ink' : 'text-sage-ink'" aria-hidden="true" />{{ guest.name }}</p>
            <div class="mt-3 flex flex-wrap gap-2 text-sm">
              <span v-for="allergy in guest.allergies" :key="allergy" class="rounded-full border border-error/40 bg-error/10 px-3 py-1 font-semibold text-error">Allergy · {{ allergy }}</span>
              <span v-for="diet in guest.dietaryRestrictions" :key="diet" class="rounded-full border border-sage/50 bg-sage/10 px-3 py-1 font-semibold text-sage-ink">{{ diet }}</span>
              <span v-if="!guest.allergies.length && !guest.dietaryRestrictions.length" class="text-muted">No allergies or diets recorded</span>
            </div>
            <p v-if="guest.dislikes.length" class="mt-3 text-sm text-muted">Avoids {{ guest.dislikes.join(', ') }}</p>
          </li>
        </ul>
      </template>
      <div class="stepper-footer">
        <span />
        <button type="button" class="button-primary stepper-next" @click="goTo(2)">Next: What are we cooking?<UIcon name="i-lucide-arrow-right" aria-hidden="true" /></button>
      </div>
    </section>

    <template v-if="stage === 2">
    <h2 id="stage-menu" ref="stageHeading" tabindex="-1" class="mt-8 text-3xl">What are we cooking?</h2>
    <p class="mt-3 max-w-2xl text-muted">Pick a preset or choose each course, then tell Heirloom when guests sit down and what your kitchen has.</p>
    <section aria-labelledby="presets-heading" class="mt-6 rounded-xl border border-rule bg-paper-2/60 p-5">
      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="presets-heading" class="font-serif text-xl">Menu presets</h2>
        <p class="text-sm text-muted">One tap fills the menu from your cookbook.</p>
      </div>
      <div class="mt-4 flex flex-wrap gap-2" role="group" aria-label="Menu presets">
        <button v-for="preset in presets" :key="preset.id" type="button" class="filter-pill" :disabled="busy || !presetMatches(preset)" @click="applyPreset(preset)">
          <UIcon :name="preset.icon" aria-hidden="true" />{{ preset.label }}<span class="text-xs font-normal text-muted">{{ presetMatches(preset) }}/{{ preset.courses.length }}</span>
        </button>
      </div>
      <p v-if="presetNotice" role="status" class="mt-3 text-sm">{{ presetNotice }}</p>
    </section>
    <form class="mt-8 space-y-8" @submit.prevent="conduct">
      <fieldset :disabled="busy" class="space-y-4">
        <legend class="form-legend">The menu</legend>
        <div
          v-for="(row, index) in courses"
          :key="index"
          class="row-panel grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
        >
          <label>Recipe<select v-model="row.recipeId" class="field mt-2" :aria-label="'Recipe for course ' + (index + 1)">
              <option value="">— Choose a recipe —</option>
              <option v-for="recipe in recipes" :key="recipe.id" :value="recipe.id">{{ recipe.title }}</option>
            </select></label>
          <label>Course<select v-model="row.course" class="field mt-2" :aria-label="'Course type ' + (index + 1)">
              <option v-for="value in conductorCourses" :key="value" :value="value">{{ courseLabels[value] }}</option>
            </select></label>
          <label>Serve at (optional)<input
              v-model="row.serveAt"
              type="time"
              class="field mt-2"
              :aria-label="'Serving time for course ' + (index + 1)"
          /></label>
          <button
            type="button"
            class="text-action"
            :disabled="courses.length === 1"
            :aria-label="'Remove course ' + (index + 1)"
            @click="courses.splice(index, 1)"
          >Remove</button>
        </div>
        <button
          type="button"
          class="button-secondary"
          :disabled="courses.length >= 8"
          @click="courses.push({ recipeId: '', course: 'main', serveAt: '' })"
        >+ Add course</button>
      </fieldset>
      <fieldset :disabled="busy" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <legend class="form-legend lg:col-span-5">The evening</legend>
        <label>Guests sit down<input v-model="target" type="time" required class="field mt-2" /></label>
        <label>Guests (optional)<input v-model.number="guestCount" type="number" min="1" max="100" class="field mt-2"
        /></label>
        <label>Burners<input v-model.number="burners" type="number" min="1" max="10" required class="field mt-2"
        /></label>
        <label>Ovens<select v-model.number="ovens" class="field mt-2">
            <option :value="1">1</option>
            <option :value="2">2</option>
          </select></label>
        <label>Month<select v-model.number="month" class="field mt-2">
            <option v-for="(name, i) in monthNames" :key="name" :value="i + 1">{{ name }}</option>
          </select></label>
      </fieldset>
      <p class="text-sm">Serving defaults: first course at the sit-down time, mains and sides 25 minutes
        later, dessert after 60 minutes.
        Steps run one after another within each recipe.</p>
      <p v-if="error" role="alert" class="notice">{{ error }}</p>
      <div class="stepper-footer">
        <button type="button" class="button-secondary stepper-next" :disabled="busy" @click="goTo(1)"><UIcon name="i-lucide-arrow-left" aria-hidden="true" />Back: guests</button>
        <button
          class="button-primary stepper-next"
          :disabled="busy"
          v-stable-action="state"
          :data-state="state"
          :aria-busy="busy"
        >{{ label('Plan our dinner', 'Planning our dinner…') }}</button>
      </div>
    </form>
    </template>
    </template>

    <div v-if="plan && stage === 3" class="mt-8 space-y-10">
      <h2 id="stage-plan" ref="stageHeading" tabindex="-1" class="text-3xl">The plan</h2>
      <section aria-labelledby="briefing-title" class="briefing-card">
        <p class="meta-label font-semibold">Chef’s briefing</p>
        <h3 id="briefing-title" class="mt-1 font-serif text-3xl">Dinner at <span class="num">{{ plan.serves.slice().sort((a, b) => a.offset - b.offset)[0]?.clock ?? target }}</span></h3>
        <div class="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Adjust dinner time">
          <span class="mr-1 text-sm text-muted">Running late or early?</span>
          <button v-for="delta in [10, 15, -10]" :key="delta" type="button" class="filter-pill min-h-11" :disabled="busy" @click="adjustTarget(delta)">{{ delta > 0 ? '+' : '−' }}{{ Math.abs(delta) }} min</button>
        </div>
        <p v-if="error" role="alert" class="notice mt-3">{{ error }}</p>
        <p v-for="(line, i) in briefing" :key="i" class="mt-3 max-w-3xl text-lg leading-relaxed">{{ line }}</p>
        <div v-if="menuPairings.length" class="mt-6" data-testid="beverage-pairings">
          <h4 class="text-sm font-semibold uppercase tracking-wide text-muted">What to pour</h4>
          <ul class="mt-2 grid gap-2 sm:grid-cols-2">
            <li v-for="item in menuPairings" :key="item.title + item.course" class="rounded-xl border border-line p-3">
              <p class="text-sm text-muted">{{ item.course ? courseLabels[item.course as ConductorCourse] + ': ' : '' }}{{ item.title }}</p>
              <p class="font-serif text-lg">{{ item.pairing.beverage.name }} <span class="text-sm text-muted">· {{ item.pairing.beverage.greekName }}</span></p>
              <p class="text-sm">{{ item.pairing.beverage.region }} · serve at {{ item.pairing.beverage.servingTempC }} °C</p>
              <p class="text-sm text-muted">Non-alcoholic: {{ item.pairing.nonAlcoholic.name }}</p>
            </li>
          </ul>
        </div>
        <h4 class="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">Key times</h4>
        <ul class="mt-2 divide-y divide-espresso/10" aria-label="Key times">
          <li v-for="item in keyTimes" :key="item.key" class="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-3 py-2.5">
            <span class="num text-xl font-semibold" :class="item.kind === 'serve' && 'text-terracotta-ink'">{{ item.clock }}</span>
            <span class="flex min-w-0 items-start gap-2 break-words"><UIcon :name="milestoneIcon[item.kind]" class="mt-1 flex-none text-muted" aria-hidden="true" /><span :class="item.kind === 'serve' && 'font-semibold'">{{ capitalize(dayPrefix(item.dayOffset) + item.text) }}</span></span>
          </li>
        </ul>
      </section>
      <details v-if="plan.bottlenecks.length" aria-label="Kitchen timing and equipment advisory" class="advisory group rounded-xl border border-sage/40 bg-paper-2 p-5">
        <summary class="flex cursor-pointer select-none items-center justify-between gap-3 font-serif text-xl">
          <span class="flex min-w-0 items-center gap-3"><UIcon name="i-lucide-lightbulb" class="size-5 flex-none text-sage-ink" aria-hidden="true" /><span>Kitchen timing &amp; equipment advisory<span class="block font-sans text-sm font-normal text-muted">{{ plan.bottlenecks.length }} friendly {{ plan.bottlenecks.length === 1 ? 'tip' : 'tips' }} to keep things calm — tap to read</span></span></span>
          <UIcon name="i-lucide-chevron-down" class="size-5 flex-none transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
        </summary>
        <div class="mt-5 space-y-4">
        <article v-for="item in plan.bottlenecks" :key="item.type + item.start" class="overflow-hidden rounded-xl border border-sage/30 bg-paper">
          <header class="flex items-start gap-3 bg-sage/10 px-5 py-4">
            <span class="inline-flex size-10 flex-none items-center justify-center rounded-full bg-paper text-sage-ink" aria-hidden="true"><UIcon :name="item.type === 'oven_temperature' ? 'i-lucide-heater' : 'i-lucide-flame'" class="size-5" /></span>
            <div class="min-w-0">
              <p class="meta-label font-semibold">Good to know</p>
              <p class="font-semibold">{{ item.type === 'oven_temperature' ? 'Oven timing' : 'Burner timing' }} ·
                <span class="num">{{ item.clock }}</span> ({{ item.label }})</p>
            </div>
          </header>
          <div class="px-5 py-4">
            <p class="break-words">{{ item.message }}</p>
            <template v-if="item.resolutions.length">
              <p class="mt-4 text-sm font-semibold text-sage-ink">Workarounds</p>
              <ul class="mt-2 space-y-2">
                <li v-for="tip in item.resolutions" :key="tip" class="flex items-start gap-2 break-words"><UIcon name="i-lucide-circle-check" class="mt-1 flex-none text-sage-ink" aria-hidden="true" /><span>{{ tip }}</span></li>
              </ul>
            </template>
          </div>
        </article>
        </div>
      </details>
      <p v-else role="status" class="row-panel">No oven or burner clashes with {{ ovens }}
        oven{{ ovens > 1 ? 's' : '' }} and {{ burners }} burners.</p>
      <ul v-if="plan.warnings.length" class="space-y-2">
        <li v-for="warning in plan.warnings" :key="warning" class="notice">{{ warning }}</li>
      </ul>

      <section aria-label="Backwards timeline">
        <div class="section-heading">
          <h2>The timeline</h2>
          <p class="text-sm" role="status">{{ done.length }} of {{ plan.timeline.length }} steps done</p>
        </div>
        <ol class="mt-6 border-l-2 border-espresso/20">
          <li v-for="row in rows" :key="row.key" class="relative ml-5 border-b border-espresso/10 py-4 last:border-b-0">
            <span
              class="absolute -left-[1.72rem] top-6 size-3 rounded-full"
              :class="row.kind === 'serve' ? 'bg-terracotta' : 'bg-espresso/40'"
              aria-hidden="true"
            />
            <template v-if="row.kind === 'serve'">
              <p class="font-serif text-2xl">
                <span class="num">{{ row.serve.clock }}</span> · Serve
                {{ courseLabels[row.serve.course].toLowerCase() }}: {{ row.serve.recipeTitle }}</p>
              <p class="text-sm">{{ row.serve.label }}{{ dayNote(row.serve.dayOffset) }}</p>
            </template>
            <div
              v-else
              class="grid gap-3 sm:grid-cols-[7rem_minmax(0,1fr)]"
              :class="[
                done.includes(row.event.id) && 'opacity-60',
                conflictSteps.has(row.event.id) && 'rounded-md bg-terracotta/5 px-3 ring-1 ring-terracotta/50'
              ]"
            >
              <p class="num">
                <span class="font-semibold">{{ row.event.clock }}</span>
                <br /><span class="text-sm">{{ row.event.label }}{{ dayNote(row.event.dayOffset) }}</span>
              </p>
              <div class="min-w-0">
                <p class="flex flex-wrap items-center gap-2 meta-label font-semibold">
                  <span class="rounded-full px-3 py-1" :class="courseTag[row.event.course]">{{
                    courseLabels[row.event.course]
                  }}</span>
                  <span class="rounded-full border border-espresso/25 px-3 py-1">{{
                    phaseLabels[row.event.phase]
                  }}</span>
                  <span
                    v-if="row.event.oven"
                    class="rounded-full border border-espresso/25 px-3 py-1"
                  >Oven{{ row.event.ovenTempC ? ' ' + row.event.ovenTempC + ' °C' : '' }}</span>
                  <span v-if="row.event.burners" class="rounded-full border border-espresso/25 px-3 py-1">{{ row.event.burners }}
                    burner{{ row.event.burners > 1 ? 's' : '' }}</span>
                  <span class="normal-case tracking-normal">{{ row.event.duration }} min ·
                    {{ row.event.recipeTitle }}</span>
                </p>
                <label
                  class="mt-2 flex items-start gap-3 break-words text-lg"
                  :class="done.includes(row.event.id) && 'line-through'"
                >
                  <input
                    v-model="done"
                    type="checkbox"
                    :value="row.event.id"
                    class="mt-1.5 shrink-0"
                    :aria-label="'Done: ' + row.event.instruction"
                  />
                  <span>{{ row.event.instruction }}<span v-if="row.event.synthetic" class="text-sm no-underline"> (added by Heirloom)</span></span>
                </label>
              </div>
            </div>
          </li>
        </ol>
      </section>

      <MarketShoppingList :courses="chosen" :servings="guestCount || undefined" />

      <section aria-label="Seasonality">
        <h2>What’s in season · {{ monthNames[plan.month - 1] }}</h2>
        <p class="mt-3 text-sm">Greek harvest calendar. Canned, dried, and preserved ingredients are never flagged.</p>
        <div v-for="course in plan.seasonality" :key="course.recipeId + course.course" class="row-panel mt-5">
          <p class="flex flex-wrap items-center gap-3">
            <span class="rounded-full px-3 py-1 meta-label font-semibold" :class="courseTag[course.course]">{{
              courseLabels[course.course]
            }}</span>
            <span class="font-serif text-xl">{{ course.recipeTitle }}</span>
          </p>
          <p v-if="!course.items.length" class="mt-3 text-sm">No seasonal produce to check.</p>
          <ul class="mt-3 space-y-3">
            <li v-for="item in course.items" :key="item.ingredient" class="break-words">
              <span class="font-semibold">{{ item.ingredient }}</span>
              <span
                class="ml-2 inline-block rounded-full px-3 py-0.5 text-xs font-semibold"
                :class="seasonBadge[item.status][1]"
                >{{ seasonBadge[item.status][0] }}</span>
              <details v-if="item.advice.length" class="mt-2">
                <summary
                  class="min-h-11 flex items-center whitespace-nowrap cursor-pointer text-sm font-semibold underline underline-offset-4"
                >Flavor fix</summary>
                <ul class="mt-2 list-disc space-y-1 pl-5 text-sm">
                  <li v-for="tip in item.advice" :key="tip">{{ tip }}</li>
                </ul>
              </details>
            </li>
          </ul>
        </div>
      </section>
      <div class="stepper-footer">
        <button type="button" class="button-secondary stepper-next" @click="goTo(2)"><UIcon name="i-lucide-arrow-left" aria-hidden="true" />Back: edit the menu</button>
        <button type="button" class="button-secondary stepper-next" @click="goTo(1)"><UIcon name="i-lucide-users" aria-hidden="true" />Change guests</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.stepper-item { display: flex; width: 100%; min-height: 56px; align-items: center; gap: .625rem; border: 1px solid var(--color-rule); border-radius: .875rem; background: var(--color-paper); padding: .5rem .75rem; text-align: left; font-weight: 600; }
.stepper-item.is-current { border-color: var(--color-ink); box-shadow: inset 0 0 0 1px var(--color-ink); }
.stepper-item:disabled { opacity: .5; cursor: not-allowed; }
.stepper-item:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
@media (hover: hover) { .stepper-item:not(:disabled):hover { background: var(--color-paper-2); } }
.stepper-dot { display: inline-flex; width: 2rem; height: 2rem; flex: none; align-items: center; justify-content: center; border-radius: 999px; background: var(--color-paper-3); color: var(--color-ink); }
.is-current .stepper-dot { background: var(--color-ink); color: var(--color-paper); }
.is-done .stepper-dot { background: var(--color-sage-ink); color: var(--color-paper); }
.stepper-footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .75rem; margin-top: 2rem; border-top: 1px solid var(--color-rule); padding-top: 1.25rem; }
/* Fitts: the step-to-step controls are the page's primary actions; make them large and easy to hit. */
.stepper-next { min-height: 56px; padding-inline: 1.5rem; font-size: 1.0625rem; }
@media (max-width: 40rem) { .stepper-next { flex: 1 1 100%; } }
.briefing-card { border: 2px solid color-mix(in oklch, var(--color-terracotta) 45%, transparent); border-radius: 1.25rem; background: linear-gradient(160deg, var(--color-paper-2), color-mix(in oklch, var(--color-terracotta) 8%, var(--color-paper))); padding: clamp(1.25rem, 3vw, 2rem); }
</style>
