<script setup lang="ts">
const props = defineProps<{ ingredient: string, context: string }>()
const dialog = ref<HTMLDialogElement>()
const { requestHeaders } = useByokSettings()
const busy = ref(false), error = ref('')
const { state, label } = useActionFeedback(busy, error)
const options = ref<{ name: string, ratio: string, science: string, adjustment: string }[]>([])
const mode = ref<'live' | 'fallback'>('fallback')
let controller: AbortController | undefined
onBeforeUnmount(() => controller?.abort())
async function open() {
  controller = new AbortController()
  dialog.value?.showModal(); busy.value = true; error.value = ''; options.value = []
  try {
    const result = await $fetch<{ options: typeof options.value, mode: 'live' | 'fallback' }>('/api/ai/substitute', { method: 'POST', signal: controller.signal, headers: requestHeaders(), body: { ingredientName: props.ingredient, recipeContext: props.context.slice(0, 10000) } })
    options.value = result.options
    mode.value = result.mode
  }
  catch { error.value = 'No reliable substitution found for this ingredient. Offline rules cover butter, olive oil, wine, garlic, onion, yogurt, egg, milk, and lemon; add an AI key in Settings for anything else.' }
  finally { busy.value = false }
}
</script>
<template>
  <button
    type="button"
    class="sub-trigger"
    :aria-label="'Culinary substitutions for ' + ingredient"
    title="Culinary substitutions"
    :disabled="busy"
    :data-state="state"
    :aria-busy="busy"
    @click="open"
  ><UIcon name="i-lucide-arrow-left-right" class="size-[18px]" aria-hidden="true" /></button>
  <dialog ref="dialog" class="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl bg-cream p-6 text-espresso backdrop:bg-ink/40" :aria-label="'Substitutions for ' + ingredient" @close="controller?.abort()">
    <form method="dialog"><button class="button-secondary float-right" autofocus>Close</button></form>
    <h2 class="pr-20">Instead of {{ ingredient }}</h2>
    <p v-if="busy" role="status" class="mt-5">Checking culinary alternatives…</p>
    <p v-if="error" role="alert" class="notice mt-5">{{ error }}</p>
    <p v-if="!busy && !error && mode === 'fallback'" class="mt-2 text-xs text-muted">Offline culinary rule · Add an AI key in Settings for live custom substitutions.</p>
    <p v-if="!busy && !error && mode === 'live'" class="mt-2 text-xs text-muted">Tailored by your AI model · Verify before cooking.</p>
    <article v-for="option in options" :key="option.name" class="mt-6 border-t border-espresso/20 pt-4"><h3 class="font-serif text-2xl">{{ option.name }}</h3><p class="mt-2">{{ option.ratio }}</p><p class="mt-2">{{ option.science }}</p><p class="notice mt-3">{{ option.adjustment }}</p></article>
    <p class="mt-5 text-sm">Review the ingredient’s role in this recipe and check allergen labels. Suggestions do not change your recipe.</p>
  </dialog>
</template>

<style>
/* Quiet per-ingredient trigger: revealed on row hover/focus for pointer users, always present (muted) on touch. */
.sub-trigger { display: inline-grid; flex: none; width: 44px; height: 44px; place-items: center; border-radius: 999px; color: var(--color-muted); }
.sub-trigger:active { background: var(--color-paper-3); }
.sub-trigger:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; opacity: 1; }
.sub-trigger:disabled { opacity: .45; cursor: not-allowed; }
.sub-trigger[data-state='loading'] { cursor: progress; }
.sub-trigger[data-state='error'] { color: var(--color-error); }
@media (hover: hover) and (pointer: fine) {
  .sub-trigger { opacity: 0; transition: opacity var(--dur-short) var(--ease-out); }
  .ingredient-row:hover .sub-trigger, .ingredient-row:focus-within .sub-trigger { opacity: 1; }
  .sub-trigger:hover { background: var(--color-paper-2); color: var(--color-ink); }
}
@media (prefers-reduced-motion: reduce) { .sub-trigger { transition: none; } }
</style>
