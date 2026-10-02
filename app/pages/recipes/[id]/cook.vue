<script setup lang="ts">
import { useEventListener, useIntersectionObserver, useWakeLock, useSwipe } from '@vueuse/core'
import type { KitchenProfile, RecipeDetail } from '#shared/types/recipe'
import { burnerAdvice, convertOven, ovenTemperature, type Oven } from '#shared/culinary/heat'
import { parseDurations, timerLabel, QUICK_TIMER_PRESETS, formatTimerHeading } from '../../../utils/timers'
import { parseServings } from '../../../utils/display-units'
import { scaleIngredients } from '../../../utils/units'
import type { CookingTimer } from '../../../utils/timers'
import { swipeIntent } from '../../../utils/swipe'
import { isPlaceholderIngredients, parseStructuredRecipe, splitNotesUpdate, stepCountPhrase } from '#shared/culinary/structured-recipe'

definePageMeta({ layout: 'kitchen' })
const route = useRoute()
const id = String(route.params.id)
const [{ data: recipe, error, refresh }, { data: kitchen }] = await Promise.all([
  useFetch<RecipeDetail>('/api/recipes/' + id),
  useFetch<KitchenProfile>('/api/settings/kitchen')
])
const index = ref(0)
// Guests whose allergies meet this recipe's ingredients: shown before anyone picks up a knife.
type Safety = { allergens: string[], conflicts: { guestId: string, guestName: string, allergen: string, ingredient: string }[] }
const { data: safety } = await useFetch<Safety>('/api/recipes/' + id + '/safety')
// Servings arrive from the recipe page (?servings=) and can be tweaked in prep; everything below scales from the saved recipe.
const router = useRouter()
const servings = ref<number>(parseServings(route.query.servings) ?? recipe.value?.servings ?? 4)
const servingsScaled = computed(() => servings.value !== recipe.value?.servings)
const servingPresets = computed(() => [0.5, 1, 2, 3].map(factor => ({ label: factor === 0.5 ? '½×' : factor + '×', value: Number(((recipe.value?.servings ?? 4) * factor).toFixed(2)) })))
function setServings(value: number) {
  servings.value = Math.min(1000, Math.max(0.5, value))
  void router.replace({ query: { ...route.query, servings: servings.value === recipe.value?.servings ? undefined : servings.value } })
}
const scaledIngredients = computed(() => {
  const current = recipe.value
  if (!current) return []
  const rows = servingsScaled.value ? scaleIngredients(current.ingredients, servings.value, current.servings) : current.ingredients
  return rows.map(row => ({ ...row, amount: Number(row.amount.toPrecision(4)) }))
})
const rescueOpen = ref(false)
const mounted = ref(false)
const steps = computed(() => [...(recipe.value?.steps || [])].sort((a, b) => a.stepNumber - b.stepNumber))
const step = computed(() => steps.value[index.value])
const { timers, activeTimers, alerts, sound, persistence, start, startPreset, startCustom, toggle, reset, remove, restore, enableSound } = useCookingTimers(id)

// Quick presets and a custom timer sit beside the step's own timers.
const TIMER_LIMIT = 20
const customName = ref('')
const customMinutes = ref(5)
const customValid = computed(() => Number.isFinite(customMinutes.value) && customMinutes.value >= 0.5 && customMinutes.value <= 180)
function bumpCustom(minutes: number) { customMinutes.value = Math.min(180, Math.max(0, (Number.isFinite(customMinutes.value) ? customMinutes.value : 0) + minutes)) }
function addCustom() {
  if (!customValid.value || timers.value.length + removed.value.length >= TIMER_LIMIT) return
  startCustom(customName.value.trim() || 'Custom timer', customMinutes.value)
  customName.value = ''
}
// A floating summary of the nearest timer while the timers panel is off screen.
const timersSection = ref<HTMLElement>()
const timersInView = ref(false)
useIntersectionObserver(timersSection, ([entry]) => { timersInView.value = entry?.isIntersecting ?? false })
const nearestTimer = computed(() => {
  const running = activeTimers.value.filter(timer => timer.state === 'running')
  return [...(running.length ? running : activeTimers.value)].sort((a, b) => a.remaining - b.remaining)[0]
})
const showTimersHud = computed(() => !!nearestTimer.value && !timersInView.value && !alerts.value.length)
function scrollToTimers() {
  const section = timersSection.value
  if (!section) return
  section.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  section.focus({ preventScroll: true })
}

// One saved step but a numbered method in the notes (typical of an offline video import): offer to split it.
const notesPlan = computed(() => recipe.value && recipe.value.steps.length <= 1 ? parseStructuredRecipe(recipe.value.heirloomNotes, recipe.value.servings) : null)
const splitting = ref(false)
const splitError = ref('')
const { state: splitState, label: splitLabel } = useActionFeedback(splitting, splitError)

async function splitIntoSteps() {
  if (!recipe.value || !notesPlan.value || splitting.value) return
  splitting.value = true
  splitError.value = ''
  try {
    recipe.value = await $fetch<RecipeDetail>('/api/recipes/' + id, { method: 'PUT', body: splitNotesUpdate(recipe.value, notesPlan.value) })
    index.value = 0
  } catch {
    splitError.value = 'Could not split the notes into steps. Nothing was changed; try again.'
  } finally {
    splitting.value = false
  }
}

useHead({ meta: [{ name: 'theme-color', content: '#0d0a09' }] })
const stepArticle = ref<HTMLElement>()
const stepHeading = ref<HTMLElement>()
const alertBanner = ref<HTMLElement>()
let ignoreSwipe = false
const { lengthX, lengthY } = useSwipe(stepArticle, {
  threshold: 60,
  onSwipeStart(event) {
    ignoreSwipe = rescueOpen.value || !!(event.target as HTMLElement)?.closest('input, button, a, select, textarea')
  },
  onSwipeEnd(event) {
    const intent = swipeIntent(-lengthX.value, -lengthY.value)
    if (event.type !== 'touchcancel' && intent && !ignoreSwipe && !rescueOpen.value) navigate(intent)
  }
})

useSwipe(alertBanner, {
  threshold: 60,
  onSwipeEnd(event, direction) {
    if (event.type !== 'touchcancel' && direction === 'down') alerts.value = []
  }
})

