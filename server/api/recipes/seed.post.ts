import { defineEventHandler, setResponseStatus } from 'h3'
import { seedStarterRecipes } from '../../utils/seed'

export default defineEventHandler(event => {
  const result = seedStarterRecipes()
  setResponseStatus(event, result.created ? 201 : 200)
  return result
})
