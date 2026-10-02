import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { z } from 'zod'
import { db } from '../db'
import { recipes, ingredients, steps, recipeEquipment } from '../db/schema'
import { validate, type RecipeInput } from './validation'

export function getRecipe(id: string, connection: Pick<typeof db, 'select'> = db) {
  const recipe = connection.select().from(recipes).where(eq(recipes.id, id)).get()
  if (!recipe) throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })
  return {
    ...recipe,
    parent: recipe.parentRecipeId ? connection.select({ id: recipes.id, title: recipes.title }).from(recipes).where(eq(recipes.id, recipe.parentRecipeId)).get() ?? null : null,
    variations: connection.select({ id: recipes.id, title: recipes.title, variationName: recipes.variationName }).from(recipes).where(eq(recipes.parentRecipeId, id)).orderBy(asc(recipes.title), asc(recipes.id)).all(),
    ingredients: connection.select().from(ingredients).where(eq(ingredients.recipeId, id)).orderBy(asc(ingredients.sortOrder), asc(ingredients.id)).all(),
    steps: connection.select().from(steps).where(eq(steps.recipeId, id)).orderBy(asc(steps.stepNumber)).all(),
    equipment: connection.select().from(recipeEquipment).where(eq(recipeEquipment.recipeId, id)).orderBy(asc(recipeEquipment.id)).all()
  }
}

const forkOptionsSchema = z.object({
  title: z.string().trim().max(200).optional(),
  variationName: z.string().trim().max(200).optional()
}).strict()

export function forkRecipe(id: string, options: { title?: string, variationName?: string } = {}) {
  const input = validate(forkOptionsSchema, options)
  return db.transaction(tx => {
    const { ingredients: ingredientRows, steps: stepRows, equipment: equipmentRows, parent: _parent, variations: _variations, ...original } = getRecipe(id, tx)
    const forkedId = randomUUID()
    const variationName = input.variationName || 'My Twist'
    tx.insert(recipes).values({
      ...original, id: forkedId, parentRecipeId: original.id, variationName,
      title: input.title || `${original.title} (${variationName})`
    }).run()
    for (const row of ingredientRows) tx.insert(ingredients).values({ ...row, id: randomUUID(), recipeId: forkedId }).run()
    for (const row of stepRows) tx.insert(steps).values({ ...row, id: randomUUID(), recipeId: forkedId }).run()
    for (const row of equipmentRows) tx.insert(recipeEquipment).values({ ...row, id: randomUUID(), recipeId: forkedId }).run()
    return getRecipe(forkedId, tx)
  })
}

export function listRecipes(query: { search?: string, type?: string, difficulty?: string, cuisine?: string, isFavorite?: boolean, collection?: string }) {
  const conditions = []
  if (query.collection === 'quick') conditions.push(lte(recipes.totalTimeMinutes, 30))
  if (query.collection === 'feast') conditions.push(gte(recipes.servings, 6))
  if (query.collection === 'easy') conditions.push(eq(recipes.difficulty, 'easy'))
  if (query.search) conditions.push(sql`instr(greek_lower(${recipes.title} || ' ' || ${recipes.description}), greek_lower(${query.search})) > 0`)
  if (query.type === 'drinks') conditions.push(inArray(recipes.recipeType, ['drink', 'cocktail']))
  else if (query.type) conditions.push(eq(recipes.recipeType, query.type as typeof recipes.$inferSelect.recipeType))
  if (query.difficulty) conditions.push(eq(recipes.difficulty, query.difficulty as typeof recipes.$inferSelect.difficulty))
  if (query.cuisine) conditions.push(sql`greek_lower(${recipes.cuisine}) = greek_lower(${query.cuisine})`)
  if (query.isFavorite !== undefined) conditions.push(eq(recipes.isFavorite, query.isFavorite))
  return db.select().from(recipes).where(and(...conditions)).orderBy(desc(recipes.createdAt), asc(recipes.id)).all()
    // Inline card photos would bloat the list; point at the image endpoint (versioned so its immutable cache can't go stale).
    .map(recipe => recipe.imageUrl?.startsWith('data:') ? { ...recipe, imageUrl: `/api/recipes/${recipe.id}/image?v=${encodeURIComponent(recipe.updatedAt ?? '')}` } : recipe)
}

export function saveRecipe(input: Partial<RecipeInput>, id?: string, connection: Pick<typeof db, 'transaction'> = db) {
  return connection.transaction(tx => {
    const current = id ? tx.select().from(recipes).where(eq(recipes.id, id)).get() : undefined
    if (id && !current) throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })
    const recipeId = id ?? randomUUID()
    const { ingredients: ingredientRows, steps: stepRows, equipment: equipmentRows, ...fields } = input
    if (fields.totalTimeMinutes === undefined && (!id || fields.prepTimeMinutes !== undefined || fields.cookTimeMinutes !== undefined)) {
      fields.totalTimeMinutes = (fields.prepTimeMinutes ?? current?.prepTimeMinutes ?? 15) + (fields.cookTimeMinutes ?? current?.cookTimeMinutes ?? 30)
    }
    if (id) tx.update(recipes).set({ ...fields, updatedAt: new Date().toISOString() }).where(eq(recipes.id, id)).run()
    else tx.insert(recipes).values({ ...fields, id: recipeId, title: input.title!, description: input.description! }).run()

    if (ingredientRows !== undefined) {
      tx.delete(ingredients).where(eq(ingredients.recipeId, recipeId)).run()
      if (ingredientRows.length) tx.insert(ingredients).values(ingredientRows.map((row, index) => ({ ...row, id: randomUUID(), recipeId, sortOrder: index + 1 }))).run()
    }
    if (stepRows !== undefined) {
      tx.delete(steps).where(eq(steps.recipeId, recipeId)).run()
      if (stepRows.length) tx.insert(steps).values(stepRows.map((row, index) => ({ ...row, id: randomUUID(), recipeId, sortOrder: index + 1 }))).run()
    }
    if (equipmentRows !== undefined) {
      tx.delete(recipeEquipment).where(eq(recipeEquipment.recipeId, recipeId)).run()
      if (equipmentRows.length) tx.insert(recipeEquipment).values(equipmentRows.map(row => ({ ...row, id: randomUUID(), recipeId }))).run()
    }
    return getRecipe(recipeId, tx)
  })
}
