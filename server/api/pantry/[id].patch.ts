import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db'
import { pantryItems } from '../../db/schema'
import { validate } from '../../utils/validation'

const quantityDelta = z.object({ delta: z.number().finite().min(-1000000).max(1000000).refine(delta => Math.abs(delta) >= 0.001, 'Delta must be at least 0.001') }).strict()

export default defineEventHandler(async event => {
  const { delta } = validate(quantityDelta, await readBody(event))
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 404, statusMessage: 'Pantry item not found' })
  return db.transaction(tx => {
    const existing = tx.select().from(pantryItems).where(eq(pantryItems.id, id)).get()
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Pantry item not found' })
    const nextQuantity = Math.max(0, Math.min(1000000, Number((existing.quantity + delta).toFixed(3))))
    return tx.update(pantryItems).set({ quantity: nextQuantity, updatedAt: Date.now() }).where(eq(pantryItems.id, id)).returning().get()!
  })
})
