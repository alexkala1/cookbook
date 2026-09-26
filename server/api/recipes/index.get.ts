import { defineEventHandler, getQuery } from 'h3'
import { listRecipes } from '../../utils/recipes'
import { recipeQuerySchema, validate } from '../../utils/validation'
import { normalizeGreekText } from '../../utils/search'
export default defineEventHandler(event => {
  const query = validate(recipeQuerySchema, getQuery(event))
  if (query.search !== undefined) query.search = normalizeGreekText(query.search)
  return listRecipes(query)
})
