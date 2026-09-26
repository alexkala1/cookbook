import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

it('preserves legacy pantry locations, Greek names, expiry dates and missing creation times', () => {
  const sqlite = new Database(':memory:')
  try {
    const migrationsFolder = fileURLToPath(new URL('../server/db/migrations', import.meta.url))
    sqlite.exec('CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)')
    for (const migration of readMigrationFiles({ migrationsFolder }).slice(0, 3)) {
      for (const statement of migration.sql) sqlite.exec(statement)
      sqlite.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(migration.hash, migration.folderMillis)
    }
    sqlite.exec("INSERT INTO pantry_items (id, name, quantity, unit, category, expires_at, created_at) VALUES ('milk', 'ΓΑΛΑ', 2, 'l', 'fridge', '2026-10-01T12:00:00.123Z', NULL), ('beans', 'Beans', 500, 'g', 'legumes', NULL, '2026-09-01T12:00:00.000Z')")
    migrate(drizzle(sqlite), { migrationsFolder })
    expect(sqlite.prepare("SELECT normalized_name, quantity, storage_location, expires_at, created_at FROM pantry_items WHERE id='milk'").get()).toEqual({ normalized_name: 'γαλα', quantity: 2, storage_location: 'fridge', expires_at: Date.parse('2026-10-01T12:00:00.123Z'), created_at: expect.any(Number) })
    expect(sqlite.prepare("SELECT storage_location, expires_at FROM pantry_items WHERE id='beans'").get()).toEqual({ storage_location: 'pantry', expires_at: null })
  } finally { sqlite.close() }
})

it('upgrades an existing Phase 0 database without cascading away recipe data', () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.pragma('foreign_keys = ON')
    const migrationsFolder = fileURLToPath(new URL('../server/db/migrations', import.meta.url))
    const initial = readMigrationFiles({ migrationsFolder })[0]!
    for (const statement of initial.sql) sqlite.exec(statement)
    sqlite.exec("CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)")
    sqlite.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(initial.hash, initial.folderMillis)
    sqlite.exec(`
      INSERT INTO recipes (id, title, description) VALUES ('kept', 'Bread', 'Family loaf');
      INSERT INTO ingredients (id, recipe_id, name, amount, unit) VALUES ('i', 'kept', 'Flour', 500, 'g');
      INSERT INTO steps (id, recipe_id, step_number, instruction) VALUES ('s', 'kept', 1, 'Bake');
      INSERT INTO recipe_equipment (id, recipe_id, name) VALUES ('e', 'kept', 'Oven');
      INSERT INTO cooking_sessions (id, recipe_id, session_notes) VALUES ('c', 'kept', 'Crisp crust');
    `)
    migrate(drizzle(sqlite), { migrationsFolder })
    for (const table of ['recipes', 'ingredients', 'steps', 'recipe_equipment', 'cooking_sessions']) {
      expect(sqlite.prepare('SELECT COUNT(*) AS count FROM ' + table).get()).toEqual({ count: 1 })
    }
    expect(sqlite.pragma('foreign_key_check')).toEqual([])
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE '%recipe_id_idx'").all()).toHaveLength(3)
    sqlite.exec("INSERT INTO recipes (id, title, description) VALUES ('new', 'Soup', '')")
    expect(sqlite.prepare("SELECT rating FROM recipes WHERE id = 'new'").get()).toEqual({ rating: null })
  } finally { sqlite.close() }
})

