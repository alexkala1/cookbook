<script setup lang="ts">
import { rescueGuides, rescueTriage, type RescueAdvice, type RescueIssue } from '#shared/culinary/rescue'

const props = defineProps<{ context: string; currentStep?: number; ingredients?: string[] }>()
const emit = defineEmits<{ open: [value: boolean] }>()
const dialog = ref<HTMLDialogElement>()
const problem = ref('')
const busy = ref(false)
const error = ref('')
const { state, label } = useActionFeedback(busy, error)
const advice = ref<RescueAdvice>(rescueTriage(''))
const mode = ref('Instant offline guide')
const { requestHeaders, ready } = useByokSettings()
let controller: AbortController | undefined

function show() {
  dialog.value?.showModal()
  emit('open', true)
}

function close() {
  controller?.abort()
  emit('open', false)
}

function choose(issue: RescueIssue) {
  controller?.abort()
  advice.value = { ...rescueGuides[issue], actions: [...rescueGuides[issue].actions] }
  mode.value = 'Instant offline guide'
  error.value = ''
}

async function ask() {
  controller?.abort()
  const request = new AbortController()
  controller = request
  advice.value = rescueTriage(problem.value)
  mode.value = 'Offline triage while checking'
  busy.value = true
  error.value = ''
  try {
    const result = await $fetch<RescueAdvice & { mode: string }>('/api/ai/rescue', {
      method: 'POST',
      signal: request.signal,
      headers: requestHeaders(),
      body: {
        issueDescription: problem.value,
        recipeContext: props.context.slice(0, 10000),
        currentStep: props.currentStep
      }
    })

    if (!request.signal.aborted) {
      advice.value = result
      mode.value = result.mode === 'live' ? 'AI advice — verify before acting' : 'Offline culinary guide'
    }
  } catch {
    if (!request.signal.aborted) {
      error.value = 'Custom advice unavailable. The offline guide remains available.'
      mode.value = 'Offline culinary guide'
    }
  } finally {
    if (controller === request) busy.value = false
  }
}

type SwapOption = { name: string, ratio: string, science: string, adjustment: string }
const subIngredient = ref('')
const subTarget = ref('')
const subBusy = ref(false)
const subError = ref('')
const subResult = ref<{ options: SwapOption[], mode: string } | null>(null)
async function findSubstitutes(name?: string) {
  const target = (name || subIngredient.value).trim()
  if (!target) return
  subBusy.value = true
  subError.value = ''
  try {
    const result = await $fetch<{ options: SwapOption[], mode: string }>('/api/ai/substitute', {
      method: 'POST',
      headers: requestHeaders(),
      body: { ingredientName: target, recipeContext: props.context.slice(0, 10000) }
    })
    subResult.value = result
    subTarget.value = target
  } catch {
    subResult.value = null
    subError.value = 'No reliable substitution found for this ingredient. Try butter, olive oil, wine, garlic, onion, yogurt, egg, milk, or lemon.'
  } finally {
    subBusy.value = false
  }
}

onBeforeUnmount(() => controller?.abort())
</script>
<template>
  <ClientOnly>
    <Teleport to="#kitchen-rescue-dock">
      <button class="rescue-trigger" aria-label="Rescue My Dish" @click="show">
        <UIcon name="i-lucide-life-buoy" aria-hidden="true" />Rescue</button></Teleport>
    </ClientOnly>
  <dialog ref="dialog" class="rescue-drawer" aria-label="Rescue My Dish" @close="close">
    <form method="dialog"><button class="kitchen-button float-right" autofocus>Close</button></form>

    <h2 class="clear-both pt-5 text-3xl">Rescue My Dish</h2>

    <p class="mt-3 font-serif text-lg italic">Don’t worry — almost every kitchen mishap can be saved. We’re right here with you.</p>

    <p class="mt-3 text-base">Quick guides work instantly, without a key or network request.</p>

    <div class="mt-5 flex flex-wrap gap-2">
      <button
        v-for="(guide, issue) in rescueGuides"
        v-show="issue !== 'unknown'"
        :key="issue"
        class="kitchen-button text-base"
        @click="choose(issue)"
      >{{ guide.title }}</button>
    </div>

    <article class="mt-6 rounded-xl border border-k-accent p-5" aria-live="polite">
      <p class="text-sm text-k-accent">{{ mode }}</p>
      <h3 class="mt-2 text-2xl font-semibold">{{ advice.title }}</h3>
      <ol class="mt-4 list-decimal space-y-3 pl-6 text-lg">
        <li v-for="action in advice.actions" :key="action">{{ action }}</li>
      </ol>
      <p class="mt-5 text-lg"><strong>Why:</strong> {{ advice.science }}</p>
      <p class="mt-4 text-base text-k-accent">{{ advice.caution }}</p>
    </article>

    <section class="mt-8 border-t border-k-rule pt-6" aria-labelledby="rescue-substitutions-heading">
      <h3 id="rescue-substitutions-heading" class="text-2xl font-serif">Missing an ingredient?</h3>
      <p class="mt-1 text-base text-k-muted">Instant culinary substitutions with conversion ratios and moisture adjustments.</p>
      <div v-if="props.ingredients?.length" class="mt-3 flex flex-wrap gap-2" role="group" aria-label="Recipe ingredients to substitute">
        <button
          v-for="ing in props.ingredients"
          :key="ing"
          type="button"
          class="kitchen-button text-base min-h-11"
          :disabled="subBusy"
          @click="subIngredient = ing; findSubstitutes(ing)"
        >{{ ing }}</button>
      </div>
      <form class="mt-3 flex gap-2" @submit.prevent="findSubstitutes()">
        <input
          v-model="subIngredient"
          type="text"
          class="kitchen-input flex-1 min-h-11"
          aria-label="Ingredient to substitute"
          placeholder="Or type an ingredient (e.g. Wine, Butter, Garlic)"
          maxlength="200"
        >
        <button
          type="submit"
          class="kitchen-button min-h-11 whitespace-nowrap"
          :disabled="subBusy || !subIngredient.trim()"
        >{{ subBusy ? 'Checking…' : 'Find swap' }}</button>
      </form>
      <p v-if="subError" role="alert" class="mt-3 text-base text-k-accent">{{ subError }}</p>
      <div class="mt-4 space-y-3" aria-live="polite">
        <template v-if="subResult">
          <p class="text-base text-k-muted">Instead of {{ subTarget }} · {{ subResult.mode === 'live' ? 'AI advice — verify before cooking.' : 'Instant offline culinary rules.' }}</p>
          <article v-for="option in subResult.options" :key="option.name" class="rounded-xl border border-k-accent p-4">
            <h4 class="font-serif text-xl font-bold">{{ option.name }}</h4>
            <p class="mt-1 text-lg">{{ option.ratio }}</p>
            <p class="mt-1 text-base text-k-muted">{{ option.science }}</p>
            <p class="mt-2 text-base">{{ option.adjustment }}</p>
          </article>
        </template>
      </div>
    </section>

    <form class="mt-6 space-y-3" @submit.prevent="ask">
      <label class="block text-lg">Describe another problem<textarea
          v-model="problem"
          class="kitchen-input mt-2"
          rows="3"
          required
          minlength="3"
          maxlength="3000"
        /></label>
      <button
        class="kitchen-button"
        :disabled="busy || !ready"
        v-stable-action="state"
        :data-state="state"
        :aria-busy="busy"
      >{{ label('Get rescue advice', 'Checking…') }}</button>
    </form>

    <p v-if="error" role="alert" class="mt-4 text-lg text-k-accent">{{ error }}</p>
  </dialog>
</template>
