<script setup lang="ts">
import { useEventListener, useWakeLock } from '@vueuse/core'
import type { KitchenProfile, RecipeDetail } from '#shared/types/recipe'
import { burnerAdvice, convertOven, ovenTemperature, type Oven } from '#shared/culinary/heat'
import { parseDurations, timerLabel } from '../../../utils/timers'
definePageMeta({ layout: 'kitchen' })
const route = useRoute(), id = String(route.params.id)
const [{ data: recipe, error, refresh }, { data: kitchen }] = await Promise.all([
  useFetch<RecipeDetail>('/api/recipes/' + id), useFetch<KitchenProfile>('/api/settings/kitchen')
])
const index = ref(0), rescueOpen = ref(false), mounted = ref(false)
const steps = computed(() => [...(recipe.value?.steps || [])].sort((a, b) => a.stepNumber - b.stepNumber))
const step = computed(() => steps.value[index.value])
const { timers, alerts, sound, persistence, start, toggle, reset, remove, enableSound } = useCookingTimers(id)
function navigate(direction: 'next' | 'previous') {
  if (!rescueOpen.value) index.value = Math.max(0, Math.min(steps.value.length - 1, index.value + (direction === 'next' ? 1 : -1)))
}
const { video, active: cameraActive, pending: cameraPending, message: cameraMessage, motion, start: startCamera, stop: stopCamera } = useAirSwipe(navigate)
const { isSupported, isActive: wakeRequested, sentinel, request: requestWake, release } = useWakeLock()
const wakeReleased = ref(false)
watch(sentinel, value => { wakeReleased.value = value?.released ?? true })
useEventListener(sentinel, 'release', () => { wakeReleased.value = true })
const isActive = computed(() => wakeRequested.value && !wakeReleased.value)
const wakeError = ref(''), wakeBusy = ref(false)
let disposed = false
async function keepAwake() {
  if (wakeBusy.value) return
  wakeBusy.value = true; wakeError.value = ''
  try { await requestWake('screen'); if (disposed) await release() }
  catch { wakeError.value = 'Wake lock unavailable. Check your device’s screen timeout.' }
  finally { wakeBusy.value = false }
}
const fromOven = ref<Oven>('static_conventional')
const toOven = ref<Oven>(kitchen.value?.ovenType || 'static_conventional')
const strategy = ref<'temperature' | 'time'>('temperature')
const ovenTimerIndex = ref(-1)
watch(step, () => { ovenTimerIndex.value = -1 })
watch(step, value => { fromOven.value = /fan|convection/i.test(value?.instruction || '') ? 'convection_fan' : 'static_conventional' }, { immediate: true })
const temperature = computed(() => /oven|bake|roast|preheat|φουρν|ψησ|ψην|προθερμ/i.test((step.value?.instruction || '').normalize('NFD').replace(/\p{M}/gu, '')) ? ovenTemperature(step.value!.instruction) : null)
const rawDurations = computed(() => {
  const parsed = parseDurations(step.value?.instruction || '')
  return parsed.length ? parsed : step.value?.durationMinutes ? [step.value.durationMinutes * 60] : []
})
const selectedOvenTimer = computed(() => rawDurations.value.length === 1 ? 0 : ovenTimerIndex.value)
const converted = computed(() => temperature.value ? convertOven(temperature.value.temperature, (rawDurations.value[selectedOvenTimer.value] || 0) / 60, fromOven.value, toOven.value, temperature.value.unit, strategy.value) : null)
const durations = computed(() => rawDurations.value.map((seconds, number) => temperature.value && strategy.value === 'time' && number === selectedOvenTimer.value ? Math.round(convertOven(temperature.value.temperature, seconds / 60, fromOven.value, toOven.value, temperature.value.unit, 'time').minutes * 60) : seconds))
const matchedIngredients = computed(() => {
  const words = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().match(/[\p{L}]+/gu) || []
  const instruction = new Set(words(step.value?.instruction || ''))
  return recipe.value?.ingredients.filter(row => words(row.name).some(word => word.length > 2 && !['fresh', 'dried', 'ground', 'finely'].includes(word) && instruction.has(word))) || []
})
function startStepTimer(seconds: number, number: number) { start(`Step ${index.value + 1}${durations.value.length > 1 ? ' · timer ' + (number + 1) : ''}`, seconds) }
function keyboard(event: KeyboardEvent) {
  if (rescueOpen.value || event.repeat || event.altKey || event.ctrlKey || event.metaKey || (event.target as HTMLElement)?.closest('input, textarea, select, [contenteditable]')) return
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); navigate(event.key === 'ArrowLeft' ? 'previous' : 'next') }
  if (event.code === 'Space' && !(event.target as HTMLElement)?.closest('button, a')) { event.preventDefault(); navigate('next') }
}
function opened(value: boolean) { rescueOpen.value = value; if (value) stopCamera() }
onMounted(() => { mounted.value = true; document.addEventListener('keydown', keyboard); if (isSupported.value) void keepAwake() })
onBeforeUnmount(() => { disposed = true; document.removeEventListener('keydown', keyboard); void release().catch(() => {}) })
useSeoMeta({ title: () => `Cooking ${recipe.value?.title || 'recipe'} — Heirloom` })
</script>
<template>
  <section class="pb-28">
    <div v-if="error || !recipe" role="alert"><h1>Recipe unavailable</h1><button class="kitchen-button mt-5" @click="refresh()">Try again</button></div>
    <template v-else>
      <h1 class="text-3xl">{{ recipe.title }}</h1>
      <div class="mt-5 flex flex-wrap items-center gap-3 text-base">
        <span role="status">{{ !mounted ? 'Checking screen wake lock…' : isActive ? 'Screen awake · active' : isSupported ? 'Wake lock inactive' : 'Wake lock not supported' }}</span>
        <button v-if="mounted && isSupported" class="kitchen-button" :disabled="wakeBusy" @click="isActive ? release() : keepAwake()">{{ isActive ? 'Allow screen sleep' : 'Keep screen awake' }}</button>
        <p v-if="wakeError" role="status">{{ wakeError }}</p>
      </div>
      <p v-if="!steps.length" class="mt-8">No cooking steps yet. Add a method in the recipe editor.</p>
      <template v-if="step">
        <p class="mt-8 text-xl">Step {{ index + 1 }} of {{ steps.length }}</p>
        <progress class="mt-3 h-3 w-full accent-amber-300" :value="index + 1" :max="steps.length" aria-label="Cooking progress" />
        <article aria-live="polite" class="mt-8">
          <p class="kitchen-step">{{ step.instruction }}</p>
          <dl class="mt-7 space-y-3 text-2xl"><template v-for="(value, label) in { 'Look for': step.sensoryVisual, 'Listen for': step.sensoryAudio, Aroma: step.sensoryAroma, Texture: step.sensoryTexture }" :key="label"><div v-if="value"><dt class="font-bold text-amber-200">{{ label }}</dt><dd>{{ value }}</dd></div></template><div v-if="step.internalTempTargetC != null"><dt class="font-bold text-amber-200">Internal temperature target</dt><dd>{{ step.internalTempTargetC }} °C · use a thermometer</dd></div></dl>
          <p v-if="step.scienceWhy" class="mt-6 text-xl"><strong>Why:</strong> {{ step.scienceWhy }}</p>
          <p v-if="step.failurePrevention" class="mt-4 text-xl text-amber-200">{{ step.failurePrevention }}</p>
        </article>
        <nav class="mt-8 flex flex-wrap gap-4" aria-label="Cooking steps"><button class="kitchen-button" :disabled="index === 0" @click="navigate('previous')">← Previous step</button><button class="kitchen-button" :disabled="index === steps.length - 1" @click="navigate('next')">Next step →</button></nav>
        <p v-if="index === steps.length - 1" class="mt-4 text-xl">Final step. Check your active timers before leaving.</p>
        <section class="kitchen-panel"><h2 class="text-2xl">{{ matchedIngredients.length ? 'Ingredients mentioned in this step' : 'Recipe ingredients · no explicit step match' }}</h2><ul class="mt-4 space-y-2 text-xl"><li v-for="row in matchedIngredients.length ? matchedIngredients : recipe.ingredients" :key="row.id">{{ row.amount }} {{ row.unit }} {{ row.name }}</li></ul></section>
        <section v-if="temperature" class="kitchen-panel">
          <h2 class="text-2xl">Oven adjustment</h2><p class="mt-3 text-base">Check the source oven type. An unspecified oven is treated as conventional. Use either temperature or time adjustment, not both; disable the oven’s automatic conversion if it already adjusts the setting.</p>
          <div class="mt-4 grid gap-4 text-lg sm:grid-cols-3"><label>Recipe oven<select v-model="fromOven" class="kitchen-input"><option value="static_conventional">Conventional</option><option value="convection_fan">Convection / fan</option></select></label><label>Your oven<select v-model="toOven" class="kitchen-input"><option value="static_conventional">Conventional</option><option value="convection_fan">Convection / fan</option></select></label><label>Adjust<select v-model="strategy" class="kitchen-input"><option value="temperature">Temperature</option><option value="time">Time only</option></select></label></div>
          <label v-if="rawDurations.length > 1 && strategy === 'time'" class="mt-4 block text-lg">Which interval is oven cooking time?<select v-model.number="ovenTimerIndex" class="kitchen-input"><option :value="-1">Choose an interval — timers unchanged</option><option v-for="(seconds, number) in rawDurations" :key="number" :value="number">Timer {{ number + 1 }} · {{ timerLabel(seconds) }}</option></select></label>
          <p class="mt-5 font-bold text-amber-200">{{ converted?.temperature }} °{{ temperature.unit }}<span v-if="converted?.minutes"> · {{ Number(converted.minutes.toFixed(1)) }} min</span></p><p v-if="converted?.note" role="status" class="mt-3 text-lg">{{ converted.note }}</p><p class="mt-3 text-base">A starting estimate. Check doneness early; this never changes food-safety temperature targets. Time-adjusted timer buttons use the conversion below.</p>
        </section>
        <section v-if="step.heatLevel && step.heatLevel !== 'none'" class="kitchen-panel"><h2 class="text-2xl">Your burner · {{ kitchen?.stoveType || 'gas (default)' }}</h2><p class="mt-4 text-xl">{{ burnerAdvice(kitchen?.stoveType || 'gas', step.heatLevel) }}</p></section>
      </template>
      <section class="kitchen-panel" aria-label="Cooking timers">
        <h2 class="text-2xl">Timers</h2><p class="mt-3 text-base">{{ persistence }} Sound works while Kitchen Mode is open and may be delayed in the background. {{ sound }}</p>
        <div class="mt-4 flex flex-wrap gap-3"><button v-for="(seconds, number) in durations" :key="number" class="kitchen-button" :disabled="timers.length >= 20" @click="startStepTimer(seconds, number)">Start Timer · {{ timerLabel(seconds) }}</button><button class="kitchen-button text-base" @click="enableSound">Enable sound</button></div>
        <p v-if="!durations.length" class="mt-3 text-lg">No duration found in this step.</p>
        <div v-for="timer in timers" :key="timer.id" class="mt-5 rounded-lg border border-stone-600 p-4"><p class="text-xl">{{ timer.name }} · {{ timer.state }}</p><p class="my-3 text-4xl tabular-nums" role="timer" :aria-label="timer.name">{{ timerLabel(timer.remaining) }}</p><div class="flex flex-wrap gap-3"><button class="kitchen-button" @click="toggle(timer)">{{ timer.state === 'running' ? 'Pause' : 'Resume' }} {{ timer.name }}</button><button class="kitchen-button" @click="reset(timer)">Reset {{ timer.name }}</button><button class="kitchen-button" @click="remove(timer)">Remove {{ timer.name }}</button></div></div>
        <div v-if="alerts.length" role="alert" class="mt-6 rounded-lg bg-amber-200 p-5 text-stone-950"><p v-for="(alert, i) in alerts" :key="i">{{ alert }}</p><button class="kitchen-button mt-3 !border-stone-800 !bg-stone-900 !text-white" @click="alerts = []">Dismiss timer alerts</button></div>
      </section>
      <section class="kitchen-panel"><h2 class="text-2xl">Contactless navigation</h2><p class="mt-3 text-base">No camera frames leave this device. Wave left → next; right → previous. This detects motion, so keep the camera still and avoid moving people in the background. Arrow keys navigate; Space advances to the next step.</p><button class="kitchen-button mt-4" @click="cameraActive || cameraPending ? stopCamera() : startCamera()">{{ cameraActive || cameraPending ? 'Turn camera off' : 'Enable camera gestures' }}</button><p class="mt-3 text-lg" role="status">{{ cameraMessage }}</p><p v-if="cameraActive" class="mt-2 text-lg text-amber-200">{{ motion ? 'Motion detected' : 'Watching for a wave' }}</p><video ref="video" v-show="cameraActive" muted playsinline class="mt-4 w-48 rounded-lg" style="transform: scaleX(-1)" aria-label="Local camera preview" /></section>
      <RescueDrawer :context="recipe.title + ': ' + (step?.instruction || '')" :current-step="step?.stepNumber" @open="opened" />
    </template>
  </section>
</template>
