import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('preserves existing pantry stock when extending the storage constraint', () => {
  const db = new Database(':memory:')
  try {
    db.exec(`CREATE TABLE pantry_items (
      id text PRIMARY KEY NOT NULL, name text NOT NULL, normalized_name text NOT NULL,
      quantity real DEFAULT 1 NOT NULL, unit text DEFAULT 'item' NOT NULL,
      storage_location text DEFAULT 'pantry' NOT NULL CHECK(storage_location IN ('pantry', 'fridge', 'freezer')),
      expires_at integer, created_at integer NOT NULL, updated_at integer NOT NULL
    ); CREATE INDEX pantry_name_location_idx ON pantry_items(normalized_name, storage_location);`)
    db.prepare('INSERT INTO pantry_items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('old', 'Feta', 'feta', 200, 'g', 'fridge', 1900000000000, 100, 200)
    const before = db.prepare('SELECT * FROM pantry_items').all()
    const migration = readFileSync(new URL('../server/db/migrations/0007_pantry_spices.sql', import.meta.url), 'utf8')
    db.transaction(() => db.exec(migration))()
    expect(db.prepare('SELECT * FROM pantry_items').all()).toEqual(before)
    db.prepare('INSERT INTO pantry_items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('new', 'Oregano', 'oregano', 50, 'g', 'spices', null, 300, 300)
    expect(db.prepare("SELECT storage_location FROM pantry_items WHERE id='new'").get()).toEqual({ storage_location: 'spices' })
    expect(() => db.exec("UPDATE pantry_items SET storage_location='garage'")).toThrow(/CHECK/)
    expect(db.pragma('foreign_key_check')).toEqual([])
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='pantry_name_location_idx'").get()).toBeTruthy()
  } finally {
    db.close()
  }
})
