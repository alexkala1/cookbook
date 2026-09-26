import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { saveRecipe } from '../../utils/recipes'
import { recipeCreateSchema, validate } from '../../utils/validation'
export default defineEventHandler(async event => {
  const result = saveRecipe(validate(recipeCreateSchema, await readBody(event)))
  setResponseStatus(event, 201)
  return result
})

