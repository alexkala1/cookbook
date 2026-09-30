<template>
  <div class="min-h-dvh bg-paper text-ink pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
    <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:z-40 focus:bg-paper focus:p-4 focus:text-ink">
      Skip to content
    </a>
    <AppTopBar />
    <main id="main-content" tabindex="-1" class="mx-auto max-w-6xl px-6 sm:px-10">
      <slot />
    </main>
    <footer class="mx-auto max-w-6xl px-6 py-8 text-sm text-muted sm:px-10">
      A place for recipes worth passing down.
    </footer>
    <AppTabBar />
  </div>
</template>
