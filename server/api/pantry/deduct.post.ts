import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { deductForRecipe } from '../../utils/pantry'
import { validate } from '../../utils/validation'
const body = z.object({ recipeId: z.string().min(1).max(100), servings: z.number().finite().positive().max(1000).optional() }).strict()
export default defineEventHandler(async event => {
  const input = validate(body, await readBody(event))
  return deductForRecipe(input.recipeId, input.servings)
})
