import { sql } from 'drizzle-orm'
import { check, index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const pantryItems = sqliteTable('pantry_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  quantity: real('quantity').notNull().default(1),
  unit: text('unit').notNull().default('item'),
  storageLocation: text('storage_location', { enum: ['pantry', 'fridge', 'freezer'] }).notNull().default('pantry'),
  expiresAt: integer('expires_at'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()).$onUpdate(() => Date.now())
}, table => [
  index('pantry_name_location_idx').on(table.normalizedName, table.storageLocation),
  check('pantry_storage_location', sql`${table.storageLocation} in ('pantry', 'fridge', 'freezer')`)
])
