import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

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

