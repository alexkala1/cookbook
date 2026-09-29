<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import type { Recipe } from '../../../shared/types/recipe'

useSeoMeta({ title: 'Your recipes — Heirloom' })

function familyNote(notes?: string | null) {
  const first = notes?.split('.')[0]?.trim()
  return first ? '“' + first + '.”' : ''
}
const search = ref('')
const delayedSearch = refDebounced(search, 250)
const type = ref('')
const favorites = ref(false)
const filters = [{ label: 'All', value: '' }, { label: 'Food', value: 'food' }, { label: 'Drinks', value: 'drinks' }, { label: 'Baking', value: 'baking' }, { label: 'Desserts', value: 'dessert' }]
// Editorial banner for cards without a photo, keyed to the recipe category.
const banners = {
  food: { label: 'Food', icon: 'i-lucide-cooking-pot', line: 'From the family table', tone: 'food' },
  drinks: { label: 'Drinks', icon: 'i-lucide-martini', line: 'To good company', tone: 'drinks' },
  baking: { label: 'Baking', icon: 'i-lucide-croissant', line: 'Warm from the oven', tone: 'baking' },
  dessert: { label: 'Desserts', icon: 'i-lucide-cake-slice', line: 'Something sweet to finish', tone: 'dessert' }
}
const bannerFor = (recipeType: string) => recipeType === 'drink' || recipeType === 'cocktail' ? banners.drinks : banners[recipeType as keyof typeof banners] ?? banners.food
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
        <button v-stable-action type="button" class="button-primary starter-button inline-flex items-center" aria-label="Load Starter Heirloom Recipes — Fill your cookbook with family classics" :data-state="seedFeedback.state.value" :disabled="seeding" :aria-busy="seeding" @click="loadStarters">
          <UIcon name="i-lucide-book-heart" class="size-5" aria-hidden="true" />
          {{ seedFeedback.label('Fill your cookbook with family classics', 'Loading family classics…') }}
        </button>
        <NuxtLink to="/recipes/new" class="button-secondary">Write your first recipe</NuxtLink>
      </div>
      <p v-if="seedError" role="alert" class="mt-4 text-error">{{ seedError }}</p>
    </div>
    <div v-else class="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      <article v-for="recipe in recipes" :key="recipe.id" class="min-w-0 border-b border-espresso/20 pb-6">
          <div v-if="recipe.imageUrl" class="mb-5 aspect-[4/3] overflow-hidden bg-sage/10">
            <img :src="recipe.imageUrl" :alt="recipe.title" loading="lazy" class="h-full w-full object-cover">
          </div>
          <div v-else class="category-banner mb-5" :class="'category-banner--' + bannerFor(recipe.recipeType).tone" aria-hidden="true">
            <UIcon :name="bannerFor(recipe.recipeType).icon" class="category-banner__watermark" />
            <span class="category-banner__eyebrow"><UIcon :name="bannerFor(recipe.recipeType).icon" class="size-4" />{{ bannerFor(recipe.recipeType).label }}</span>
            <span class="category-banner__line">{{ bannerFor(recipe.recipeType).line }}</span>
          </div>
          <p class="meta-label">{{ recipe.recipeType }} <UIcon v-if="recipe.isFavorite" name="i-lucide-heart" class="fill-current" aria-label="Favorite" /></p>
          <h2 class="mt-3 min-w-0 text-3xl"><NuxtLink :to="'/recipes/' + recipe.id" class="recipe-title-link" :title="recipe.title">{{ recipe.title }}</NuxtLink></h2>
        <p class="mt-3 line-clamp-2 break-words">{{ recipe.description }}</p>
        <p v-if="familyNote(recipe.heirloomNotes)" class="mt-2 line-clamp-1 break-words font-serif italic text-muted">{{ familyNote(recipe.heirloomNotes) }}</p>
        <p class="mt-5 text-sm">{{ recipe.totalTimeMinutes }} min · {{ recipe.servings }} servings · {{ recipe.difficulty }}</p>
      </article>
    </div>
  </section>
</template>
<style scoped>
.starter-button { white-space: normal; text-align: center; }
.recipe-title-link { display: block; min-height: 44px; line-height: 44px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (hover: hover) { .recipe-title-link:hover { text-decoration: underline; } }

/* Warm, editorial stand-in for recipe photos: category gradient, oversized watermark icon, serif line. */
.category-banner { --tone: var(--color-sage); position: relative; display: flex; aspect-ratio: 4 / 3; flex-direction: column; justify-content: space-between; overflow: hidden; border-radius: .75rem; padding: 1.25rem; color: var(--color-ink); background: radial-gradient(120% 90% at 100% 0%, color-mix(in oklch, var(--tone) 30%, transparent), transparent 60%), linear-gradient(160deg, var(--color-paper-2), color-mix(in oklch, var(--tone) 22%, var(--color-paper))); box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--tone) 22%, transparent); }
.category-banner--food { --tone: var(--color-terracotta); }
.category-banner--drinks { --tone: var(--color-sage); }
.category-banner--baking { --tone: oklch(72% 0.11 75); }
.category-banner--dessert { --tone: oklch(66% 0.1 12); }
.category-banner__watermark { position: absolute; right: -8%; bottom: -12%; width: 62%; height: auto; aspect-ratio: 1; color: color-mix(in oklch, var(--tone) 55%, var(--color-ink)); opacity: .14; transform: rotate(-12deg); }
.category-banner__eyebrow { position: relative; display: inline-flex; align-self: flex-start; align-items: center; gap: .375rem; border-radius: 999px; background: color-mix(in oklch, var(--color-paper) 75%, transparent); padding: .25rem .75rem; font-size: .75rem; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: color-mix(in oklch, var(--tone) 45%, var(--color-ink)); }
.category-banner__line { position: relative; max-width: 80%; font-family: var(--font-serif); font-size: clamp(1.5rem, 3vw, 2rem); font-style: italic; line-height: 1.15; color: color-mix(in oklch, var(--tone) 35%, var(--color-ink)); }
</style>
