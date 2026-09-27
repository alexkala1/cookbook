<script setup lang="ts">
import { appTabs, isTabActive } from '../utils/navigation'
const route = useRoute()
</script>
<template>
  <!-- Pure navigation: loading, error, and success states do not apply. -->
  <nav class="tab-bar" aria-label="Main">
    <NuxtLink v-for="tab in appTabs" :key="tab.to" :to="tab.to" class="tab" :aria-current="isTabActive(route.path, tab.to) ? 'page' : undefined">
      <UIcon :name="tab.icon" class="size-6" aria-hidden="true" /><span>{{ tab.label }}</span>
    </NuxtLink>
  </nav>
</template>
<style>
.tab-bar { position: fixed; inset-inline: 0; bottom: 0; z-index: 30; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); padding-bottom: env(safe-area-inset-bottom); padding-inline: env(safe-area-inset-left) env(safe-area-inset-right); background: var(--color-paper); border-top: 1px solid var(--color-rule); }
.tab { min-height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: var(--color-muted); font: 600 .75rem/1 var(--font-sans); white-space: nowrap; -webkit-tap-highlight-color: transparent; }
.tab[aria-current='page'] { color: var(--color-terracotta-ink); box-shadow: inset 0 2px 0 var(--color-terracotta-ink); }
.tab:active { background: var(--color-paper-3); }
@media (hover: hover) { .tab:hover { color: var(--color-ink); } }
.tab:focus-visible { outline: 2px solid var(--color-focus); outline-offset: -4px; }
@media (min-width: 48rem) { .tab-bar { display: none; } }
@media (max-width: 47.99rem) { body:has(:is(input:not([type='checkbox'], [type='radio']), textarea, select):focus) .tab-bar { display: none; } }
</style>
