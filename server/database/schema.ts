import { sql } from 'drizzle-orm'
import { check, index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { recipes } from '../db/schema'

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

export const guests = sqliteTable('guests', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  allergies: text('allergies'),
  dietaryRestrictions: text('dietary_restrictions'),
  dislikes: text('dislikes'),
  notes: text('notes'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()).$onUpdate(() => Date.now())
})

export const recipeMemories = sqliteTable('recipe_memories', {
  id: text('id').primaryKey(),
  recipeId: text('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  cookDate: integer('cook_date').notNull(),
  rating: integer('rating'),
  notes: text('notes'),
  familyMemories: text('family_memories'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now())
}, table => [
  index('recipe_memories_recipe_id_idx').on(table.recipeId),
  check('recipe_memories_rating', sql`${table.rating} IS NULL OR (${table.rating} BETWEEN 1 AND 5 AND ${table.rating} = CAST(${table.rating} AS INTEGER))`)
])
