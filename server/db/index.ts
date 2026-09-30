import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import { normalizeGreekText } from '../utils/search'

const defaultDbPath = fileURLToPath(new URL('../../heirloom.db', import.meta.url))
const sqlite = new Database(process.env.DATABASE_URL || defaultDbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')
sqlite.function('greek_lower', { deterministic: true }, value =>
  typeof value === 'string' ? normalizeGreekText(value) : value)

export const db = drizzle(sqlite, { schema })
