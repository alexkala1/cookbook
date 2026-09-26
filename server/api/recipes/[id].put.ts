import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { saveRecipe } from '../../utils/recipes'
import { recipeUpdateSchema, validate } from '../../utils/validation'
export default defineEventHandler(async event => saveRecipe(validate(recipeUpdateSchema, await readBody(event)), getRouterParam(event, 'id')!))

