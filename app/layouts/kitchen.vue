<script setup lang="ts">
import type { RecipeDetail } from '#shared/types/recipe'
const route = useRoute()
// Resolve before rendering the layout so SSR and hydration share the same title.
const { data: recipe } = await useFetch<RecipeDetail>(() => '/api/recipes/' + String(route.params.id))
const title = computed(() => recipe.value?.title || 'Kitchen')
</script>
<template>
  <div class="kitchen-shell min-h-dvh bg-k-paper text-k-ink">
    <header class="kitchen-top">
      <div class="mx-auto grid h-14 max-w-5xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <NuxtLink :to="'/recipes/' + $route.params.id" class="kitchen-button" aria-label="Exit kitchen"><UIcon name="i-lucide-x" aria-hidden="true" />Exit</NuxtLink>
        <span class="truncate text-center font-display text-base" :title="title">{{ title }}</span>
        <div id="kitchen-rescue-dock" />
      </div>
      <div id="kitchen-progress" />
    </header>
    <main id="main-content" tabindex="-1" class="mx-auto max-w-5xl px-4 pt-6 text-2xl leading-relaxed sm:px-6">
      <slot />
    </main>
  </div>
</template>
<style>
.kitchen-shell { overflow-wrap: anywhere; }
.kitchen-shell main { padding-bottom: calc(5.5rem + env(safe-area-inset-bottom)); }
.kitchen-top { position: sticky; top: 0; z-index: 30; padding-top: env(safe-area-inset-top); padding-inline: max(.5rem, env(safe-area-inset-left)) max(.5rem, env(safe-area-inset-right)); background: var(--color-k-paper); }
.kitchen-step { font-size: clamp(2rem, 4vw, 3rem); line-height: 1.5; overflow-wrap: anywhere; }
.kitchen-panel { margin-top: 2rem; border-top: 1px solid var(--color-k-rule); padding-top: 1.5rem; }
.kitchen-input { display: block; width: 100%; min-width: 0; min-height: 48px; border: 1px solid var(--color-k-rule); border-radius: .5rem; background: var(--color-k-paper-2); color: var(--color-k-ink); padding: .65rem; font-size: 1.125rem; }
.kitchen-input:focus-visible, .rescue-trigger:focus-visible { outline: 3px solid var(--color-k-accent); outline-offset: 3px; }
.rescue-trigger { min-height: 48px; display: inline-flex; align-items: center; gap: .35rem; white-space: nowrap; border: 1px solid var(--color-k-danger-ink); border-radius: .75rem; background: var(--color-k-danger); color: var(--color-k-danger-ink); padding: .5rem .65rem; font-size: .875rem; font-weight: 600; }
.rescue-drawer { position: fixed; inset: 0 0 0 auto; margin: 0; width: min(100%, 42rem); height: 100dvh; max-height: 100dvh; max-width: 100%; padding: max(1.5rem, env(safe-area-inset-top)) 1.5rem max(1.5rem, env(safe-area-inset-bottom)); overflow-y: auto; background: var(--color-k-paper); color: var(--color-k-ink); }
.rescue-drawer::backdrop { background: color-mix(in srgb, var(--color-k-paper) 75%, transparent); }
</style>
