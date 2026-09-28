<script setup lang="ts">
useSeoMeta({
  title: 'Heirloom — Recipes worth passing down',
  description: 'Your family cookbook and kitchen companion. Preserve the recipes, stories, and small details that make a meal yours.'
})
const pillars = [
  { id: 'cookbook', icon: 'i-lucide-book-open', eyebrow: 'Living Cookbook', title: 'Every family recipe, cook-ready', body: 'Import from a link, a video or memory. Scale servings, swap salts and cook step by step with the food science one tap away.', to: '/recipes', cta: 'Browse your recipes', tone: 'bg-terracotta/10 text-terracotta-ink' },
  { id: 'conductor', icon: 'i-lucide-alarm-clock', eyebrow: 'Dinner Conductor', title: 'Every course lands on time', body: 'Pick your menu and when guests sit down. Heirloom works backwards, flags oven and burner clashes and suggests workarounds.', to: '/meal-plan', cta: 'Plan a dinner', tone: 'bg-sage/15 text-sage-ink' },
  { id: 'market', icon: 'i-lucide-shopping-basket', eyebrow: 'Greek Market', title: 'One list, routed stall by stall', body: 'Shop the laiki, the butcher and the bakery in order, with Greek counter phrases and package sizes to buy.', to: '/meal-plan', cta: 'Build a market list', tone: 'bg-olive/15 text-olive-ink' }
]
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
  <section aria-labelledby="pillars-title" class="border-b border-rule py-12 sm:py-16">
    <h2 id="pillars-title" class="font-serif text-3xl">Three ways Heirloom helps</h2>
    <ul class="mt-8 grid gap-5 md:grid-cols-3">
      <li v-for="pillar in pillars" :key="pillar.id" class="flex min-w-0 flex-col rounded-xl border border-rule bg-paper-2/60 p-6">
        <span class="inline-flex size-11 items-center justify-center rounded-full" :class="pillar.tone" aria-hidden="true"><UIcon :name="pillar.icon" class="size-5" /></span>
        <p class="meta-label mt-5">{{ pillar.eyebrow }}</p>
        <h3 class="mt-1 font-serif text-2xl leading-snug">{{ pillar.title }}</h3>
        <p class="mt-3 flex-1 leading-relaxed text-muted">{{ pillar.body }}</p>
        <NuxtLink :to="pillar.to" class="text-action mt-4 self-start">{{ pillar.cta }}<UIcon name="i-lucide-arrow-right" class="ml-1.5" aria-hidden="true" /><span class="sr-only"> · {{ pillar.eyebrow }}</span></NuxtLink>
      </li>
    </ul>
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
