<script setup lang="ts">
import { appTabs, isTabActive } from '../utils/navigation'
const route = useRoute()
</script>
<template>
  <header class="app-top-bar">
    <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4">
      <NuxtLink to="/" class="wordmark" aria-label="Heirloom home">Heirloom<span class="text-terracotta-ink">.</span></NuxtLink>
      <!-- Pure navigation: loading, error, and success states do not apply. -->
      <nav aria-label="Main" class="hidden items-center gap-4 md:flex">
        <NuxtLink v-for="tab in appTabs" :key="tab.to" :to="tab.to" class="top-link" :aria-current="isTabActive(route.path, tab.to) ? 'page' : undefined">{{ tab.label }}</NuxtLink>
      </nav>
    </div>
  </header>
</template>
<style scoped>
.app-top-bar { position: sticky; top: 0; z-index: 30; background: var(--color-paper); border-bottom: 1px solid var(--color-rule); padding-top: env(safe-area-inset-top); padding-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right)); }
.wordmark { display: inline-flex; align-items: center; min-height: 44px; font: 700 1.5rem var(--font-display); white-space: nowrap; }
.top-link { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; min-width: 44px; padding-inline: .25rem; font-weight: 600; font-size: .875rem; white-space: nowrap; border-bottom: 2px solid transparent; }
.top-link[aria-current='page'] { border-color: var(--color-terracotta-ink); }
.top-link:active, .wordmark:active { background: var(--color-paper-3); }
@media (hover: hover) { .top-link:hover, .wordmark:hover { color: var(--color-terracotta-ink); } }
</style>