const removed = ref<{ timer: CookingTimer; height: number }[]>([])
const undoTimeouts = new Map<number, ReturnType<typeof setTimeout>>()
const timerSlots = computed(() =>
  [
    ...timers.value.map(timer => ({ timer, removed: false, height: 0 })),
    ...removed.value.map(row => ({ ...row, removed: true }))
  ].sort((a, b) => a.timer.id - b.timer.id)
)

function removeWithUndo(timer: CookingTimer, event: MouseEvent) {
  const height = (event.currentTarget as HTMLElement).closest('.timer-card')?.getBoundingClientRect().height || 250
  removed.value.push({ timer: { ...timer }, height })
  remove(timer)
  undoTimeouts.set(
    timer.id,
    setTimeout(() => {
      removed.value = removed.value.filter(row => row.timer.id !== timer.id)
      undoTimeouts.delete(timer.id)
    }, 5000)
  )
}

function undo(timer: CookingTimer) {
  restore(timer)
  clearTimeout(undoTimeouts.get(timer.id))
  undoTimeouts.delete(timer.id)
  removed.value = removed.value.filter(row => row.timer.id !== timer.id)
}

const running = computed(() =>
  [...timers.value, ...removed.value.map(row => row.timer)].some(timer => timer.state === 'running')
)
const confirmExit = () => !running.value || window.confirm('Timers are still running. Leave Kitchen Mode?')

onBeforeRouteLeave(confirmExit)
onBeforeRouteUpdate(confirmExit)
useEventListener('beforeunload', (event: BeforeUnloadEvent) => {
  if (running.value) {
    event.preventDefault()
    event.returnValue = ''
  }
})

onBeforeUnmount(() => {
  for (const timeout of undoTimeouts.values()) clearTimeout(timeout)
})

function navigate(direction: 'next' | 'previous') {
  if (prep.value && steps.value.length) {
    if (direction === 'next') startCooking()
    return
  }
  wakeOnGesture()
  stopSpeech()
  if (!rescueOpen.value) {
    index.value = Math.max(0, Math.min(steps.value.length - 1, index.value + (direction === 'next' ? 1 : -1)))
    void nextTick(() => stepHeading.value?.focus({ preventScroll: true }))
  }
}

const {
  video,
  active: cameraActive,
  pending: cameraPending,
  message: cameraMessage,
  motion,
  start: startCamera,
  stop: stopCamera
} = useAirSwipe(navigate)
const { isSpeaking, isSupported: speechSupported, currentNarrative, toggle: toggleSpeech, stop: stopSpeech } = useKitchenSpeech()
const { isSupported, isActive: wakeRequested, sentinel, request: requestWake, release } = useWakeLock()
const wakeReleased = ref(false)

watch(sentinel, value => {
  wakeReleased.value = value?.released ?? true
})

useEventListener(sentinel, 'release', () => {
  wakeReleased.value = true
})

const isActive = computed(() => wakeRequested.value && !wakeReleased.value)
const wakeError = ref('')
const wakeBusy = ref(false)
let disposed = false

async function keepAwake() {
  if (wakeBusy.value) return
  wakeBusy.value = true
  wakeError.value = ''
  try {
    await requestWake('screen')
    if (disposed) await release()
  } catch {
    wakeError.value = 'Wake lock unavailable. Check your device’s screen timeout.'
  } finally {
    wakeBusy.value = false
  }
}

// Browsers grant a screen wake lock most reliably from a user gesture, so retry on the first tap or step change.
// A cook who chose "Allow screen sleep" is never overridden.
let wakeOptedOut = false
function wakeOnGesture() {
  if (isSupported.value && !isActive.value && !wakeOptedOut) void keepAwake()
}
function toggleWake() {
  if (isActive.value) { wakeOptedOut = true; void release().catch(() => {}) } else { wakeOptedOut = false; void keepAwake() }
}

// Offer to use up the pantry stock this recipe called for once the cook says they're done.
const finishDialog = ref<HTMLDialogElement>()
const finishState = ref<'ask' | 'busy' | 'done'>('ask')
const finishError = ref('')
const deducted = ref<{ name: string, amount: string }[]>([])
let finishId = ''
function finishCooking() {
  stopSpeech()
  if (!finishId) finishId = crypto.randomUUID()
  if (!finishDialog.value?.open) finishDialog.value?.showModal()
}
// Journal entry for this cook: an optional star rating and note, saved once even if the pantry step needs a retry.
const rating = ref(0)
const journalNote = ref('')
let journalSaved = false
async function saveJournal() {
  if (journalSaved) return
  await $fetch('/api/recipes/' + id + '/cook-log', { method: 'POST', body: {
    requestId: finishId,
    servings: Math.max(1, Math.round(servings.value)),
    ...(rating.value ? { rating: rating.value } : {}),
    ...(journalNote.value.trim() ? { notes: journalNote.value.trim() } : {})
  } })
  journalSaved = true
}
async function finishWith(updatePantry: boolean) {
  if (finishState.value !== 'ask') return
  finishState.value = 'busy'; finishError.value = ''
  try {
    await saveJournal()
  } catch { finishError.value = 'We couldn’t save your journal entry. Try again.'; finishState.value = 'ask'; return }
  if (!updatePantry) { finishState.value = 'done'; leaveKitchen(); return }
  try {
    deducted.value = (await $fetch<{ deducted: { name: string, amount: string }[] }>('/api/pantry/deduct', { method: 'POST', body: { recipeId: id, requestId: finishId, ...(servingsScaled.value ? { servings: servings.value } : {}) } })).deducted
    finishState.value = 'done'
  } catch { finishError.value = 'Your journal entry is saved, but we couldn’t update your pantry. Try again, or skip for now.'; finishState.value = 'ask' }
}
function leaveKitchen() { try { sessionStorage.removeItem(prepKey) } catch { /* Nothing stored to clear. */ } finishDialog.value?.close(); void navigateTo('/recipes/' + id) }

const fromOven = ref<Oven>('static_conventional')
const toOven = ref<Oven>(kitchen.value?.ovenType || 'static_conventional')
const strategy = ref<'temperature' | 'time'>('temperature')
const ovenTimerIndex = ref(-1)

