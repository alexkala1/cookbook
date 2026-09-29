import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { forkRecipe } from '../../../utils/recipes'

export default defineEventHandler(async event => {
  const body = await readBody(event)
  const recipe = forkRecipe(getRouterParam(event, 'id')!, body === undefined ? {} : body)
  setResponseStatus(event, 201)
  return recipe
})
