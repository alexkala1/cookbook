import { randomUUID } from 'node:crypto'
import { asc, eq, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { z } from 'zod'
import { db } from '../db'
import { pantryItems, recipes, ingredients } from '../db/schema'
import { ingredientKey, matchPantry, normalizePantryName, pantryQuantity, storageLocations } from '../../shared/culinary/pantry'
import { validate } from './validation'

export const pantryInput = z.object({
  name: z.string().trim().min(1).max(200).refine(value => normalizePantryName(value).length > 0),
  quantity: z.number().finite().positive().max(1000000).default(1),
  unit: z.string().trim().min(1).max(40).transform(value => value.toLowerCase()).default('item'),
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
    let expiresAt = item.expiresAt ?? null
    for (const row of existing) {
      const converted = pantryQuantity(row.quantity, row.unit, item.unit)
      if (converted === null) throw createError({ statusCode: 409, statusMessage: 'Cannot merge incompatible units. Use the existing item unit.' })
      quantity += converted
      if (row.expiresAt !== null) expiresAt = expiresAt === null ? row.expiresAt : Math.min(expiresAt, row.expiresAt)
    }
    if (!Number.isFinite(quantity) || quantity > 1000000) throw createError({ statusCode: 400, statusMessage: 'Merged quantity is too large' })
    const now = Date.now(), first = existing[0]
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
export function deductForRecipe(recipeId: string) {
  if (!db.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, recipeId)).get()) throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })
  const needed = db.select().from(ingredients).where(eq(ingredients.recipeId, recipeId)).orderBy(ingredients.sortOrder).all()
  return db.transaction(tx => {
    const now = Date.now()
    const stock = listPantry().filter(item => item.quantity > 0 && (item.expiresAt === null || item.expiresAt > now))
    const deducted: { name: string, amount: string }[] = []
    for (const ingredient of needed) {
      if (!(ingredient.amount > 0)) continue
      let required = ingredient.amount, total = 0
      for (const item of stock.filter(row => ingredientKey(row.name) === ingredientKey(ingredient.name))) {
        if (required <= 1e-8) break
        const available = pantryQuantity(item.quantity, item.unit, ingredient.unit)
        if (available === null || available <= 0) continue
        const used = Math.min(required, available)
        required -= used; total += used
        const remaining = item.quantity - (pantryQuantity(used, ingredient.unit, item.unit) ?? 0)
        item.quantity = remaining <= 1e-8 ? 0 : remaining
        if (item.quantity === 0) tx.delete(pantryItems).where(eq(pantryItems.id, item.id)).run()
        else tx.update(pantryItems).set({ quantity: item.quantity, updatedAt: Date.now() }).where(eq(pantryItems.id, item.id)).run()
      }
      if (total > 0) deducted.push({ name: ingredient.name, amount: `${round(total)} ${ingredient.unit}`.trim() })
    }
    return { deducted }
  })
}