it('upgrades Phase 1 timestamps and salt preferences while preserving both parent-child trees', () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.pragma('foreign_keys = ON')
    const migrationsFolder = fileURLToPath(new URL('../server/db/migrations', import.meta.url))
    const migrations = readMigrationFiles({ migrationsFolder })
    sqlite.exec('CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)')
    for (const migration of migrations.slice(0, 2)) {
      sqlite.transaction(() => {
        for (const statement of migration.sql) sqlite.exec(statement)
        sqlite.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(migration.hash, migration.folderMillis)
      })()
    }
    sqlite.exec(`
      INSERT INTO recipes (id, title, description, created_at, updated_at) VALUES ('kept', 'Φασολάδα', 'Family recipe', '2026-09-26 13:01:51', '2026-09-26T16:01:51.123+03:00');
      INSERT INTO ingredients (id, recipe_id, name, amount, unit) VALUES ('i', 'kept', 'αλάτι', 2, 'tsp');
      INSERT INTO steps (id, recipe_id, step_number, instruction) VALUES ('s', 'kept', 1, 'Simmer');
      INSERT INTO recipe_equipment (id, recipe_id, name) VALUES ('e', 'kept', 'Pot');
      INSERT INTO cooking_sessions (id, recipe_id, started_at, completed_at, session_notes) VALUES ('c', 'kept', '2026-09-26 13:01:51', '2026-09-26 14:01:51', 'Kept');
      INSERT INTO grocery_lists (id, title, created_at) VALUES ('list', 'Market', '2026-09-26 13:01:51');
      INSERT INTO grocery_items (id, list_id, name, amount) VALUES ('item', 'list', 'Beans', 500);
      INSERT INTO pantry_items (id, name, quantity, unit, created_at) VALUES ('pantry', 'Beans', 1, 'kg', '2026-09-26 13:01:51');
      INSERT INTO guests (id, name, created_at) VALUES ('guest', 'Alex', '2026-09-26 13:01:51');
      INSERT INTO guests (id, name, created_at) VALUES ('unknown-time', 'Unknown', NULL);
      INSERT INTO user_kitchen_profile (id, preferred_salt_type) VALUES ('default', 'greek_sea_salt');
    `)
    migrate(drizzle(sqlite), { migrationsFolder })
    expect(sqlite.prepare('SELECT original_salt_type, created_at, updated_at FROM recipes').get()).toEqual({ original_salt_type: null, created_at: '2026-09-26T13:01:51.000Z', updated_at: '2026-09-26T13:01:51.123Z' })
    for (const table of ['ingredients', 'steps', 'recipe_equipment', 'cooking_sessions', 'grocery_lists', 'grocery_items', 'pantry_items']) {
      expect(sqlite.prepare('SELECT COUNT(*) AS count FROM ' + table).get()).toEqual({ count: 1 })
    }
    expect(sqlite.prepare('SELECT created_at FROM grocery_lists').get()).toEqual({ created_at: '2026-09-26T13:01:51.000Z' })
    expect(sqlite.prepare('SELECT created_at, updated_at, normalized_name, storage_location FROM pantry_items').get()).toEqual({ created_at: Date.parse('2026-09-26T13:01:51.000Z'), updated_at: Date.parse('2026-09-26T13:01:51.000Z'), normalized_name: 'beans', storage_location: 'pantry' })
    expect(sqlite.prepare("SELECT created_at FROM guests WHERE id='guest'").get()).toEqual({ created_at: '2026-09-26T13:01:51.000Z' })
    expect(sqlite.prepare("SELECT created_at FROM guests WHERE id='unknown-time'").get()).toEqual({ created_at: null })
    expect(sqlite.prepare('SELECT started_at, completed_at, session_notes FROM cooking_sessions').get()).toEqual({ started_at: '2026-09-26T13:01:51.000Z', completed_at: '2026-09-26T14:01:51.000Z', session_notes: 'Kept' })
    expect(sqlite.prepare('SELECT preferred_salt_type FROM user_kitchen_profile').get()).toEqual({ preferred_salt_type: 'greek_fine_sea_salt' })
    expect(sqlite.prepare('SELECT name, amount FROM grocery_items').get()).toEqual({ name: 'Beans', amount: 500 })
    expect(sqlite.pragma('foreign_key_check')).toEqual([])
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(sqlite.prepare("SELECT name FROM sqlite_temp_master WHERE type='table'").all()).toEqual([])
    migrate(drizzle(sqlite), { migrationsFolder })
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM grocery_items').get()).toEqual({ count: 1 })
  } finally { sqlite.close() }
})
