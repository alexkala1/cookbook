<script setup lang="ts">
useSeoMeta({
  title: 'Heirloom — Recipes worth passing down',
  description: 'Your family cookbook and kitchen companion. Preserve the recipes, stories, and small details that make a meal yours.'
})
</script>

<template>
  <section aria-labelledby="hero-title" class="grid gap-12 border-b border-stone-200 py-16 sm:py-24 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
    <div>
      <p class="mb-6 text-sm font-semibold uppercase tracking-widest text-emerald-800">The family cookbook, reimagined</p>
      <h1 id="hero-title" class="max-w-3xl font-serif text-5xl leading-tight tracking-tight sm:text-7xl">
        Good food.<br>Stories worth keeping.
      </h1>
      <p class="mt-8 max-w-xl text-lg leading-relaxed text-stone-600">
        Keep the handwritten favourites, the Sunday rituals, and the little details that never made it onto the recipe card. Make them part of your everyday kitchen.
      </p>
      <UButton to="#cookbook" color="neutral" size="xl" trailing-icon="i-lucide-arrow-down" class="mt-8 rounded-full bg-emerald-900 px-6 text-white hover:bg-emerald-800">
        A look inside
      </UButton>
    </div>
    <aside class="border-l-2 border-emerald-800 pl-6">
      <p class="font-serif text-2xl">More than ingredients.</p>
      <p class="mt-4 leading-relaxed text-stone-600">The why behind each step. The right tool for your kitchen. A shopping list that knows your local market.</p>
      <p class="mt-6 text-sm font-semibold text-emerald-800">Taking shape, one recipe at a time.</p>
    </aside>
  </section>
  <section id="cookbook" aria-labelledby="cookbook-title" class="py-12 sm:py-16">
    <div class="flex flex-wrap items-center gap-4">
      <h2 id="cookbook-title" class="font-serif text-3xl">Your cookbook starts here</h2>
      <UBadge color="neutral" variant="outline">Coming soon</UBadge>
    </div>
    <p class="mt-4 max-w-2xl leading-relaxed text-stone-600">Recipe saving, pantry tracking, and guided cooking are on their way. This is the first page of Heirloom; your collection will have a home here.</p>
  </section>
</template>
