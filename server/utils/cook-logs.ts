import { randomUUID } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import { createError } from 'h3'
import { z } from 'zod'
import { db } from '../db'
import { cookLogs, recipes } from '../db/schema'
import { validate } from './validation'

export const cookLogInputSchema = z.object({
  notes: z.string().trim().max(10000).optional(),
  rating: z.number().finite().min(1).max(5).optional(),
  servings: z.number().int().min(1).max(1000).optional()
}).strict()

function requireRecipe(id: string, connection: Pick<typeof db, 'select'>) {
  if (!connection.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, id)).get()) {
    throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })
  }
}

export function createCookLog(recipeId: string, body: unknown) {
  const input = validate(cookLogInputSchema, body)
  return db.transaction(tx => {
    requireRecipe(recipeId, tx)
    return tx.insert(cookLogs).values({ ...input, id: randomUUID(), recipeId }).returning().get()
  })
}

export function listCookLogs(recipeId: string) {
  requireRecipe(recipeId, db)
  return db.select().from(cookLogs).where(eq(cookLogs.recipeId, recipeId)).orderBy(desc(cookLogs.cookedAt), desc(cookLogs.id)).all()
}
