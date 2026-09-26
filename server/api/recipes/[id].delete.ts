import { defineEventHandler, getRouterParam, createError, setResponseStatus } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { recipes } from '../../db/schema'
export default defineEventHandler(event => {
  const result = db.delete(recipes).where(eq(recipes.id, getRouterParam(event, 'id')!)).run()
  if (!result.changes) throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })
  setResponseStatus(event, 204)
  return null
})

