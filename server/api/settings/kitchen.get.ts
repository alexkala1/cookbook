import { defineEventHandler } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { userKitchenProfile } from '../../db/schema'
export default defineEventHandler(() => {
  db.insert(userKitchenProfile).values({ id: 'default' }).onConflictDoNothing().run()
  return db.select().from(userKitchenProfile).where(eq(userKitchenProfile.id, 'default')).get()!
})

