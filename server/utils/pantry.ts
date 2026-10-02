import { randomUUID } from 'node:crypto'
import { asc, eq, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { z } from 'zod'
import { db } from '../db'
import { pantryItems, recipes, ingredients } from '../db/schema'
import { estimateShelfLifeDays, ingredientKey, matchPantry, normalizePantryName, pantryQuantity, storageLocations } from '../../shared/culinary/pantry'
import { clean, validate, visibleText } from './validation'

export const pantryInput = z.object({
  name: visibleText(z.string().trim().min(1).max(200)).refine(value => normalizePantryName(value).length > 0),
  quantity: z.number().finite().min(0.001).max(1000000).default(1),
  unit: clean(z.string().trim().min(1).max(40)).transform(value => value.toLowerCase()).default('item'),
  storageLocation: z.enum(storageLocations).default('pantry'),
  expiresAt: z.number().int().min(0).max(8640000000000000).nullable().optional()
}).strict()
export function listPantry() {
  return db.select().from(pantryItems).orderBy(sql`${pantryItems.expiresAt} IS NULL`, asc(pantryItems.expiresAt), asc(pantryItems.storageLocation), asc(pantryItems.name)).all()
}
export function savePantry(body: unknown) {
  const items = validate(z.union([pantryInput.transform(item => [item]), z.array(pantryInput).min(1).max(100)]), body)
  return db.transaction(tx => items.map(item => {
    const normalizedName = normalizePantryName(item.name)
    // Normalize legacy names too: SQLite's built-in lower() only handles ASCII.
    const existing = tx.select().from(pantryItems).where(eq(pantryItems.storageLocation, item.storageLocation)).all().filter(row => normalizePantryName(row.name) === normalizedName)
    let quantity = item.quantity
    const now = Date.now()
    let expiresAt = item.expiresAt === undefined ? now + estimateShelfLifeDays(item.name, item.storageLocation) * 86400000 : item.expiresAt
    for (const row of existing) {
      const converted = pantryQuantity(row.quantity, row.unit, item.unit)
      if (converted === null) throw createError({ statusCode: 409, statusMessage: 'Cannot merge incompatible units. Use the existing item unit.' })
      quantity += converted
      if (row.quantity > 0 && row.expiresAt !== null) expiresAt = expiresAt === null ? row.expiresAt : Math.min(expiresAt, row.expiresAt)
    }
    if (!Number.isFinite(quantity) || quantity > 1000000) throw createError({ statusCode: 400, statusMessage: 'Merged quantity is too large' })
    quantity = Math.round(quantity * 1000) / 1000
    if (quantity < 0.001) throw createError({ statusCode: 400, statusMessage: 'Quantity must be at least 0.001' })
    const first = existing[0]
    const value = { ...item, normalizedName, quantity, expiresAt, updatedAt: now }
    if (!first) return tx.insert(pantryItems).values({ ...value, id: randomUUID(), createdAt: now }).returning().get()
    for (const row of existing.slice(1)) tx.delete(pantryItems).where(eq(pantryItems.id, row.id)).run()
    return tx.update(pantryItems).set(value).where(eq(pantryItems.id, first.id)).returning().get()!
  }))
}
export function pantryMatches() {
  const allIngredients = db.select().from(ingredients).orderBy(ingredients.sortOrder).all()
  return matchPantry(db.select().from(recipes).all().map(recipe => ({ ...recipe, ingredients: allIngredients.filter(item => item.recipeId === recipe.id) })), listPantry())
}

const round = (value: number) => Number(value.toFixed(3))
/** Use up a cooked recipe's ingredients, soonest-expiring stock first. Expired stock and incompatible units are left alone. */
export function deductForRecipe(recipeId: string, servings?: number) {
  return db.transaction(tx => {
    const recipe = tx.select({ servings: recipes.servings }).from(recipes).where(eq(recipes.id, recipeId)).get()
    if (!recipe) throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })
    const needed = tx.select().from(ingredients).where(eq(ingredients.recipeId, recipeId)).orderBy(ingredients.sortOrder).all()
    const now = Date.now()
    const stock = tx.select().from(pantryItems).orderBy(sql`${pantryItems.expiresAt} IS NULL`, asc(pantryItems.expiresAt), asc(pantryItems.storageLocation), asc(pantryItems.name)).all().filter(item => item.quantity > 0 && (item.expiresAt === null || item.expiresAt > now))
    const deducted: { name: string, amount: string }[] = []
    for (const ingredient of needed) {
      if (!(ingredient.amount > 0)) continue
      // Scale to the servings actually cooked, not the recipe's saved yield.
      let required = ingredient.amount * (servings ? servings / recipe.servings : 1), total = 0
      for (const item of stock.filter(row => ingredientKey(row.name) === ingredientKey(ingredient.name))) {
        if (required <= 1e-8) break
        const available = pantryQuantity(item.quantity, item.unit, ingredient.unit)
        if (available === null || available <= 0) continue
        const used = Math.min(required, available)
        required -= used; total += used
        const remaining = Math.round((item.quantity - (pantryQuantity(used, ingredient.unit, item.unit) ?? 0)) * 1000) / 1000
        item.quantity = remaining < 0.001 ? 0 : remaining
        if (item.quantity === 0) tx.delete(pantryItems).where(eq(pantryItems.id, item.id)).run()
        else tx.update(pantryItems).set({ quantity: item.quantity, updatedAt: Date.now() }).where(eq(pantryItems.id, item.id)).run()
      }
      if (total > 0) deducted.push({ name: ingredient.name, amount: `${round(total)} ${ingredient.unit}`.trim() })
    }
    return { deducted }
  }, { behavior: 'immediate' })
}
