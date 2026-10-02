import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, it } from 'vitest'

let directory: string
let sqlite: Database.Database

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'heirloom-query-plan-'))
  sqlite = new Database(join(directory, 'cookbook.sqlite'))
  sqlite.pragma('foreign_keys = ON')
  migrate(drizzle(sqlite), { migrationsFolder: fileURLToPath(new URL('../server/db/migrations', import.meta.url)) })
  sqlite.transaction(() => {
    const recipe = sqlite.prepare('INSERT INTO recipes (id, title, description, parent_recipe_id, created_at) VALUES (?, ?, \'\', ?, ?)')
    const list = sqlite.prepare('INSERT INTO grocery_lists (id, title) VALUES (?, \'Market\')')
    const item = sqlite.prepare('INSERT INTO grocery_items (id, list_id, name) VALUES (?, ?, \'Beans\')')
    const session = sqlite.prepare('INSERT INTO cooking_sessions (id, recipe_id) VALUES (?, ?)')
    for (let n = 0; n < 1000; n++) {
      const id = String(n).padStart(4, '0')
      recipe.run(id, `Recipe ${n}`, n === 0 ? null : '0000', `2026-10-${String(1 + n % 28).padStart(2, '0')}T12:00:00.000Z`)
      list.run(id)
      item.run(id, id)
      session.run(id, id)
    }
  })()
})

afterAll(() => {
  if (sqlite?.open) sqlite.close()
  if (directory) rmSync(directory, { recursive: true, force: true })
})

it.each([
  ['SELECT id, title FROM recipes WHERE parent_recipe_id = ?', '0000', 'recipes_parent_recipe_id_idx'],
  ['SELECT * FROM grocery_items WHERE list_id = ?', '0000', 'grocery_items_list_id_idx'],
  ['SELECT * FROM cooking_sessions WHERE recipe_id = ?', '0000', 'cooking_sessions_recipe_id_idx']
])('uses an indexed lookup for %s', (query, id, indexName) => {
  const plan = sqlite.prepare(`EXPLAIN QUERY PLAN ${query}`).all(id) as { detail: string }[]
  expect(plan.some(row => row.detail.includes('SEARCH') && row.detail.includes(indexName))).toBe(true)
  expect(plan.some(row => /SCAN |TEMP B-TREE/.test(row.detail))).toBe(false)
  expect(sqlite.prepare(query).all(id).length).toBeGreaterThan(0)
})

it('uses the created-at index for newest-first recipes with stable ascending ids and no temporary sort', () => {
  const query = 'SELECT * FROM recipes ORDER BY created_at DESC, id ASC'
  const plan = sqlite.prepare(`EXPLAIN QUERY PLAN ${query}`).all() as { detail: string }[]
  expect(plan.some(row => row.detail.includes('recipes_created_at_idx'))).toBe(true)
  expect(plan.some(row => row.detail.includes('TEMP B-TREE'))).toBe(false)
  const recipes = sqlite.prepare(query).all() as { id: string, created_at: string }[]
  expect(recipes).toHaveLength(1000)
  for (let n = 1; n < recipes.length; n++) {
    const previous = recipes[n - 1]!
    const current = recipes[n]!
    expect(previous.created_at >= current.created_at).toBe(true)
    if (previous.created_at === current.created_at) expect(previous.id < current.id).toBe(true)
  }
})
