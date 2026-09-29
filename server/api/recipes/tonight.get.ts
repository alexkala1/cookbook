import { defineEventHandler } from 'h3'
import { asc } from 'drizzle-orm'
import { db } from '../../db'
import { ingredients, recipes } from '../../db/schema'

// Slim payload for the "what's in your kitchen" matcher: ingredient names only, no photos or steps.
export default defineEventHandler(() => {
  const rows = db.select({ recipeId: ingredients.recipeId, name: ingredients.name }).from(ingredients).orderBy(asc(ingredients.sortOrder)).all()
  const byRecipe = new Map<string, { name: string }[]>()
  for (const row of rows) byRecipe.set(row.recipeId, [...(byRecipe.get(row.recipeId) ?? []), { name: row.name }])
  return db.select({ id: recipes.id, title: recipes.title, totalTimeMinutes: recipes.totalTimeMinutes }).from(recipes).all()
    .map(recipe => ({ ...recipe, ingredients: byRecipe.get(recipe.id) ?? [] }))
})
