import { defineEventHandler, getQuery } from 'h3'
import { listRecipes } from '../../utils/recipes'
import { recipeQuerySchema, validate } from '../../utils/validation'
export default defineEventHandler(event => listRecipes(validate(recipeQuerySchema, getQuery(event))))

