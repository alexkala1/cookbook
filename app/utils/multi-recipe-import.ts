import type { RecipeInput } from '../../server/utils/validation'

export type ImportComplete = { recipe?: RecipeInput, recipes?: RecipeInput[] }
export type SaveAllResult = { saved: number, failed: number, remaining: RecipeInput[] }

/** Older servers send one `recipe`; a multi-recipe source sends `recipes`. Either way the page gets a list. */
export function importedRecipes(data: ImportComplete, photo = ''): RecipeInput[] {
  const list = data.recipes && data.recipes.length > 0 ? data.recipes : data.recipe ? [data.recipe] : []
  // A photographed card is kept with every recipe read from it, unless the recipe already has its own image.
  return list.map(recipe => photo && !recipe.imageUrl ? { ...recipe, imageUrl: photo } : recipe)
}

/** The index to show after the cook picks one; anything outside the list leaves the choice alone. */
export function switchTo(count: number, current: number, next: unknown): number {
  return typeof next === 'number' && Number.isInteger(next) && next >= 0 && next < count ? next : current
}

/** The list with one recipe replaced (for example by its translation); other recipes are untouched. */
export function replaceAt(recipes: readonly RecipeInput[], index: number, recipe: RecipeInput): RecipeInput[] {
  return recipes.length ? recipes.map((item, i) => i === index ? recipe : item) : [recipe]
}

/**
 * Saves every recipe at once. Recipes that were saved leave the list, so a retry after a failure never saves
 * the same recipe twice; the ones that failed stay for the cook to try again.
 */
export async function saveAllRecipes(recipes: readonly RecipeInput[], post: (recipe: RecipeInput) => Promise<unknown>): Promise<SaveAllResult> {
  const results = await Promise.allSettled(recipes.map(recipe => post(recipe)))
  const remaining = recipes.filter((_, i) => results[i]!.status === 'rejected')
  return { saved: recipes.length - remaining.length, failed: remaining.length, remaining }
}
