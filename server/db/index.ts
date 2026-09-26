import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

const sqlite = new Database(process.env.DATABASE_URL || './heirloom.db')
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')
sqlite.function('greek_lower', { deterministic: true }, value =>
  typeof value === 'string' ? value.normalize('NFC').toLocaleLowerCase('el-GR') : value)

export const db = drizzle(sqlite, { schema })
