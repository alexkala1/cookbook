<script setup lang="ts">
useSeoMeta({
  title: 'Heirloom — Recipes worth passing down',
  description: 'Your family cookbook and kitchen companion. Preserve the recipes, stories, and small details that make a meal yours.'
})
</script>

<template>
  <section aria-labelledby="hero-title" class="grid gap-12 border-b border-rule py-16 sm:py-24 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
    <div>
      <h1 id="hero-title" class="max-w-3xl leading-tight tracking-tight">
        Good food.<br>Stories worth keeping.
      </h1>
      <p class="mt-8 max-w-xl text-lg leading-relaxed text-muted">
        Keep the handwritten favourites, the Sunday rituals, and the little details that never made it onto the recipe card. Make them part of your everyday kitchen.
      </p>
      <NuxtLink to="/recipes" class="button-primary mt-8">Open your cookbook <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
    </div>
    <aside class="border-l-2 border-sage pl-6">
      <p class="font-serif text-2xl">More than ingredients.</p>
      <p class="mt-4 leading-relaxed text-muted">The why behind each step. The right tool for your kitchen. A shopping list that knows your local market.</p>
      <p class="mt-6 text-sm font-semibold text-sage-ink">Taking shape, one recipe at a time.</p>
    </aside>
  </section>
  <section id="cookbook" aria-labelledby="cookbook-title" class="py-12 sm:py-16">
    <div class="flex flex-wrap items-center gap-4">
      <h2 id="cookbook-title" class="font-serif text-3xl">Your cookbook starts here</h2>
    </div>
    <p class="mt-4 max-w-2xl leading-relaxed text-muted">Save a favourite dish or drink, adjust it for your table, and keep the stories that make it yours.</p>
    <div class="mt-5 flex flex-wrap gap-5"><NuxtLink to="/recipes/new" class="text-action">Write a recipe →</NuxtLink>
    <NuxtLink to="/recipes/import" class="button-secondary">Import Recipe</NuxtLink></div>
  </section>
</template>
