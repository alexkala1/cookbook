import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { deductForRecipe } from '../../utils/pantry'
import { validate } from '../../utils/validation'
export default defineEventHandler(async event => deductForRecipe(validate(z.object({ recipeId: z.string().min(1).max(100) }).strict(), await readBody(event)).recipeId))
