import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const recipes = sqliteTable('recipes', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  recipeType: text('recipe_type', { enum: ['food', 'drink', 'cocktail', 'baking', 'dessert'] }).notNull().default('food'),
  originalSaltType: text('original_salt_type', { enum: ['table_salt', 'morton_kosher', 'diamond_crystal_kosher', 'greek_fine_sea_salt'] }),
  sourceUrl: text('source_url'),
  sourceType: text('source_type', { enum: ['url', 'video', 'prompt', 'handwritten_ocr', 'manual'] }).notNull().default('manual'),
  servings: integer('servings').notNull().default(4),
  prepTimeMinutes: integer('prep_time_minutes').notNull().default(15),
  cookTimeMinutes: integer('cook_time_minutes').notNull().default(30),
  totalTimeMinutes: integer('total_time_minutes').notNull().default(45),
  difficulty: text('difficulty', { enum: ['easy', 'intermediate', 'advanced', 'master'] }).notNull().default('intermediate'),
  cuisine: text('cuisine'),
  imageUrl: text('image_url'),
  heirloomNotes: text('heirloom_notes'),
  // JSON strings are preserved as specified by the API contract.
  storageReheating: text('storage_reheating'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  rating: real('rating'),
  createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`).$onUpdate(() => new Date().toISOString())
})

export const ingredients = sqliteTable('ingredients', {
  id: text('id').primaryKey(),
  recipeId: text('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  unit: text('unit').notNull(),
  gramsEquivalent: real('grams_equivalent'),
  category: text('category').notNull().default('pantry'),
  notes: text('notes'),
  sortOrder: integer('sort_order').notNull().default(0)
}, table => [index('ingredients_recipe_id_idx').on(table.recipeId)])

export const steps = sqliteTable('steps', {
  id: text('id').primaryKey(),
  recipeId: text('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  stepNumber: integer('step_number').notNull(),
  instruction: text('instruction').notNull(),
  durationMinutes: integer('duration_minutes'),
  timerRequired: integer('timer_required', { mode: 'boolean' }).notNull().default(false),
  heatLevel: text('heat_level', { enum: ['none', 'low', 'medium-low', 'medium', 'medium-high', 'high'] }),
  scienceWhy: text('science_why'),
  failurePrevention: text('failure_prevention'),
  sensoryVisual: text('sensory_visual'),
  sensoryAudio: text('sensory_audio'),
  sensoryAroma: text('sensory_aroma'),
  sensoryTexture: text('sensory_texture'),
  internalTempTargetC: real('internal_temp_target_c'),
  sortOrder: integer('sort_order').notNull().default(0)
}, table => [index('steps_recipe_id_idx').on(table.recipeId)])

export const recipeEquipment = sqliteTable('recipe_equipment', {
  id: text('id').primaryKey(),
  recipeId: text('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isEssential: integer('is_essential', { mode: 'boolean' }).notNull().default(true),
  substituteTool: text('substitute_tool')
}, table => [index('recipe_equipment_recipe_id_idx').on(table.recipeId)])

export { pantryItems } from '../database/schema'

export const groceryLists = sqliteTable('grocery_lists', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
})

export const groceryItems = sqliteTable('grocery_items', {
  id: text('id').primaryKey(),
  listId: text('list_id').notNull().references(() => groceryLists.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  amount: real('amount'),
  unit: text('unit'),
  category: text('category').notNull().default('pantry'),
  storeDestination: text('store_destination', {
    enum: ['manavis_produce', 'chasapis_butcher', 'fournos_bakery', 'supermarket', 'kava_cellar', 'general']
  }).notNull().default('supermarket'),
  counterPhrase: text('counter_phrase'),
  packageSizeToBuy: text('package_size_to_buy'),
  surplusLeftoverTip: text('surplus_leftover_tip'),
  courseBreakdown: text('course_breakdown'),
  isChecked: integer('is_checked', { mode: 'boolean' }).notNull().default(false),
  recipeOriginId: text('recipe_origin_id')
})

export const guests = sqliteTable('guests', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  allergies: text('allergies'),
  dietaryRestrictions: text('dietary_restrictions'),
  dislikes: text('dislikes'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
})

export const userKitchenProfile = sqliteTable('user_kitchen_profile', {
  id: text('id').primaryKey().default('default'),
  stoveType: text('stove_type', { enum: ['gas', 'induction', 'electric_radiant'] }).notNull().default('gas'),
  ovenType: text('oven_type', { enum: ['convection_fan', 'static_conventional'] }).notNull().default('convection_fan'),
  hasMicrowave: integer('has_microwave', { mode: 'boolean' }).default(true),
  hasAirFryer: integer('has_air_fryer', { mode: 'boolean' }).default(false),
  hasInstantPot: integer('has_instant_pot', { mode: 'boolean' }).default(false),
  hasCastIron: integer('has_cast_iron', { mode: 'boolean' }).default(true),
  hasClayGastra: integer('has_clay_gastra', { mode: 'boolean' }).default(false),
  preferredSaltType: text('preferred_salt_type', { enum: ['table_salt', 'morton_kosher', 'diamond_crystal_kosher', 'greek_fine_sea_salt'] }).default('table_salt')
})

export const cookingSessions = sqliteTable('cooking_sessions', {
  id: text('id').primaryKey(),
  recipeId: text('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  startedAt: text('started_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  completedAt: text('completed_at'),
  userRating: integer('user_rating'),
  sessionNotes: text('session_notes'),
  photoUrl: text('photo_url')
})
