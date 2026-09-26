import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { db } from '../db'

export default defineNitroPlugin(() => {
  try {
    const migrationsFolder = fileURLToPath(new URL('../db/migrations', import.meta.url))
    if (existsSync(migrationsFolder)) {
      migrate(db, { migrationsFolder })
    }
  } catch (error) {
    console.error('[heirloom] database migration error on boot:', error)
  }
})
