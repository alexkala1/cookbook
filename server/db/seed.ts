import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { db } from './index'
import { seedStarterRecipes } from '../utils/seed'

try {
  migrate(db, { migrationsFolder: fileURLToPath(new URL('./migrations', import.meta.url)) })
  const { created } = seedStarterRecipes()
  console.log(created ? `Loaded ${created} starter heirloom recipes.` : 'Cookbook already contains recipes; nothing changed.')
} finally {
  db.$client.close()
}
