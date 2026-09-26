import { randomUUID } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import { createError } from 'h3'
import { z } from 'zod'
import { db } from '../db'
import { recipes, recipeMemories } from '../db/schema'
import { validate } from './validation'

function requireRecipe(id: string | undefined) {
  if (!id || !db.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, id)).get()) throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })
  return id
}
export function listMemories(id: string | undefined) {
  return db.select().from(recipeMemories).where(eq(recipeMemories.recipeId, requireRecipe(id))).orderBy(desc(recipeMemories.cookDate), desc(recipeMemories.createdAt), recipeMemories.id).all()
}
export function saveMemory(id: string | undefined, body: unknown) {
  const value = validate(z.object({
    cookDate: z.number().int().min(0).max(8640000000000000),
    rating: z.number().int().min(1).max(5).nullable().optional(),
    notes: z.string().trim().max(10000).nullable().optional(),
    familyMemories: z.string().trim().max(10000).nullable().optional()
  }).strict(), body)
  return db.insert(recipeMemories).values({ ...value, id: randomUUID(), recipeId: requireRecipe(id), createdAt: Date.now() }).returning().get()
}
