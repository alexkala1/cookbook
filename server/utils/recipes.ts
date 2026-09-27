import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '../db'
import { recipes, ingredients, steps, recipeEquipment } from '../db/schema'
import type { RecipeInput } from './validation'

export function getRecipe(id: string, connection: Pick<typeof db, 'select'> = db) {
  const recipe = connection.select().from(recipes).where(eq(recipes.id, id)).get()
  if (!recipe) throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })
  return {
    ...recipe,
    ingredients: connection.select().from(ingredients).where(eq(ingredients.recipeId, id)).orderBy(asc(ingredients.sortOrder), asc(ingredients.id)).all(),
    steps: connection.select().from(steps).where(eq(steps.recipeId, id)).orderBy(asc(steps.stepNumber)).all(),
    equipment: connection.select().from(recipeEquipment).where(eq(recipeEquipment.recipeId, id)).orderBy(asc(recipeEquipment.id)).all()
  }
}

export function listRecipes(query: { search?: string, type?: string, difficulty?: string, cuisine?: string, isFavorite?: boolean }) {
  const conditions = []
  if (query.search) conditions.push(sql`instr(greek_lower(${recipes.title} || ' ' || ${recipes.description}), greek_lower(${query.search})) > 0`)
  if (query.type === 'drinks') conditions.push(inArray(recipes.recipeType, ['drink', 'cocktail']))
  else if (query.type) conditions.push(eq(recipes.recipeType, query.type as typeof recipes.$inferSelect.recipeType))
  if (query.difficulty) conditions.push(eq(recipes.difficulty, query.difficulty as typeof recipes.$inferSelect.difficulty))
  if (query.cuisine) conditions.push(sql`greek_lower(${recipes.cuisine}) = greek_lower(${query.cuisine})`)
  if (query.isFavorite !== undefined) conditions.push(eq(recipes.isFavorite, query.isFavorite))
  return db.select().from(recipes).where(and(...conditions)).orderBy(desc(recipes.createdAt), asc(recipes.id)).all()
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
      if (ingredientRows.length) tx.insert(ingredients).values(ingredientRows.map((row, index) => ({ ...row, id: randomUUID(), recipeId, sortOrder: row.sortOrder ?? index }))).run()
    }
    if (stepRows !== undefined) {
      tx.delete(steps).where(eq(steps.recipeId, recipeId)).run()
      if (stepRows.length) tx.insert(steps).values(stepRows.map((row, index) => ({ ...row, id: randomUUID(), recipeId, sortOrder: row.sortOrder ?? index }))).run()
    }
    if (equipmentRows !== undefined) {
      tx.delete(recipeEquipment).where(eq(recipeEquipment.recipeId, recipeId)).run()
      if (equipmentRows.length) tx.insert(recipeEquipment).values(equipmentRows.map(row => ({ ...row, id: randomUUID(), recipeId }))).run()
    }
    return getRecipe(recipeId, tx)
  })
}
