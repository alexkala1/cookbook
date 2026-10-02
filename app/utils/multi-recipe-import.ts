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
 * Saves recipes sequentially in source order. Successful recipes leave the list;
 * failed recipes stay for the cook to try again.
 */
export async function saveAllRecipes(recipes: readonly RecipeInput[], post: (recipe: RecipeInput) => Promise<unknown>): Promise<SaveAllResult> {
  const remaining: RecipeInput[] = []
  for (const recipe of recipes) {
    try { await post(recipe) } catch { remaining.push(recipe) }
  }
  return { saved: recipes.length - remaining.length, failed: remaining.length, remaining }
}
