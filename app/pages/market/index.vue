<script setup lang="ts">
import { parseServings } from '../../utils/display-units'

type RecipeRow = { id: string, title: string, servings: number }
useSeoMeta({ title: 'Market list — Heirloom' })
const route = useRoute()
const router = useRouter()
const { data: recipes, status, error: loadError, refresh } = await useFetch<RecipeRow[]>('/api/recipes')

// Shopping for a single recipe: ?recipeId=&servings= arrive from the recipe page, or the cook picks one here.
const queryId = typeof route.query.recipeId === 'string' ? route.query.recipeId : ''
const selectedId = ref(recipes.value?.some(row => row.id === queryId) ? queryId : '')
const unknownRecipe = queryId !== '' && selectedId.value === ''
const selected = computed(() => recipes.value?.find(row => row.id === selectedId.value))
const queryServings = parseServings(route.query.servings)
const servings = ref(Math.max(1, Math.round(queryServings ?? selected.value?.servings ?? 4)))

function choose(id: string) {
  selectedId.value = id
  servings.value = recipes.value?.find(row => row.id === id)?.servings ?? 4
  sync()
}
function commitServings(event: Event) {
  const value = Math.round(Number((event.target as HTMLInputElement).value))
  servings.value = Number.isFinite(value) ? Math.min(1000, Math.max(1, value)) : servings.value
  ;(event.target as HTMLInputElement).value = String(servings.value)
  sync()
}
function sync() {
  void router.replace({ query: selectedId.value ? { recipeId: selectedId.value, servings: servings.value } : {} })
}
const courses = computed(() => selected.value ? [{ recipeId: selected.value.id, course: 'main' as const }] : [])
</script>

<template>
  <section class="page-section">
    <h1 class="mt-3">Market list</h1>
    <p class="mt-4 max-w-2xl">Pick a recipe and we’ll sort what to buy by where to shop: the laiki, the butcher, the bakery and the supermarket. No dinner plan needed.</p>

    <p v-if="status === 'pending'" role="status" class="py-10">Opening your cookbook…</p>
    <div v-else-if="loadError" role="alert" class="notice mt-8">
      <p>We couldn’t load your recipes.</p>
      <button class="button-secondary mt-4" @click="refresh()">Try again</button>
    </div>
    <div v-else-if="!recipes?.length" class="empty-state mt-8">
      <h2>Add a recipe first.</h2>
      <p class="mt-4">The market list is built from a recipe in your cookbook.</p>
      <NuxtLink to="/recipes/new" class="button-primary mt-6">Write a recipe</NuxtLink>
    </div>
    <template v-else>
      <p v-if="unknownRecipe" role="alert" class="notice mt-6">We couldn’t find that recipe. Choose another below.</p>
      <div class="row-panel mt-8 grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <label class="block min-w-0">Recipe
          <select class="field mt-2" :value="selectedId" @change="choose(($event.target as HTMLSelectElement).value)">
            <option value="" disabled>Choose a recipe…</option>
            <option v-for="recipe in recipes" :key="recipe.id" :value="recipe.id">{{ recipe.title }}</option>
          </select>
        </label>
        <label class="block">Servings
          <input class="field mt-2" type="number" min="1" max="1000" step="1" :value="servings" :disabled="!selected" @change="commitServings">
        </label>
      </div>
      <p v-if="selected && servings !== selected.servings" class="mt-3 text-sm text-muted">Quantities are scaled from the recipe’s {{ selected.servings }} servings.</p>
      <p v-if="!selected" class="empty-state mt-8">Choose a recipe to see where to shop for it.</p>
      <MarketShoppingList v-else :key="selected.id + ':' + servings" class="mt-10" :courses="courses" :servings="servings" servings-noun="servings" auto-generate />
    </template>
  </section>
</template>
