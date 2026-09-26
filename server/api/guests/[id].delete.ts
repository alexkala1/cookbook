import { defineEventHandler, getRouterParam, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { guests } from '../../db/schema'
export default defineEventHandler(event => {
  const id = getRouterParam(event, 'id')
  if (!id || !db.delete(guests).where(eq(guests.id, id)).returning().get()) throw createError({ statusCode: 404, statusMessage: 'Guest not found' })
  return { deleted: true }
})