watch(step, () => {
  ovenTimerIndex.value = -1
})

watch(
  step,
  value => {
    fromOven.value = /fan|convection/i.test(value?.instruction || '') ? 'convection_fan' : 'static_conventional'
  },
  { immediate: true }
)
const ovenStep = (text: string) => /oven|bake|roast|preheat|φουρν|ψησ|ψην|προθερμ/i.test(text.normalize('NFD').replace(/\p{M}/gu, ''))
// Mise en place comes first: gather and prep everything, and get the oven heating, before step 1. Skippable, and remembered per recipe for this tab.
const prepKey = 'heirloom-prep-done-' + id
const prep = ref(true)
const prepped = ref<string[]>([])
const prepHeading = ref<HTMLElement>()
const preheat = computed(() => {
  for (const item of steps.value) {
    const reading = ovenStep(item.instruction) ? ovenTemperature(item.instruction) : null
    if (reading) return { step: item.stepNumber, ...reading }
  }
  return null
})
const prepIngredients = computed(() => scaledIngredients.value.map(row => ({
  id: row.id, name: row.name, notes: row.notes,
  measure: row.amount > 0 ? [Number(row.amount.toFixed(2)), row.unit].filter(Boolean).join(' ') : ''
})))
function startCooking() {
  prep.value = false
  try { sessionStorage.setItem(prepKey, '1') } catch { /* Prep just shows again next visit. */ }
  wakeOnGesture()
  void nextTick(() => stepHeading.value?.focus({ preventScroll: true }))
}
function backToPrep() {
  stopSpeech()
  prep.value = true
  try { sessionStorage.removeItem(prepKey) } catch { /* Nothing stored to clear. */ }
  void nextTick(() => prepHeading.value?.focus({ preventScroll: true }))
}
const temperature = computed(() => ovenStep(step.value?.instruction || '') ? ovenTemperature(step.value!.instruction) : null)
const rawDurations = computed(() => {
  const parsed = parseDurations(step.value?.instruction || '')
  return parsed.length ? parsed : step.value?.durationMinutes ? [step.value.durationMinutes * 60] : []
})

const selectedOvenTimer = computed(() => (rawDurations.value.length === 1 ? 0 : ovenTimerIndex.value))
const converted = computed(() =>
  temperature.value
    ? convertOven(
        temperature.value.temperature,
        (rawDurations.value[selectedOvenTimer.value] || 0) / 60,
        fromOven.value,
        toOven.value,
        temperature.value.unit,
        strategy.value
      )
    : null
)
const durations = computed(() =>
  rawDurations.value.map((seconds, number) =>
    temperature.value && strategy.value === 'time' && number === selectedOvenTimer.value
      ? Math.round(
          convertOven(
            temperature.value.temperature,
            seconds / 60,
            fromOven.value,
            toOven.value,
            temperature.value.unit,
            'time'
          ).minutes * 60
        )
      : seconds
  )
)
const matchedIngredients = computed(() => {
  const words = (value: string) =>
    value
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .match(/[\p{L}]+/gu) || []
  const instruction = new Set(words(step.value?.instruction || ''))
  return (
    scaledIngredients.value.filter(row =>
      words(row.name).some(
        word => word.length > 2 && !['fresh', 'dried', 'ground', 'finely'].includes(word) && instruction.has(word)
      )
    ) || []
  )
})

// Kitchen HUD: the oven's current set point (this step's adjusted value, else the last one set) and the live timers.
const ovenState = computed(() => {
  if (temperature.value && converted.value) return `${converted.value.temperature} °${temperature.value.unit}`
  for (let i = index.value - 1; i >= 0; i--) {
    const text = steps.value[i]?.instruction ?? ''
    const set = ovenStep(text) ? ovenTemperature(text) : null
    if (set) return `${set.temperature} °${set.unit}`
  }
  return null
})
const liveTimers = computed(() => timers.value.filter(timer => timer.state !== 'idle').sort((a, b) => a.remaining - b.remaining))

function startStepTimer(seconds: number, number: number) {
  const name = `Step ${index.value + 1}${durations.value.length > 1 ? ' · timer ' + (number + 1) : ''}`
  if (timers.value.some(timer => timer.name === name && (timer.state === 'running' || timer.state === 'paused'))) return
  start(name, seconds)
}

function keyboard(event: KeyboardEvent) {
  if (
    rescueOpen.value ||
    event.repeat ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    (event.target as HTMLElement)?.closest('input, textarea, select, [contenteditable]')
  )
    return
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    navigate(event.key === 'ArrowLeft' ? 'previous' : 'next')
  }

  if (event.code === 'Space' && !(event.target as HTMLElement)?.closest('button, a')) {
    event.preventDefault()
    navigate('next')
  }
}

function opened(value: boolean) {
  rescueOpen.value = value
  if (value) stopCamera()
}

onMounted(() => {
  mounted.value = true
  try { if (sessionStorage.getItem(prepKey) === '1') prep.value = false } catch { /* Storage blocked: start with prep. */ }
  document.addEventListener('keydown', keyboard)
  // On click, not pointerdown: the header can change size when the lock is granted, and that must not move a control mid-tap.
  document.addEventListener('click', wakeOnGesture, true)
  if (isSupported.value) void keepAwake()
})

onBeforeUnmount(() => {
  disposed = true
  document.removeEventListener('keydown', keyboard)
  document.removeEventListener('click', wakeOnGesture, true)
  void release().catch(() => {})
})

