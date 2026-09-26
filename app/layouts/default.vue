<template>
  <div class="min-h-screen bg-cream text-espresso">
    <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:bg-white focus:p-4 focus:text-stone-900">
      Skip to content
    </a>
    <header class="border-b border-stone-200">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-6 py-6 sm:px-10">
        <NuxtLink to="/" class="font-serif text-3xl tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800" aria-label="Heirloom home">
          Heirloom<span class="text-emerald-800">.</span>
        </NuxtLink>
        <nav aria-label="Main navigation" class="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
          <NuxtLink to="/" exact-active-class="underline" class="font-semibold underline-offset-8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sage">
            Home
          </NuxtLink>
          <NuxtLink to="/recipes" active-class="underline" class="font-semibold underline-offset-8">Recipes</NuxtLink>
          <NuxtLink to="/recipes/import" active-class="underline" class="font-semibold underline-offset-8">Import Recipe</NuxtLink>
          <NuxtLink to="/settings" active-class="underline" class="font-semibold underline-offset-8">Settings</NuxtLink>
          <NuxtLink to="/pantry" active-class="underline" class="font-semibold underline-offset-8">Pantry</NuxtLink>
          <span aria-disabled="true" class="text-stone-500">Shopping · soon</span>
        </nav>
      </div>
    </header>
    <main id="main-content" tabindex="-1" class="mx-auto max-w-6xl px-6 sm:px-10">
      <slot />
    </main>
    <footer class="mx-auto max-w-6xl px-6 py-8 text-sm text-stone-600 sm:px-10">
      A place for recipes worth passing down.
    </footer>
  </div>
</template>
