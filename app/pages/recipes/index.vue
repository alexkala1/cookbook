<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import type { Recipe } from '../../../shared/types/recipe'

useSeoMeta({ title: 'Your recipes — Heirloom' })
const search = ref('')
const delayedSearch = refDebounced(search, 250)
const type = ref('')
const favorites = ref(false)
const filters = [{ label: 'All', value: '' }, { label: 'Food', value: 'food' }, { label: 'Drinks', value: 'drinks' }, { label: 'Baking', value: 'baking' }, { label: 'Desserts', value: 'dessert' }]
const query = computed(() => ({ ...(delayedSearch.value ? { search: delayedSearch.value } : {}), ...(type.value ? { type: type.value } : {}), ...(favorites.value ? { isFavorite: 'true' } : {}) }))
const { data: recipes, status, error, refresh } = await useFetch<Recipe[]>('/api/recipes', { query })
const seeding = ref(false)
const seedError = ref('')
const seedFeedback = useActionFeedback(seeding, seedError)
async function loadStarters() {
  if (seeding.value) return
  seeding.value = true
  seedError.value = ''
  try {
    await $fetch('/api/recipes/seed', { method: 'POST' })
    await refresh()
  } catch {
    seedError.value = 'We couldn’t load the starter recipes. Please try again.'
  } finally {
    seeding.value = false
  }
}
</script>

<template>
  <section class="page-section">
    <div class="section-heading">
      <h1>Your recipe collection</h1>
      <div class="flex flex-wrap gap-3"><NuxtLink to="/recipes/import" class="button-secondary">Import Recipe</NuxtLink><NuxtLink to="/recipes/new" class="button-primary">+ New Recipe</NuxtLink></div>
    </div>
    <label class="mt-10 block max-w-xl">Search recipes
      <input v-model="search" type="search" class="field mt-2" placeholder="A dish, a drink, a family favourite…" maxlength="200">
    </label>
    <div class="my-6 flex flex-wrap items-center gap-2" aria-label="Recipe filters">
      <button v-for="filter in filters" :key="filter.value" type="button" class="filter-pill" :aria-pressed="type === filter.value" @click="type = filter.value">{{ filter.label }}</button>
      <button type="button" class="filter-pill" :aria-pressed="favorites" @click="favorites = !favorites"><UIcon name="i-lucide-heart" :class="{ 'fill-current': favorites }" aria-hidden="true" /> Favorites</button>
    </div>
    <p v-if="status === 'pending'" role="status" class="py-10">Opening your cookbook…</p>
    <div v-else-if="error" role="alert" class="notice"><p>We couldn’t load your recipes.</p><button class="button-secondary mt-4" @click="refresh()">Try again</button></div>
    <div v-else-if="!recipes?.length" class="empty-state">
      <h2>{{ search || type || favorites ? 'No recipes match just yet.' : 'Every collection starts with one recipe.' }}</h2>
      <p class="mt-4">{{ search || type || favorites ? 'Try another search or clear your filters.' : 'Save a family favourite, a weekend bake, or your signature drink.' }}</p>
      <button v-if="search || type || favorites" class="button-secondary mt-6" @click="search = ''; type = ''; favorites = false">Clear filters</button>
      <div v-else class="mt-6 flex flex-wrap gap-3">
        <button v-stable-action type="button" class="button-primary starter-button inline-flex items-center" :data-state="seedFeedback.state.value" :disabled="seeding" :aria-busy="seeding" @click="loadStarters">
          <UIcon name="i-lucide-sprout" class="size-5" aria-hidden="true" />
          {{ seedFeedback.label('Load Starter Heirloom Recipes', 'Loading recipes…') }}
        </button>
        <NuxtLink to="/recipes/new" class="button-secondary">Write your first recipe</NuxtLink>
      </div>
      <p v-if="seedError" role="alert" class="mt-4 text-error">{{ seedError }}</p>
    </div>
    <div v-else class="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      <article v-for="recipe in recipes" :key="recipe.id" class="min-w-0 border-b border-espresso/20 pb-6">
          <div class="mb-5 flex aspect-[4/3] items-center justify-center overflow-hidden bg-sage/10">
            <img v-if="recipe.imageUrl" :src="recipe.imageUrl" :alt="recipe.title" loading="lazy" class="h-full w-full object-cover">
            <span v-else class="font-serif text-4xl text-sage">{{ recipe.recipeType === 'cocktail' || recipe.recipeType === 'drink' ? 'To good company.' : 'Made with care.' }}</span>
          </div>
          <p class="meta-label">{{ recipe.recipeType }} <UIcon v-if="recipe.isFavorite" name="i-lucide-heart" class="fill-current" aria-label="Favorite" /></p>
          <h2 class="mt-3 min-w-0 text-3xl"><NuxtLink :to="'/recipes/' + recipe.id" class="recipe-title-link" :title="recipe.title">{{ recipe.title }}</NuxtLink></h2>
        <p class="mt-3 line-clamp-2 break-words">{{ recipe.description }}</p>
        <p class="mt-5 text-sm">{{ recipe.totalTimeMinutes }} min · {{ recipe.servings }} servings · {{ recipe.difficulty }}</p>
      </article>
    </div>
  </section>
</template>
<style scoped>
.starter-button { white-space: normal; text-align: center; }
.recipe-title-link { display: block; min-height: 44px; line-height: 44px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (hover: hover) { .recipe-title-link:hover { text-decoration: underline; } }
</style>
