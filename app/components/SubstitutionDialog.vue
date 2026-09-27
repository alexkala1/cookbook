<script setup lang="ts">
const props = defineProps<{ ingredient: string, context: string }>()
const dialog = ref<HTMLDialogElement>()
const { requestHeaders, ready } = useByokSettings()
const busy = ref(false), error = ref('')
const { state, label } = useActionFeedback(busy, error)
const options = ref<{ name: string, ratio: string, science: string, adjustment: string }[]>([])
let controller: AbortController | undefined
onBeforeUnmount(() => controller?.abort())
async function open() {
  controller = new AbortController()
  dialog.value?.showModal(); busy.value = true; error.value = ''; options.value = []
  try { const result = await $fetch<{ options: typeof options.value }>('/api/ai/substitute', { method: 'POST', signal: controller.signal, headers: requestHeaders(), body: { ingredientName: props.ingredient, recipeContext: props.context.slice(0, 10000) } }); options.value = result.options }
  catch { error.value = 'Could not suggest a reliable substitution. Check AI settings. Offline options cover butter, egg, milk, and lemon.' }
  finally { busy.value = false }
}
</script>
<template>
  <button class="button-secondary mt-2 text-sm" :disabled="!ready || busy" @click="open" v-stable-action="state" :data-state="state" :aria-busy="busy">{{ label('Ask AI for Substitution', 'Checking…') }}<span class="sr-only"> for {{ ingredient }}</span></button>
  <dialog ref="dialog" class="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl bg-cream p-6 text-espresso backdrop:bg-ink/40" :aria-label="'Substitutions for ' + ingredient" @close="controller?.abort()">
    <form method="dialog"><button class="button-secondary float-right" autofocus>Close</button></form>
    <h2 class="pr-20">Instead of {{ ingredient }}</h2>
    <p v-if="busy" role="status" class="mt-5">Checking culinary alternatives…</p>
    <p v-if="error" role="alert" class="notice mt-5">{{ error }}</p>
    <article v-for="option in options" :key="option.name" class="mt-6 border-t border-espresso/20 pt-4"><h3 class="font-serif text-2xl">{{ option.name }}</h3><p class="mt-2">{{ option.ratio }}</p><p class="mt-2">{{ option.science }}</p><p class="notice mt-3">{{ option.adjustment }}</p></article>
    <p class="mt-5 text-sm">Review the ingredient’s role in this recipe and check allergen labels. Suggestions do not change your recipe.</p>
  </dialog>
</template>
