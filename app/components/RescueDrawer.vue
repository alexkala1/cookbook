<script setup lang="ts">
import { rescueGuides, rescueTriage, type RescueAdvice, type RescueIssue } from '#shared/culinary/rescue'
const props = defineProps<{ context: string, currentStep?: number }>()
const emit = defineEmits<{ open: [value: boolean] }>()
const dialog = ref<HTMLDialogElement>(), problem = ref(''), busy = ref(false), error = ref('')
const advice = ref<RescueAdvice>(rescueTriage('')), mode = ref('Instant offline guide')
const { requestHeaders, ready } = useByokSettings()
let controller: AbortController | undefined
function show() { dialog.value?.showModal(); emit('open', true) }
function close() { controller?.abort(); emit('open', false) }
function choose(issue: RescueIssue) { controller?.abort(); advice.value = { ...rescueGuides[issue], actions: [...rescueGuides[issue].actions] }; mode.value = 'Instant offline guide'; error.value = '' }
async function ask() {
  controller?.abort(); const request = new AbortController(); controller = request
  advice.value = rescueTriage(problem.value); mode.value = 'Offline triage while checking'; busy.value = true; error.value = ''
  try {
    const result = await $fetch<RescueAdvice & { mode: string }>('/api/ai/rescue', { method: 'POST', signal: request.signal, headers: requestHeaders(), body: { issueDescription: problem.value, recipeContext: props.context.slice(0, 10000), currentStep: props.currentStep } })
    if (!request.signal.aborted) { advice.value = result; mode.value = result.mode === 'live' ? 'AI advice — verify before acting' : 'Offline culinary guide' }
  } catch { if (!request.signal.aborted) { error.value = 'Custom advice unavailable. The offline guide remains available.'; mode.value = 'Offline culinary guide' } }
  finally { if (controller === request) busy.value = false }
}
onBeforeUnmount(() => controller?.abort())
</script>
<template>
  <ClientOnly><Teleport to="#kitchen-rescue-dock"><button class="rescue-trigger" @click="show">🚨 Rescue My Dish</button></Teleport></ClientOnly>
  <dialog ref="dialog" class="rescue-drawer" aria-label="Rescue My Dish" @close="close">
    <form method="dialog"><button class="kitchen-button float-right" autofocus>Close rescue</button></form>
    <h2 class="clear-both pt-5 text-3xl">Rescue My Dish</h2>
    <p class="mt-3 text-base">Quick guides work instantly, without a key or network request.</p>
    <div class="mt-5 flex flex-wrap gap-2"><button v-for="(guide, issue) in rescueGuides" v-show="issue !== 'unknown'" :key="issue" class="kitchen-button text-base" @click="choose(issue)">{{ guide.title }}</button></div>
    <article class="mt-6 rounded-xl border border-amber-300 p-5" aria-live="polite">
      <p class="text-sm text-amber-200">{{ mode }}</p><h3 class="mt-2 text-2xl font-semibold">{{ advice.title }}</h3>
      <ol class="mt-4 list-decimal space-y-3 pl-6 text-lg"><li v-for="action in advice.actions" :key="action">{{ action }}</li></ol>
      <p class="mt-5 text-lg"><strong>Why:</strong> {{ advice.science }}</p><p class="mt-4 text-base text-amber-200">{{ advice.caution }}</p>
    </article>
    <form class="mt-6 space-y-3" @submit.prevent="ask"><label class="block text-lg">Describe another problem<textarea v-model="problem" class="kitchen-input mt-2" rows="3" required minlength="3" maxlength="3000" /></label><button class="kitchen-button" :disabled="busy || !ready">{{ busy ? 'Checking…' : 'Get custom rescue advice' }}</button></form>
    <p v-if="error" role="alert" class="mt-4 text-lg text-amber-200">{{ error }}</p>
  </dialog>
</template>
