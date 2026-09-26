import { defineEventHandler, readBody } from 'h3'
import { updateKitchenProfile } from '../../utils/kitchen-profile'
import { kitchenProfileSchema, validate } from '../../utils/validation'
export default defineEventHandler(async event => {
  const input = validate(kitchenProfileSchema, await readBody(event))
  return updateKitchenProfile(input)
})
