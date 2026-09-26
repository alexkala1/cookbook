<template>
  <div class="min-h-screen bg-stone-950 text-stone-50">
    <header class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6">
      <span class="font-serif text-2xl">Heirloom / Kitchen</span>
      <NuxtLink to="/" class="rounded border border-stone-500 px-5 py-3 text-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
        Exit kitchen
      </NuxtLink>
    </header>
    <main id="main-content" tabindex="-1" class="mx-auto max-w-5xl px-6 py-10 text-2xl leading-relaxed sm:text-3xl">
      <slot />
    </main>
  </div>
</template>