useSeoMeta({ title: () => `Cooking ${recipe.value?.title || 'recipe'} — Heirloom` })
</script>
<template>
  <section>
    <div v-if="error || !recipe" role="alert">
      <h1>Recipe unavailable</h1>
      <button class="kitchen-button mt-5" @click="refresh()">Try again</button>
    </div>

    <template v-else>
      <h1 class="sr-only">{{ recipe.title }}</h1>
      <div class="mt-5 flex flex-wrap items-center gap-3 text-base">
        <span role="status">{{
          !mounted
            ? 'Checking screen wake lock…'
            : isActive
              ? 'Screen awake · active'
              : isSupported
                ? 'Wake lock inactive'
                : 'Wake lock not supported'
        }}</span>
        <button
          v-if="mounted && isSupported"
          class="kitchen-button"
          :disabled="wakeBusy"
          @click="toggleWake"
        >{{ isActive ? 'Allow screen sleep' : 'Keep screen awake' }}</button>
        <p v-if="wakeError" role="status">{{ wakeError }}</p>
      </div>
      <p v-if="!steps.length" class="mt-8">No cooking steps yet. Add a method in the recipe editor.</p>
      <template v-if="prep && steps.length">
        <article class="mt-8" aria-labelledby="prep-title">
          <p class="text-xl num">Before step 1</p>
          <h2 id="prep-title" ref="prepHeading" tabindex="-1" class="kitchen-step font-sans font-normal">Prep &amp; Mise en Place</h2>
          <p class="mt-3 text-xl">Set everything out and prepped now, so you can cook without stopping.</p>
          <section v-if="safety?.conflicts?.length" class="allergen-alert mt-6" role="alert" aria-labelledby="allergen-title">
            <h3 id="allergen-title" class="flex items-center gap-2 text-2xl"><UIcon name="i-lucide-shield-alert" class="size-7 flex-none" aria-hidden="true" />Allergen check before you start</h3>
            <ul class="mt-3 space-y-1 text-xl">
              <li v-for="conflict in safety.conflicts" :key="conflict.guestId + conflict.allergen + conflict.ingredient"><strong>{{ conflict.guestName }}:</strong> {{ conflict.allergen }} in {{ conflict.ingredient }}</li>
            </ul>
            <p class="mt-3 text-base">Screening goes by ingredient names only. Check labels and cross-contact, and talk to your guest.</p>
          </section>
          <div class="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Servings">
            <button type="button" class="kitchen-button" aria-label="Fewer servings" :disabled="servings <= 1" @click="setServings(Math.max(1, Math.round(servings) - 1))">−</button>
            <span class="num min-w-28 text-center text-xl font-semibold" role="status">{{ servings }} {{ servings === 1 ? 'serving' : 'servings' }}</span>
            <button type="button" class="kitchen-button" aria-label="More servings" :disabled="servings >= 1000" @click="setServings(Math.round(servings) + 1)">+</button>
            <button v-for="preset in servingPresets" :key="preset.label" type="button" class="kitchen-button" :aria-pressed="servings === preset.value" @click="setServings(preset.value)">{{ preset.label }}</button>
          </div>
          <p v-if="servingsScaled" class="mt-2 text-base text-k-muted">Scaled from the recipe’s {{ recipe.servings }} servings.</p>
          <p v-if="preheat" role="note" class="kitchen-panel mt-6 flex items-start gap-3 rounded-lg border border-k-accent p-5 text-xl">
            <UIcon name="i-lucide-flame" class="mt-1 size-7 flex-none text-k-accent" aria-hidden="true" />
            <span><strong>Oven preheating:</strong> step {{ preheat.step }} needs {{ preheat.temperature }} °{{ preheat.unit }}. Turn the oven on now so it’s ready when you are.</span>
          </p>
          <section class="kitchen-panel" aria-labelledby="prep-ingredients">
            <h3 id="prep-ingredients" class="text-2xl">Ingredients</h3>
            <p role="status" class="mt-2 text-lg num">{{ prepped.length }} of {{ prepIngredients.length }} prepped</p>
            <ul class="mt-4 space-y-2">
              <li v-for="row in prepIngredients" :key="row.id">
                <label class="flex min-h-14 cursor-pointer items-start gap-4 py-2 text-xl">
                  <input v-model="prepped" type="checkbox" :value="row.id" class="mt-1 size-7 flex-none" :aria-label="'Prepped: ' + row.name">
                  <span class="min-w-0 break-words" :class="{ 'line-through opacity-60': prepped.includes(row.id) }"><span class="num font-semibold">{{ row.measure }}</span> {{ row.name }}<span v-if="row.notes" class="block text-base text-k-muted">{{ row.notes }}</span></span>
                </label>
              </li>
            </ul>
          </section>
          <button type="button" class="mt-6 inline-flex min-h-12 items-center px-2 text-lg underline" @click="startCooking">Skip prep</button>
        </article>
        <nav class="step-bar step-bar--single" aria-label="Start cooking">
          <button class="kitchen-button kitchen-primary step-next w-full" @click="startCooking">All Prepped — Start Cooking<UIcon name="i-lucide-chevron-right" class="size-7" aria-hidden="true" /></button>
        </nav>
      </template>
      <template v-else-if="step">
        <div class="mt-8 flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2">
          <p class="text-xl num">Step {{ index + 1 }} of {{ steps.length }}</p>
          <p v-if="step.durationMinutes" class="flex items-center gap-1.5 text-lg text-k-muted num"><UIcon name="i-lucide-timer" class="size-5" aria-hidden="true" />{{ step.durationMinutes }} min</p>
          <button
            v-if="speechSupported"
            type="button"
            class="kitchen-button speak-button scroll-mt-40 ml-auto inline-flex min-h-14 min-w-14 items-center gap-2"
            :class="{ 'speak-button--active': isSpeaking }"
            :aria-label="isSpeaking ? 'Stop reading step aloud' : `Read step ${index + 1} aloud`"
            @click="toggleSpeech(step, index + 1)"
          >
            <UIcon :name="isSpeaking ? 'i-lucide-square' : 'i-lucide-volume-2'" class="size-6" aria-hidden="true" />
            {{ isSpeaking ? 'Stop reading' : 'Read step' }}
          </button>
        </div>
        <aside
          v-if="isSpeaking && currentNarrative"
          role="status"
          aria-live="polite"
          class="kitchen-caption-hud fixed bottom-24 inset-x-4 z-40 mx-auto max-w-3xl rounded-xl border-2 border-k-accent bg-k-paper/95 p-4 shadow-2xl backdrop-blur-md"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2 text-k-accent font-semibold text-sm uppercase tracking-wider">
              <UIcon name="i-lucide-volume-2" class="size-5 animate-pulse" aria-hidden="true" />
              <span>Reading Step {{ index + 1 }}</span>
            </div>
            <button
              type="button"
              class="kitchen-button min-h-11 min-w-11 p-2 text-sm"
              aria-label="Dismiss spoken captions"
              @click="stopSpeech"
            >
              <UIcon name="i-lucide-square" class="size-4" aria-hidden="true" />
              Stop
            </button>
          </div>
          <p class="mt-2 text-xl font-medium leading-relaxed text-k-ink sm:text-2xl">{{ currentNarrative }}</p>
        </aside>
        <section v-if="notesPlan" class="kitchen-panel !mt-4 rounded-lg border border-k-rule p-5" aria-labelledby="split-hint-title">
          <h2 id="split-hint-title" class="text-2xl">Only one step saved</h2>
          <p class="mt-3 text-lg">This recipe’s notes contain {{ stepCountPhrase(notesPlan.steps.length) }} method{{ notesPlan.steps.some(row => row.durationMinutes) ? ' with timings' : '' }}. Split it into steps to cook one stage at a time.</p>
          <p class="mt-2 text-base text-k-muted">Replaces the single step{{ notesPlan.ingredients.length && isPlaceholderIngredients(recipe.ingredients) ? ' and the placeholder ingredients' : '' }}. You can refine everything later in Edit recipe.</p>
          <button
            class="kitchen-button kitchen-primary step-next mt-4"
            v-stable-action="splitState"
            :data-state="splitState"
            :aria-busy="splitting"
            :disabled="splitting"
            @click="splitIntoSteps"
          >{{ splitLabel(`Split into ${notesPlan.steps.length} steps`, 'Splitting…') }}</button>
          <p v-if="splitError" role="alert" class="mt-3 text-lg">{{ splitError }}</p>
        </section>
        <Teleport v-if="mounted" to="#kitchen-hud">
          <div class="kitchen-hud" role="group" aria-label="Kitchen status">
            <p class="hud-step"><span class="hud-label">Step</span><span class="num hud-value">{{ index + 1 }}/{{ steps.length }}</span><span class="hud-instruction">{{ step.instruction }}</span></p>
            <p v-if="ovenState" class="hud-chip"><UIcon name="i-lucide-heater" class="size-5" aria-hidden="true" /><span class="hud-label">Oven</span><span class="num hud-value">{{ ovenState }}</span></p>
            <p v-for="timer in liveTimers.slice(0, 3)" :key="timer.id" class="hud-chip" :class="{ 'hud-chip--done': timer.state === 'finished', 'hud-chip--paused': timer.state === 'paused' }">
              <UIcon :name="timer.state === 'finished' ? 'i-lucide-bell-ring' : timer.state === 'paused' ? 'i-lucide-pause' : 'i-lucide-timer'" class="size-5" aria-hidden="true" /><span class="hud-label">{{ timer.name }}</span><span class="num hud-value">{{ timerLabel(timer.remaining) }}</span>
            </p>
            <p v-if="liveTimers.length > 3" class="hud-chip"><span class="hud-value">+{{ liveTimers.length - 3 }}</span></p>
          </div>
        </Teleport>
        <Teleport v-if="mounted" to="#kitchen-progress">
          <progress class="kitchen-progress" :value="index + 1" :max="steps.length" aria-label="Cooking progress"
        /></Teleport>
        <article ref="stepArticle" aria-live="polite" class="mt-8" style="touch-action: pan-y">
          <h2 ref="stepHeading" tabindex="-1" class="kitchen-step font-sans font-normal">{{ step.instruction }}</h2>
          <dl class="mt-7 space-y-3 text-2xl">
            <template
              v-for="(value, label) in {
                'Look for': step.sensoryVisual,
                'Listen for': step.sensoryAudio,
                Aroma: step.sensoryAroma,
                Texture: step.sensoryTexture
              }"
              :key="label">
              <div v-if="value">
                <dt class="font-bold text-k-accent">{{ label }}</dt>
                <dd>{{ value }}</dd>
              </div></template>
            <div v-if="step.internalTempTargetC != null">
              <dt class="font-bold text-k-accent">Internal temperature target</dt>
              <dd>{{ step.internalTempTargetC }} °C · use a thermometer</dd>
            </div>
          </dl>
          <p v-if="step.scienceWhy" class="mt-6 text-xl"><strong>Why:</strong> {{ step.scienceWhy }}</p>
          <p v-if="step.failurePrevention" class="mt-4 text-xl text-k-accent">{{ step.failurePrevention }}</p>
        </article>
        <nav class="step-bar" aria-label="Cooking steps">
          <button class="kitchen-button" @click="index === 0 ? backToPrep() : navigate('previous')"><UIcon name="i-lucide-chevron-left" class="size-7" aria-hidden="true" />{{ index === 0 ? 'Prep' : 'Prev' }}</button>
          <span class="num text-base">{{ index + 1 }} / {{ steps.length }}</span>
          <button v-if="index < steps.length - 1" class="kitchen-button step-next" @click="navigate('next')">Next<UIcon name="i-lucide-chevron-right" class="size-7" aria-hidden="true" /></button>
          <button v-else class="kitchen-button step-next" @click="finishCooking">Done</button>
        </nav>
        <dialog ref="finishDialog" class="m-auto max-h-[90dvh] w-[min(92vw,32rem)] overflow-y-auto rounded-xl border border-k-accent bg-k-paper p-6 text-k-ink backdrop:bg-black/50" aria-labelledby="finish-title" @cancel="finishState === 'busy' && $event.preventDefault()">
          <h2 id="finish-title" class="text-3xl">Finished cooking?</h2>
          <template v-if="finishState !== 'done'">
            <fieldset class="mt-4" :disabled="finishState === 'busy'">
              <legend class="text-xl">How did this turn out?</legend>
              <div class="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Rating">
                <label v-for="star in 5" :key="star" class="star-choice">
                  <input v-model.number="rating" type="radio" name="cook-rating" :value="star" class="sr-only" :aria-label="star + (star === 1 ? ' star' : ' stars')">
                  <UIcon name="i-lucide-star" class="size-8" :class="{ 'fill-current': star <= rating }" aria-hidden="true" />
                </label>
                <button v-if="rating" type="button" class="ml-2 inline-flex min-h-12 min-w-12 items-center justify-center text-base underline" @click="rating = 0">Clear</button>
              </div>
              <label class="mt-4 block text-lg">Add a note (optional)
                <textarea v-model="journalNote" class="kitchen-input mt-2" rows="3" maxlength="2000" placeholder="How did this bake/cook turn out?" />
              </label>
            </fieldset>
            <p class="mt-5 text-xl">Deduct matching ingredients from your pantry?</p>
            <p v-if="finishError" role="alert" class="mt-3 text-lg text-k-accent">{{ finishError }}</p>
            <div class="mt-4 flex flex-wrap gap-3">
              <button class="kitchen-button" :disabled="finishState === 'busy'" :aria-busy="finishState === 'busy'" autofocus @click="finishWith(true)">{{ finishState === 'busy' ? 'Saving…' : 'Deduct from pantry' }}</button>
              <button class="kitchen-button" :disabled="finishState === 'busy'" @click="finishWith(false)">Skip pantry</button>
            </div>
          </template>
          <template v-else>
            <div role="status">
              <p class="mt-3 text-xl">Saved to your Cook’s Journal.</p>
              <p class="mt-3 text-xl">{{ deducted.length ? 'Pantry updated. Used:' : 'Nothing in your pantry matched this recipe, so nothing changed.' }}</p>
              <ul v-if="deducted.length" class="mt-3 list-disc space-y-1 pl-6 text-lg"><li v-for="item in deducted" :key="item.name">{{ item.name }} — {{ item.amount }}</li></ul>
            </div>
            <button class="kitchen-button mt-6" autofocus @click="leaveKitchen">Back to recipe</button>
          </template>
          <RecipeStorageReheatingCard v-if="recipe" :recipe="recipe" heading="Leftovers & Reheating" kitchen class="mt-6" />
        </dialog>
        <p v-if="index === steps.length - 1" class="mt-4 text-xl">Final step. Check your active timers before
          leaving.</p>
        <section class="kitchen-panel">
          <h2 class="text-2xl">{{
              matchedIngredients.length
                ? 'Ingredients mentioned in this step'
                : 'Recipe ingredients · no explicit step match'
            }}</h2>
          <p v-if="servingsScaled" class="mt-1 text-base text-k-muted">Scaled for {{ servings }} servings.</p>
          <ul class="mt-4 space-y-2 text-xl">
            <li
              v-for="row in matchedIngredients.length ? matchedIngredients : scaledIngredients"
              :key="row.id"
            >{{ row.unit === 'as needed' && !row.amount ? 'As needed ·' : row.amount + ' ' + row.unit }} {{ row.name }}</li>
          </ul>
        </section>
        <section v-if="temperature" class="kitchen-panel">
          <h2 class="text-2xl">Oven adjustment</h2>
          <p class="mt-3 text-base">Check the source oven type. An unspecified oven is treated as
            conventional. Use either temperature or time
            adjustment, not both; disable the oven’s automatic conversion if it already adjusts the setting.</p>
          <div class="mt-4 grid gap-4 text-lg sm:grid-cols-3">
            <label>Recipe oven<select v-model="fromOven" class="kitchen-input">
                <option value="static_conventional">Conventional</option>
                <option value="convection_fan">Convection / fan</option>
              </select></label>
            <label>Your oven<select v-model="toOven" class="kitchen-input">
                <option value="static_conventional">Conventional</option>
                <option value="convection_fan">Convection / fan</option>
              </select></label>
            <label>Adjust<select v-model="strategy" class="kitchen-input">
                <option value="temperature">Temperature</option>
                <option value="time">Time only</option>
              </select></label>
          </div>
          <label v-if="rawDurations.length > 1 && strategy === 'time'" class="mt-4 block text-lg">Which
            interval is
            oven cooking
            time?<select v-model.number="ovenTimerIndex" class="kitchen-input">
              <option :value="-1">Choose an interval — timers unchanged</option>
              <option v-for="(seconds, number) in rawDurations" :key="number" :value="number">Timer
                {{ number + 1 }}
                ·
                {{ timerLabel(seconds) }}</option>
            </select></label>
          <p class="mt-5 font-bold text-k-accent">{{ converted?.temperature }} °{{ temperature.unit }}<span
            v-if="converted?.minutes"
          > · {{ Number(converted.minutes.toFixed(1)) }} min</span>
          </p>
          <p v-if="converted?.note" role="status" class="mt-3 text-lg">{{ converted.note }}</p>
          <p class="mt-3 text-base">A starting estimate. Check doneness early; this never changes food-safety
            temperature targets. Time-adjusted
            timer buttons use the conversion below.</p>
        </section>
        <section v-if="step.heatLevel && step.heatLevel !== 'none'" class="kitchen-panel">
          <h2 class="text-2xl">Your burner · {{ kitchen?.stoveType || 'gas (default)' }}</h2>
          <p class="mt-4 text-xl">{{ burnerAdvice(kitchen?.stoveType || 'gas', step.heatLevel) }}</p>
        </section>
      </template>
      <section id="cooking-timers" ref="timersSection" tabindex="-1" class="kitchen-panel scroll-mt-32 focus:outline-none" aria-label="Cooking timers">
        <h2 class="text-2xl">Timers</h2>
        <div class="mt-4" role="group" aria-labelledby="quick-presets-title">
          <h3 id="quick-presets-title" class="text-lg font-semibold">Quick presets</h3>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="preset in QUICK_TIMER_PRESETS"
              :key="preset.label"
              type="button"
              class="kitchen-button min-h-11 inline-flex items-center gap-1.5 px-3.5 rounded-full text-base border border-k-rule hover:border-k-accent active:scale-95 transition-all motion-reduce:transition-none motion-reduce:active:scale-100"
              :title="preset.description"
              :aria-label="'Start ' + preset.label + ' timer for ' + preset.description"
              :disabled="timers.length + removed.length >= TIMER_LIMIT"
              @click="startPreset(preset.label, preset.seconds); enableSound()"
            ><UIcon name="i-lucide-timer" class="size-5" aria-hidden="true" />{{ preset.label }}</button>
          </div>
        </div>
        <form class="mt-5" aria-labelledby="custom-timer-title" @submit.prevent="addCustom">
          <h3 id="custom-timer-title" class="text-lg font-semibold">Custom timer</h3>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <label class="min-w-0 flex-1 basis-48"><span class="sr-only">Timer name</span>
              <input v-model="customName" type="text" maxlength="60" autocomplete="off" placeholder="Timer name, e.g. Rest dough" class="kitchen-input text-base py-2 px-3 min-h-11 w-full">
            </label>
            <label class="w-24"><span class="sr-only">Minutes</span>
              <input v-model.number="customMinutes" type="number" min="0.5" max="180" step="0.5" inputmode="decimal" class="kitchen-input text-base py-2 px-3 min-h-11 w-full text-center num" aria-describedby="custom-timer-hint">
            </label>
            <span class="text-base" aria-hidden="true">min</span>
            <button type="button" class="kitchen-button min-h-11 min-w-11" aria-label="Add 1 minute" @click="bumpCustom(1)">+1m</button>
            <button type="button" class="kitchen-button min-h-11 min-w-11" aria-label="Add 5 minutes" @click="bumpCustom(5)">+5m</button>
            <button class="kitchen-button kitchen-primary min-h-11" :disabled="!customValid || timers.length + removed.length >= TIMER_LIMIT">Add Timer</button>
          </div>
          <p id="custom-timer-hint" class="mt-2 text-base" :class="{ 'text-k-accent': !customValid || timers.length + removed.length >= TIMER_LIMIT }">{{ timers.length + removed.length >= TIMER_LIMIT ? 'That’s the limit of ' + TIMER_LIMIT + ' timers. Remove one to add another.' : customValid ? 'Between 0.5 and 180 minutes.' : 'Choose between 0.5 and 180 minutes.' }}</p>
        </form>
        <p class="mt-3 text-base">{{ persistence }} Sound works while Kitchen Mode is open and may be delayed
          in the background. {{ sound }}</p>
        <div class="mt-4 flex flex-wrap gap-3">
          <button
            v-for="(seconds, number) in durations"
            :key="number"
            class="kitchen-button kitchen-primary"
            :disabled="timers.length + removed.length >= 20"
            @click="startStepTimer(seconds, number)"
          ><UIcon name="i-lucide-play" class="size-6" aria-hidden="true" />Start Timer · {{ timerLabel(seconds) }}</button>
          <button class="kitchen-button text-base" @click="enableSound">Enable sound</button>
        </div>
        <p v-if="!durations.length" class="mt-3 text-lg">No duration found in this step.</p>
        <div
          v-for="slot in timerSlots"
          :key="slot.timer.id"
          class="timer-card mt-5 rounded-lg border border-k-rule p-4"
          :style="slot.removed ? { minHeight: slot.height + 'px' } : undefined"
        >
          <div v-if="slot.removed" role="status" class="text-xl">Timer removed ·
            <button class="kitchen-button" @click="undo(slot.timer)">Undo</button>
          </div>
          <template v-else>
            <p class="text-xl">
              <UIcon
                :name="
                  slot.timer.state === 'running'
                    ? 'i-lucide-play'
                    : slot.timer.state === 'finished'
                      ? 'i-lucide-bell-ring'
                      : 'i-lucide-pause'
                "
                aria-hidden="true"
              />
              {{ slot.timer.name }} · {{ slot.timer.state }}</p>
            <p class="num my-3 text-[clamp(3rem,11vw,4.5rem)] font-bold leading-none" role="timer" :aria-label="slot.timer.name">{{ timerLabel(slot.timer.remaining) }}</p>
            <div class="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              <button
                class="kitchen-button kitchen-primary col-span-2 sm:min-w-48"
                :aria-label="(slot.timer.state === 'running' ? 'Pause ' : 'Resume ') + slot.timer.name"
                @click="toggle(slot.timer)"
              ><UIcon :name="slot.timer.state === 'running' ? 'i-lucide-pause' : 'i-lucide-play'" class="size-6" aria-hidden="true" />{{ slot.timer.state === 'running' ? 'Pause' : 'Resume' }}</button>
              <button
                class="kitchen-button"
                :aria-label="'Reset ' + slot.timer.name"
                @click="reset(slot.timer)"
              >Reset</button>
              <button
                class="kitchen-button"
                :aria-label="'Remove ' + slot.timer.name"
                @click="removeWithUndo(slot.timer, $event)"
              >Remove</button>
            </div></template>
        </div>
        <div
          v-if="alerts.length"
          ref="alertBanner"
          role="alert"
          class="timer-alert mt-6 rounded-lg bg-k-accent p-5 text-k-paper"
        >
          <p v-for="(alert, i) in alerts" :key="i">{{ alert }}</p>
          <button class="kitchen-button kitchen-primary mt-3" @click="alerts = []">Dismiss</button>
        </div>
      </section>
      <section class="kitchen-panel">
        <h2 class="text-2xl">Contactless navigation</h2>
        <p class="mt-3 text-base">Swipe left on the step for next; right for previous. Camera waves are
          optional: no frames leave this device.
          Wave left → next; right → previous. This detects motion, so keep the camera still and avoid moving people in
          the background. Arrow keys navigate; Space advances to the next step.</p>
        <button
          class="kitchen-button mt-4"
          @click="cameraActive || cameraPending ? stopCamera() : startCamera()"
        >{{ cameraActive || cameraPending ? 'Turn camera off' : 'Enable camera gestures' }}</button>
        <p class="mt-3 text-lg" role="status">{{ cameraMessage }}</p>
        <p v-if="cameraActive" class="mt-2 text-lg text-k-accent">{{ motion ? 'Motion detected' : 'Watching for a wave' }}</p>
        <video
          ref="video"
          v-show="cameraActive"
          muted
          playsinline
          class="mt-4 w-48 rounded-lg"
          style="transform: scaleX(-1)"
          aria-label="Local camera preview"
        />
      </section>
      <div v-if="showTimersHud && nearestTimer" class="timers-hud" role="region" aria-label="Active cooking timers HUD">
        <button type="button" class="timers-hud__main" @click="scrollToTimers">
          <UIcon name="i-lucide-timer" class="size-7 flex-none text-k-accent" :class="{ 'animate-pulse motion-reduce:animate-none': nearestTimer.state === 'running' }" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-base">{{ nearestTimer.name }}<span v-if="nearestTimer.state === 'paused'"> · paused</span></span>
            <span class="num block text-2xl font-bold leading-tight text-k-accent">{{ timerLabel(nearestTimer.remaining) }}</span>
          </span>
          <span v-if="activeTimers.length > 1" class="flex-none text-base">+ {{ activeTimers.length - 1 }} more</span>
          <span class="sr-only">{{ formatTimerHeading(nearestTimer.name, nearestTimer.remaining) }}. Scroll to timers</span>
        </button>
        <button type="button" class="kitchen-button min-h-11 min-w-11 flex-none" :aria-label="(nearestTimer.state === 'running' ? 'Pause ' : 'Resume ') + nearestTimer.name" @click="toggle(nearestTimer)">
          <UIcon :name="nearestTimer.state === 'running' ? 'i-lucide-pause' : 'i-lucide-play'" class="size-6" aria-hidden="true" />
        </button>
      </div>
      <RescueDrawer
        :ingredients="[...new Set(recipe.ingredients.map(row => row.name))]"
        :context="recipe.title + ': ' + (step?.instruction || '')"
        :current-step="step?.stepNumber"
        @open="opened"
      />
    </template>
  </section>
