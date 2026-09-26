import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

const sqlite = new Database(process.env.DATABASE_URL || '/app/data/heirloom.db')
try {
  sqlite.pragma('foreign_keys = ON')
  migrate(drizzle(sqlite), { migrationsFolder: '/app/server/db/migrations' })
  console.info('Database migrations complete')
} finally {
  sqlite.close()
}
