import { defineEventHandler, readBody } from 'h3'
import { db } from '../../db'
import { userKitchenProfile } from '../../db/schema'
import { kitchenProfileSchema, validate } from '../../utils/validation'
export default defineEventHandler(async event => {
  const input = validate(kitchenProfileSchema, await readBody(event))
  return db.insert(userKitchenProfile).values({ ...input, id: 'default' }).onConflictDoUpdate({ target: userKitchenProfile.id, set: input }).returning().get()
})

