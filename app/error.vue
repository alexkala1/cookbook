<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

const is404 = computed(() => props.error?.statusCode === 404)
const title = computed(() => is404.value ? 'Recipe Not Found' : 'Dish Dropped')
const message = computed(() => {
  if (is404.value) return 'This recipe or page seems to have wandered off the pantry shelf.'
  return props.error?.statusMessage || props.error?.message || 'Something unexpected happened in the kitchen. Don’t worry, your recipes and pantry items are safe.'
})

function handleClear() {
  clearError({ redirect: '/' })
}
function reloadPage() {
  if (typeof window !== 'undefined') {
    window.location.reload()
  }
}
</script>

<template>
  <div class="min-h-screen bg-cream text-espresso flex items-center justify-center p-6 selection:bg-terracotta/20">
    <main class="max-w-md w-full rounded-2xl border border-rule bg-paper p-8 shadow-xl text-center space-y-6">
      <div class="mx-auto flex size-16 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
        <UIcon :name="is404 ? 'i-lucide-utensils-crossed' : 'i-lucide-soup'" class="size-8" aria-hidden="true" />
      </div>
      <div class="space-y-2">
        <p class="font-mono text-xs uppercase tracking-wider text-muted num">{{ error?.statusCode || 500 }} error</p>
        <h1 class="font-serif text-3xl font-semibold text-ink">{{ title }}</h1>
        <p class="text-sm text-muted leading-relaxed">{{ message }}</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-3 justify-center pt-2">
        <button
          type="button"
          class="button-primary min-h-11 min-w-11 inline-flex items-center justify-center gap-2"
          @click="handleClear"
        >
          <UIcon name="i-lucide-home" class="size-4" aria-hidden="true" />
          Back to Kitchen
        </button>
        <button
          type="button"
          class="button-secondary min-h-11 min-w-11 inline-flex items-center justify-center gap-2"
          @click="reloadPage"
        >
          <UIcon name="i-lucide-rotate-ccw" class="size-4" aria-hidden="true" />
          Reload
        </button>
      </div>
    </main>
  </div>
</template>
