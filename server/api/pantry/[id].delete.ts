import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { pantryItems } from '../../db/schema'
export default defineEventHandler(event => {
  const id = getRouterParam(event, 'id')
  if (!id || !db.delete(pantryItems).where(eq(pantryItems.id, id)).returning().get()) throw createError({ statusCode: 404, statusMessage: 'Pantry item not found' })
  return { deleted: true }
})
