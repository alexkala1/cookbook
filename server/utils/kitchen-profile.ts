import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '../db'
import { userKitchenProfile } from '../db/schema'

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
function ensureProfile(tx: Transaction) {
  const canonical = tx.select().from(userKitchenProfile).where(eq(userKitchenProfile.id, 'default')).get()
  if (canonical) return canonical
  const legacy = tx.select().from(userKitchenProfile).limit(2).all()
  if (legacy.length > 1) throw createError({ statusCode: 409, statusMessage: 'Multiple legacy kitchen profiles need manual consolidation before editing settings' })
  if (legacy[0]) return tx.update(userKitchenProfile).set({ id: 'default' }).where(eq(userKitchenProfile.id, legacy[0].id)).returning().get()!
  return tx.insert(userKitchenProfile).values({ id: 'default' }).returning().get()
}
export function getKitchenProfile() { return db.transaction(ensureProfile) }
export function updateKitchenProfile(input: Omit<typeof userKitchenProfile.$inferInsert, 'id'>) {
  return db.transaction(tx => {
    ensureProfile(tx)
    return tx.update(userKitchenProfile).set(input).where(eq(userKitchenProfile.id, 'default')).returning().get()!
  })
}
