import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, expect, it } from 'vitest'

const migrationsFolder = fileURLToPath(new URL('../server/db/migrations', import.meta.url))
let directory: string
let sqlite: Database.Database

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'heirloom-migration-'))
  sqlite = new Database(join(directory, 'cookbook.sqlite'))
  sqlite.pragma('foreign_keys = ON')
})

afterEach(() => {
  if (sqlite.open) sqlite.close()
  rmSync(directory, { recursive: true, force: true })
})

it('creates the complete cookbook schema and performance indexes on a fresh disk database', () => {
  migrate(drizzle(sqlite), { migrationsFolder })
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY name").all()
  expect(tables).toEqual([
    'cook_logs', 'cooking_sessions', 'grocery_items', 'grocery_lists', 'guests', 'ingredients',
    'pantry_items', 'recipe_equipment', 'recipe_memories', 'recipes', 'steps', 'user_kitchen_profile'
  ].map(name => ({ name })))
  for (const name of [
    'recipes_parent_recipe_id_idx', 'recipes_created_at_idx', 'grocery_items_list_id_idx',
    'cooking_sessions_recipe_id_idx', 'ingredients_recipe_id_idx', 'steps_recipe_id_idx',
    'recipe_equipment_recipe_id_idx', 'cook_logs_recipe_id_idx', 'recipe_memories_recipe_id_idx',
    'pantry_name_location_idx'
  ]) {
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?").get(name)).toEqual({ name })
  }
  expect(sqlite.pragma('foreign_key_check')).toEqual([])
  expect(sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
})

it('enforces every recipe and grocery foreign key and cascades only the deleted parent children', () => {
  migrate(drizzle(sqlite), { migrationsFolder })
  sqlite.exec("INSERT INTO recipes (id, title, description) VALUES ('kept', 'Bread', ''), ('removed', 'Soup', ''); INSERT INTO grocery_lists (id, title) VALUES ('kept', 'Market'), ('removed', 'Market')")
  const children = [
    { table: 'ingredients', parent: 'recipes', column: 'recipe_id', insert: 'INSERT INTO ingredients (id, recipe_id, name, amount, unit) VALUES (?, ?, \'Flour\', 500, \'g\')' },
    { table: 'steps', parent: 'recipes', column: 'recipe_id', insert: 'INSERT INTO steps (id, recipe_id, step_number, instruction) VALUES (?, ?, 1, \'Cook\')' },
    { table: 'recipe_equipment', parent: 'recipes', column: 'recipe_id', insert: 'INSERT INTO recipe_equipment (id, recipe_id, name) VALUES (?, ?, \'Pot\')' },
    { table: 'cooking_sessions', parent: 'recipes', column: 'recipe_id', insert: 'INSERT INTO cooking_sessions (id, recipe_id) VALUES (?, ?)' },
    { table: 'cook_logs', parent: 'recipes', column: 'recipe_id', insert: 'INSERT INTO cook_logs (id, recipe_id) VALUES (?, ?)' },
    { table: 'recipe_memories', parent: 'recipes', column: 'recipe_id', insert: 'INSERT INTO recipe_memories (id, recipe_id, cook_date, created_at) VALUES (?, ?, 1, 1)' },
    { table: 'grocery_items', parent: 'grocery_lists', column: 'list_id', insert: 'INSERT INTO grocery_items (id, list_id, name) VALUES (?, ?, \'Flour\')' }
  ]
  for (const child of children) {
    expect(sqlite.pragma(`foreign_key_list(${child.table})`)).toEqual([
      expect.objectContaining({ table: child.parent, from: child.column, to: 'id', on_delete: 'CASCADE' })
    ])
    const insert = sqlite.prepare(child.insert)
    expect(() => insert.run('orphan', 'missing')).toThrow(/FOREIGN KEY constraint failed/)
    insert.run('kept', 'kept')
    insert.run('removed', 'removed')
  }
  sqlite.exec("DELETE FROM recipes WHERE id = 'removed'; DELETE FROM grocery_lists WHERE id = 'removed'")
  for (const child of children) {
    expect(sqlite.prepare(`SELECT id FROM ${child.table}`).all()).toEqual([{ id: 'kept' }])
  }
  expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1)
  expect(sqlite.pragma('foreign_key_check')).toEqual([])
})

it('preserves existing data through the latest migration and repeated migrations after reopening', () => {
  const migrations = readMigrationFiles({ migrationsFolder })
  sqlite.exec('CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)')
  for (const migration of migrations.slice(0, -1)) {
    sqlite.transaction(() => {
      for (const statement of migration.sql) sqlite.exec(statement)
      sqlite.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(migration.hash, migration.folderMillis)
    })()
  }
  sqlite.exec("INSERT INTO recipes (id, title, description, heirloom_notes) VALUES ('kept', 'Φασολάδα', 'Family soup', 'Grandmother’s notes'); INSERT INTO ingredients (id, recipe_id, name, amount, unit) VALUES ('beans', 'kept', 'Beans', 500, 'g')")
  migrate(drizzle(sqlite), { migrationsFolder })
  sqlite.close()
  sqlite = new Database(join(directory, 'cookbook.sqlite'))
  sqlite.pragma('foreign_keys = ON')
  migrate(drizzle(sqlite), { migrationsFolder })
  migrate(drizzle(sqlite), { migrationsFolder })
  expect(sqlite.prepare('SELECT id, title, heirloom_notes FROM recipes').all()).toEqual([{ id: 'kept', title: 'Φασολάδα', heirloom_notes: 'Grandmother’s notes' }])
  expect(sqlite.prepare('SELECT recipe_id, name, amount, unit FROM ingredients').all()).toEqual([{ recipe_id: 'kept', name: 'Beans', amount: 500, unit: 'g' }])
  expect(sqlite.prepare('SELECT COUNT(*) AS count FROM __drizzle_migrations').get()).toEqual({ count: migrations.length })
  expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'recipes_created_at_idx'").get()).toEqual({ name: 'recipes_created_at_idx' })
  expect(sqlite.pragma('foreign_key_check')).toEqual([])
  expect(sqlite.pragma('integrity_check', { simple: true })).toBe('ok')
})
