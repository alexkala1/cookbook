import type { recipes, ingredients, steps, recipeEquipment, userKitchenProfile } from '../../server/db/schema'

export type Recipe = typeof recipes.$inferSelect
export type Ingredient = typeof ingredients.$inferSelect
export type RecipeStep = typeof steps.$inferSelect
export type Equipment = typeof recipeEquipment.$inferSelect
export type KitchenProfile = typeof userKitchenProfile.$inferSelect
export type RecipeDetail = Recipe & {
  ingredients: Ingredient[], steps: RecipeStep[], equipment: Equipment[],
  parent: { id: string, title: string } | null,
  variations: { id: string, title: string, variationName: string | null }[]
}
