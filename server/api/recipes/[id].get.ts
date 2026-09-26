import { defineEventHandler, getRouterParam } from 'h3'
import { getRecipe } from '../../utils/recipes'
export default defineEventHandler(event => getRecipe(getRouterParam(event, 'id')!))

