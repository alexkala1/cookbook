import { db } from '../db'
import { recipes } from '../db/schema'
import { starterRecipes } from '../db/starter-recipes'
import { saveRecipe } from './recipes'
import { recipeCreateSchema } from './validation'

export function seedStarterRecipes() {
  // Acquire the write lock before checking emptiness, including across processes.
  return db.transaction(tx => {
    if (tx.select({ id: recipes.id }).from(recipes).limit(1).get()) return { created: 0 }
    for (const recipe of starterRecipes) saveRecipe(recipeCreateSchema.parse(recipe), undefined, tx)
    return { created: starterRecipes.length }
  }, { behavior: 'immediate' })
}
