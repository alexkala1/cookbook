import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import { normalizeGreekText } from '../utils/search'

const defaultDbPath = resolve(process.cwd(), 'heirloom.db')
const dbPath = process.env.DATABASE_URL || defaultDbPath
if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true })
const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')
sqlite.function('greek_lower', { deterministic: true }, value =>
  typeof value === 'string' ? normalizeGreekText(value) : value)

export const db = drizzle(sqlite, { schema })
