<script setup lang="ts">
// Pages that are dense by nature (like the market list) opt in with definePageMeta({ wide: true }).
const route = useRoute()
const width = computed(() => route.meta.wide ? 'max-w-[96rem]' : 'max-w-6xl')
</script>

<template>
  <div class="min-h-dvh bg-paper text-ink pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
    <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:z-40 focus:bg-paper focus:p-4 focus:text-ink">
      Skip to content
    </a>
    <AppTopBar />
    <main id="main-content" tabindex="-1" class="mx-auto px-6 sm:px-10" :class="width">
      <slot />
    </main>
    <footer class="mx-auto px-6 py-8 text-sm text-muted sm:px-10" :class="width">
      A place for recipes worth passing down.
    </footer>
    <AppTabBar />
  </div>
</template>
