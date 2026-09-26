import Database from 'better-sqlite3'
import { eq, getTableName } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { getTableConfig } from 'drizzle-orm/sqlite-core'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '../server/db/schema'

const migrationsFolder = fileURLToPath(new URL('../server/db/migrations', import.meta.url))

function createDatabase() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder })
  return { sqlite, db }
}

describe('SQLite schema and initial migration', () => {
  let connection: ReturnType<typeof createDatabase>

  beforeEach(() => {
    connection = createDatabase()
  })

  afterEach(() => {
    connection.sqlite.close()
  })

  it('creates exactly the ten application tables', () => {
    const tables = connection.sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle_%' ORDER BY name").all()
    expect(tables).toEqual([
      'cooking_sessions', 'grocery_items', 'grocery_lists', 'guests', 'ingredients',
      'pantry_items', 'recipe_equipment', 'recipes', 'steps', 'user_kitchen_profile'
    ].map(name => ({ name })))
  })

  it('keeps migrated columns, types, nullability, and primary keys aligned with Drizzle', () => {
    for (const table of Object.values(schema)) {
      const columns = connection.sqlite.pragma(`table_info('${getTableName(table)}')`) as {
        name: string, type: string, notnull: number, pk: number
      }[]
      expect(columns.map(column => ({
        name: column.name, type: column.type.toLowerCase(), notNull: Boolean(column.notnull), primary: Boolean(column.pk)
      }))).toEqual(getTableConfig(table).columns.map(column => ({
        name: column.name, type: column.getSQLType(), notNull: column.notNull, primary: column.primary
      })))
    }
  })

  it('round-trips recipe defaults, booleans, timestamps, and family notes', () => {
    const { db } = connection
    db.insert(schema.recipes).values({ id: 'recipe', title: 'Fasolada', description: 'White bean soup', heirloomNotes: 'Sunday lunch' }).run()
    expect(db.select().from(schema.recipes).get()).toMatchObject({
      recipeType: 'food', sourceType: 'manual', servings: 4, prepTimeMinutes: 15,
      cookTimeMinutes: 30, totalTimeMinutes: 45, difficulty: 'intermediate',
      isFavorite: false, rating: null, heirloomNotes: 'Sunday lunch', sourceUrl: null,
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2} /), updatedAt: expect.any(String)
    })
    db.update(schema.recipes).set({ isFavorite: true }).where(eq(schema.recipes.id, 'recipe')).run()
    expect(db.select().from(schema.recipes).get()?.isFavorite).toBe(true)
  })

  it('persists culinary guidance and cascades every recipe child on deletion', () => {
    const { db } = connection
    db.insert(schema.recipes).values({ id: 'recipe', title: 'Bread', description: 'Family loaf' }).run()
    db.insert(schema.ingredients).values({ id: 'ingredient', recipeId: 'recipe', name: 'Flour', amount: 500.5, unit: 'g' }).run()
    db.insert(schema.steps).values({ id: 'step', recipeId: 'recipe', stepNumber: 1, instruction: 'Bake', timerRequired: true, scienceWhy: 'Starch gelatinizes', sensoryVisual: 'Golden crust', internalTempTargetC: 96 }).run()
    db.insert(schema.recipeEquipment).values({ id: 'tool', recipeId: 'recipe', name: 'Oven' }).run()
    db.insert(schema.cookingSessions).values({ id: 'session', recipeId: 'recipe', userRating: 5, sessionNotes: 'Crisp crust' }).run()
    expect(db.select().from(schema.ingredients).get()).toMatchObject({ amount: 500.5, category: 'pantry', sortOrder: 0 })
    expect(db.select().from(schema.steps).get()).toMatchObject({ timerRequired: true, scienceWhy: 'Starch gelatinizes', internalTempTargetC: 96 })
    expect(db.select().from(schema.recipeEquipment).get()?.isEssential).toBe(true)
    expect(db.select().from(schema.cookingSessions).get()).toMatchObject({ userRating: 5, completedAt: null, startedAt: expect.any(String) })
    db.delete(schema.recipes).where(eq(schema.recipes.id, 'recipe')).run()
    for (const table of [schema.ingredients, schema.steps, schema.recipeEquipment, schema.cookingSessions]) {
      expect(db.select().from(table).all()).toEqual([])
    }
  })

  it('preserves market routing and cascades grocery items only with their list', () => {
    const { db } = connection
    db.insert(schema.groceryLists).values({ id: 'list', title: 'Saturday market' }).run()
    db.insert(schema.groceryItems).values({ id: 'item', listId: 'list', name: 'Beans', courseBreakdown: '{"main":2}', counterPhrase: 'Μισό κιλό', recipeOriginId: 'historical-recipe' }).run()
    expect(db.select().from(schema.groceryItems).get()).toMatchObject({
      storeDestination: 'supermarket', isChecked: false, amount: null,
      courseBreakdown: '{"main":2}', counterPhrase: 'Μισό κιλό', recipeOriginId: 'historical-recipe'
    })
    db.delete(schema.groceryLists).where(eq(schema.groceryLists.id, 'list')).run()
    expect(db.select().from(schema.groceryItems).all()).toEqual([])
  })

  it('round-trips pantry, guest dietary JSON, and kitchen defaults', () => {
    const { db } = connection
    db.insert(schema.pantryItems).values({ id: 'pantry', name: 'Olive oil', quantity: 0.75, unit: 'l' }).run()
    db.insert(schema.guests).values({ id: 'guest', name: 'Alex', allergies: '["peanuts"]', dietaryRestrictions: '["vegan"]' }).run()
    db.insert(schema.userKitchenProfile).values({ id: 'kitchen' }).run()
    expect(db.select().from(schema.pantryItems).get()).toMatchObject({ quantity: 0.75, category: 'pantry', expiresAt: null })
    expect(db.select().from(schema.guests).get()).toMatchObject({ allergies: '["peanuts"]', dietaryRestrictions: '["vegan"]', dislikes: null })
    expect(db.select().from(schema.userKitchenProfile).get()).toEqual({
      id: 'kitchen', stoveType: 'gas', ovenType: 'convection_fan', hasMicrowave: true,
      hasAirFryer: false, hasInstantPot: false, hasCastIron: true, hasClayGastra: false,
      preferredSaltType: 'table_salt'
    })
  })

  it('rejects missing required fields, duplicate IDs, and orphan foreign keys', () => {
    const { db, sqlite } = connection
    expect(() => sqlite.prepare('INSERT INTO recipes (id, title) VALUES (?, ?)').run('bad', 'Missing description')).toThrow(/NOT NULL/)
    db.insert(schema.recipes).values({ id: 'recipe', title: 'Soup', description: 'Soup' }).run()
    expect(() => db.insert(schema.recipes).values({ id: 'recipe', title: 'Duplicate', description: 'Duplicate' }).run()).toThrow()
    for (const table of ['ingredients', 'steps', 'recipe_equipment', 'cooking_sessions']) {
      const insert = {
        ingredients: "INSERT INTO ingredients (id, recipe_id, name, amount, unit) VALUES ('orphan', 'missing', 'Salt', 1, 'g')",
        steps: "INSERT INTO steps (id, recipe_id, step_number, instruction) VALUES ('orphan', 'missing', 1, 'Mix')",
        recipe_equipment: "INSERT INTO recipe_equipment (id, recipe_id, name) VALUES ('orphan', 'missing', 'Pan')",
        cooking_sessions: "INSERT INTO cooking_sessions (id, recipe_id) VALUES ('orphan', 'missing')"
      }[table]!
      expect(() => sqlite.exec(insert)).toThrow(/FOREIGN KEY/)
    }
    expect(() => sqlite.exec("INSERT INTO grocery_items (id, list_id, name) VALUES ('orphan', 'missing', 'Salt')")).toThrow(/FOREIGN KEY/)
  })

  it('can apply migrations again without losing data', () => {
    connection.db.insert(schema.guests).values({ id: 'guest', name: 'Alex' }).run()
    migrate(connection.db, { migrationsFolder })
    expect(connection.db.select().from(schema.guests).all()).toHaveLength(1)
  })
})

it('initializes the application database with foreign-key enforcement', async () => {
  vi.stubEnv('DATABASE_URL', ':memory:')
  try {
    const { db } = await import('../server/db/index')
    try {
      expect(db.$client.pragma('foreign_keys', { simple: true })).toBe(1)
      migrate(db, { migrationsFolder })
      expect(db.select().from(schema.recipes).all()).toEqual([])
    } finally {
      db.$client.close()
    }
  } finally {
    vi.unstubAllEnvs()
    vi.resetModules()
  }
})
