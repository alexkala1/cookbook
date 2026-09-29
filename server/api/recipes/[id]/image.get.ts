import { defineEventHandler, getRouterParam, createError, sendRedirect, setResponseHeaders } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../../db'
import { recipes } from '../../../db/schema'

export default defineEventHandler(event => {
  const id = getRouterParam(event, 'id')!
  const imageUrl = db.select({ imageUrl: recipes.imageUrl }).from(recipes).where(eq(recipes.id, id)).get()?.imageUrl
  if (!imageUrl) throw createError({ statusCode: 404, statusMessage: 'Recipe image not found' })
  const inline = imageUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i)
  if (inline) {
    setResponseHeaders(event, { 'Content-Type': inline[1]!, 'Cache-Control': 'public, max-age=86400, immutable', 'X-Content-Type-Options': 'nosniff' })
    return Buffer.from(inline[2]!, 'base64')
  }
  if (/^https?:\/\//i.test(imageUrl)) return sendRedirect(event, imageUrl, 302)
  throw createError({ statusCode: 404, statusMessage: 'Recipe image not found' })
})
