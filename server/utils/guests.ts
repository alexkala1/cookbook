import { randomUUID } from 'node:crypto'
import { asc, eq, inArray } from 'drizzle-orm'
import { createError } from 'h3'
import { z } from 'zod'
import { db } from '../db'
import { guests, recipes, ingredients } from '../db/schema'
import { auditDietary, type Guest } from '../../shared/culinary/dietary'
import { validate } from './validation'

const textList = z.array(z.string().trim().min(1).max(80)).max(30).transform(items => [...new Set(items.map(item => item.toLowerCase()))]).default([])
export const guestProfileSchema = z.object({
  name: z.string().trim().min(1).max(200), allergies: textList, dietaryRestrictions: textList, dislikes: textList,
  notes: z.string().trim().max(5000).nullable().optional()
}).strict()
const guestSaveSchema = guestProfileSchema.extend({ id: z.string().min(1).max(100).optional() })
function profile(row: typeof guests.$inferSelect): Guest {
  const profileWarnings: string[] = []
  const parse = (value: string | null, field: string): string[] => {
    if (value === null) return []
    try { const parsed: unknown = JSON.parse(value); if (Array.isArray(parsed) && parsed.length <= 30 && parsed.every(item => typeof item === 'string' && item.trim() && item.length <= 80)) return parsed }
    catch { /* Legacy JSON must not silently imply no restrictions. */ }
    profileWarnings.push(`Stored ${field} could not be read. Repair the profile before serving.`); return []
  }
  return { ...row, allergies: parse(row.allergies, 'allergies'), dietaryRestrictions: parse(row.dietaryRestrictions, 'dietary restrictions'), dislikes: parse(row.dislikes, 'dislikes'), profileWarnings }
}
export function listGuests() { return db.select().from(guests).orderBy(asc(guests.name), asc(guests.id)).all().map(profile) }
export function saveGuest(body: unknown) {
  const { id, ...input } = validate(guestSaveSchema, body), now = Date.now()
  const value = { ...input, allergies: JSON.stringify(input.allergies), dietaryRestrictions: JSON.stringify(input.dietaryRestrictions), dislikes: JSON.stringify(input.dislikes), notes: input.notes ?? null, updatedAt: now }
  if (!id) return profile(db.insert(guests).values({ ...value, id: randomUUID(), createdAt: now }).returning().get())
  const result = db.update(guests).set(value).where(eq(guests.id, id)).returning().get()
  if (!result) throw createError({ statusCode: 404, statusMessage: 'Guest not found' })
  return profile(result)
}
export function dietaryAudit(body: unknown) {
  const input = validate(z.object({
    recipeIds: z.array(z.string().min(1).max(100)).min(1).max(20),
    guestIds: z.array(z.string().min(1).max(100)).max(20).default([]),
    guests: z.array(guestProfileSchema).max(20).default([])
  }).strict().refine(value => value.guestIds.length + value.guests.length > 0 && value.guestIds.length + value.guests.length <= 20, 'Choose between 1 and 20 guests'), body)
  const ids = [...new Set(input.recipeIds)], guestIds = [...new Set(input.guestIds)]
  const selectedRecipes = db.select().from(recipes).where(inArray(recipes.id, ids)).all()
  if (selectedRecipes.length !== ids.length) throw createError({ statusCode: 404, statusMessage: 'One or more recipes were not found' })
  const selectedGuests = guestIds.length ? db.select().from(guests).where(inArray(guests.id, guestIds)).all() : []
  if (selectedGuests.length !== guestIds.length) throw createError({ statusCode: 404, statusMessage: 'One or more guests were not found' })
  const rows = db.select().from(ingredients).where(inArray(ingredients.recipeId, ids)).orderBy(asc(ingredients.sortOrder)).all()
  return auditDietary(selectedRecipes.map(recipe => ({ ...recipe, ingredients: rows.filter(row => row.recipeId === recipe.id) })), [...selectedGuests.map(profile), ...input.guests])
}