</template>
<style scoped>
.speak-button--active { border-color: var(--color-k-accent); color: var(--color-k-accent); animation: speak-pulse 1.6s ease-in-out infinite; }
@keyframes speak-pulse { 50% { box-shadow: 0 0 0 4px color-mix(in oklch, var(--color-k-accent) 25%, transparent); } }
@media (prefers-reduced-motion: reduce) { .speak-button--active { animation: none; } }
.allergen-alert { border: 2px solid var(--color-k-allergen); border-radius: .75rem; background: var(--color-k-allergen-wash); color: var(--color-k-allergen-ink); padding: 1.25rem; }
.star-choice { display: inline-flex; min-height: 48px; min-width: 44px; align-items: center; justify-content: center; border-radius: .5rem; color: var(--color-k-accent); cursor: pointer; }
.star-choice:has(:focus-visible) { outline: 3px solid var(--color-k-accent); outline-offset: 2px; }
.step-bar {
  position: fixed;
  bottom: 0;
  inset-inline: 0;
  z-index: 30;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem max(1rem, env(safe-area-inset-right)) max(0.75rem, env(safe-area-inset-bottom))
    max(1rem, env(safe-area-inset-left));
  background: var(--color-k-paper);
  border-top: 1px solid var(--color-k-rule);
}
/* Prep has one action, so it gets the whole bar. */
.step-bar--single { grid-template-columns: minmax(0, 1fr); }
.step-bar--single .kitchen-button { justify-content: center; white-space: normal; }
/* Fitts: primary kitchen actions are ≥64px tall so a wet or floured hand cannot miss them. */
.step-bar .kitchen-button,
.kitchen-primary {
  min-height: 64px;
  padding-inline: 1.25rem;
  font-size: 1.25rem;
  font-weight: 700;
}
.kitchen-hud {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-inline: auto;
  max-width: 64rem;
  padding: 0.25rem 0 0.5rem;
  font-size: 1rem;
}
.hud-step {
  display: flex;
  flex: 1 1 14rem;
  min-width: 0;
  align-items: baseline;
  gap: 0.5rem;
}
.hud-instruction {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--color-k-muted);
}
.hud-chip {
  display: inline-flex;
  min-height: 40px;
  max-width: 100%;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid var(--color-k-rule);
  border-radius: 999px;
  background: var(--color-k-paper-2);
  padding: 0.25rem 0.75rem;
}
.hud-chip .hud-label {
  min-width: 0;
  max-width: 9rem;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.hud-chip--done {
  border-color: var(--color-k-accent);
  background: var(--color-k-accent);
  color: var(--color-k-paper);
}
.hud-chip--paused {
  color: var(--color-k-muted);
}
.hud-label {
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.hud-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-k-accent);
}
.hud-chip--done .hud-value {
  color: var(--color-k-paper);
}
/* Phones: the step card below already shows the instruction; keep the HUD to one compact row. */
@media (max-width: 40rem) {
  .hud-step { flex: 0 0 auto; }
  .hud-instruction, .hud-chip .hud-label { display: none; }
  .hud-chip { padding-inline: 0.6rem; }
}
.step-next {
  background: var(--color-k-accent);
  color: var(--color-k-paper);
}
.kitchen-progress {
  display: block;
  appearance: none;
  width: 100%;
  height: 6px;
  background: var(--color-k-paper-2);
  border: 0;
}
.kitchen-progress::-webkit-progress-bar {
  background: var(--color-k-paper-2);
}
.kitchen-progress::-webkit-progress-value {
  background: var(--color-k-accent);
}
.kitchen-progress::-moz-progress-bar {
  background: var(--color-k-accent);
}
/* Sits just above the step bar so it never covers Prev / Next; hidden while the alert banner uses the same spot. */
.timers-hud {
  position: fixed;
  inset-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
  bottom: calc(6.5rem + env(safe-area-inset-bottom));
  z-index: 28;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 36rem;
  margin-inline: auto;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-k-rule);
  border-radius: 1rem;
  background: color-mix(in oklch, var(--color-k-paper-2) 95%, transparent);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 24px oklch(0% 0 0 / 0.45);
  color: var(--color-k-ink);
}
.timers-hud__main { display: flex; flex: 1 1 auto; min-width: 0; min-height: 44px; align-items: center; gap: 0.75rem; border-radius: 0.75rem; text-align: start; }
.timers-hud__main:focus-visible { outline: 3px solid var(--color-k-accent); outline-offset: 2px; }
@media (min-width: 48rem) {
  .timers-hud { margin-inline: 0 auto; inset-inline-start: max(1.5rem, env(safe-area-inset-left)); }
}
/* Fixed, not sticky: a sticky banner stays inside the timers panel
   and is invisible while the cook reads the step above it. */
.timer-alert {
  position: fixed;
  inset-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
  bottom: calc(6.5rem + env(safe-area-inset-bottom));
  z-index: 29;
  max-height: 40dvh;
  overflow-y: auto;
  margin: 0;
  touch-action: pan-x;
  box-shadow: 0 -1px 0 var(--color-k-rule);
}
@media (min-width: 48rem) {
  .timer-alert {
    inset-inline: auto;
    right: max(1.5rem, env(safe-area-inset-right));
    width: 26rem;
  }
}
</style>
