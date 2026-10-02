import { afterAll, beforeEach, expect, it, vi } from 'vitest'

const { existsSync, migrate } = vi.hoisted(() => ({ existsSync: vi.fn(), migrate: vi.fn() }))
vi.mock('node:fs', () => ({ existsSync }))
vi.mock('drizzle-orm/better-sqlite3/migrator', () => ({ migrate }))
vi.mock('../server/db', () => ({ db: {} }))
vi.stubGlobal('defineNitroPlugin', (callback: () => void) => callback)
const { default: run } = await import('../server/plugins/migrations')
beforeEach(() => { existsSync.mockReset(); migrate.mockReset() })
afterAll(() => vi.unstubAllGlobals())

it.each([0, 1, 2])('migrates using folder candidate %s when available', candidate => {
  const folders = [
    new URL('../server/db/migrations', import.meta.url).pathname,
    new URL('../server/plugins/db/migrations', import.meta.url).pathname,
    `${process.cwd()}/server/db/migrations`
  ]
  let checks = 0
  existsSync.mockImplementation(() => checks++ >= candidate)
  run()
  expect(migrate).toHaveBeenCalledExactlyOnceWith({}, { migrationsFolder: folders[candidate] })
})

it('reports missing packaged migrations instead of silently leaving the database unmigrated', () => {
  existsSync.mockReturnValue(false)
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    run()
    expect(migrate).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledExactlyOnceWith('[heirloom] migrations folder not found; database was not migrated')
  } finally { error.mockRestore() }
})

it('reports migration failures distinctly from a missing folder', () => {
  existsSync.mockReturnValue(true)
  const failure = new Error('Database unavailable')
  migrate.mockImplementation(() => { throw failure })
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    run()
    expect(error).toHaveBeenCalledExactlyOnceWith('[heirloom] database migration error on boot:', failure)
  } finally { error.mockRestore() }
})
