import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, createRouter, toWebHandler } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { fileURLToPath } from 'node:url'
import { db } from '../server/db'
import * as tables from '../server/db/schema'
import exportHandler from '../server/api/backup/export.get'
import importHandler from '../server/api/backup/import.post'
import csrf from '../server/middleware/csrf'
import { backupSchema, exportBackup, importBackup, type CookbookBackup } from '../server/utils/backup'
import { getRecipe, saveRecipe } from '../server/utils/recipes'
import { savePantry } from '../server/utils/pantry'
import { seedStarterRecipes } from '../server/utils/seed'

vi.mock('../server/db', async () => {
  vi.stubEnv('DATABASE_URL', ':memory:')
  return await vi.importActual('../server/db')
})
migrate(db, { migrationsFolder: fileURLToPath(new URL('../server/db/migrations', import.meta.url)) })
const router = createRouter().get('/api/backup/export', exportHandler).post('/api/backup/import', importHandler)
const handle = toWebHandler(createApp().use(csrf).use(router))
const request = (method = 'GET', body?: unknown, origin = 'http://localhost') => handle(new Request(`http://localhost/api/backup/${method === 'GET' ? 'export' : 'import'}`, {
  method, headers: { Host: 'localhost', Origin: origin, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
}))

beforeEach(() => {
  db.delete(tables.recipes).run()
  db.delete(tables.pantryItems).run()
  db.delete(tables.userKitchenProfile).run()
})
afterAll(() => { db.$client.close(); vi.unstubAllEnvs() })

function populate() {
  const recipe = saveRecipe({
    title: 'Γιαγιά’s soup', description: 'Family recipe', heirloomNotes: 'Keep this memory',
    imageUrl: 'data:image/png;base64,YQ==', rating: 4.5, isFavorite: true,
    ingredients: [{ name: 'Beans', amount: 250, unit: 'g', notes: 'Soak overnight', gramsEquivalent: 250 }],
    steps: [{ stepNumber: 2, instruction: 'Serve', sensoryVisual: 'Glossy' }, { stepNumber: 1, instruction: 'Simmer', timerRequired: true, durationMinutes: 30, heatLevel: 'low' }],
    equipment: [{ name: 'Pot', isEssential: true, substituteTool: 'Dutch oven' }]
  })
  savePantry([{ name: 'Φασόλια', quantity: 500, unit: 'g', storageLocation: 'pantry', expiresAt: 1900000000000 }, { name: 'Milk', storageLocation: 'fridge' }])
  db.insert(tables.userKitchenProfile).values({ id: 'default', stoveType: 'induction' }).run()
  return recipe
}

describe('JSON cookbook backup', () => {
  it('exports empty databases as a formatted versioned attachment', async () => {
    const response = await request()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('cache-control')).toBe('no-store')
    const text = await response.text()
    const backup = JSON.parse(text)
    expect(backup).toEqual({ version: 1, exportedAt: expect.any(String), recipes: [], pantry: [] })
    expect(backupSchema.safeParse(backup).success).toBe(true)
    expect(text).toBe(JSON.stringify(backup, null, 2))
    expect(response.headers.get('content-disposition')).toBe(`attachment; filename="heirloom-backup-${backup.exportedAt.slice(0, 10)}.json"`)
  })

  it('exports complete rows, identities, ordered children, pantry and inline images', () => {
    const recipe = populate()
    const backup = exportBackup()
    expect(backupSchema.safeParse(backup).success).toBe(true)
    const { parent: _parent, variations: _variations, ...storedRecipe } = getRecipe(recipe.id)
    expect(backup.recipes).toEqual([storedRecipe])
    expect(backup.pantry).toEqual(db.select().from(tables.pantryItems).orderBy(tables.pantryItems.id).all())
    expect(Object.keys(backup).sort()).toEqual(['exportedAt', 'pantry', 'recipes', 'version'])
  })

  it('exports the full starter pack using transaction-scoped reads', () => {
    seedStarterRecipes()
    const spy = vi.spyOn(db, 'select').mockImplementation(() => { throw new Error('Read outside snapshot') })
    try {
      const backup = exportBackup()
      expect(backup.recipes).toHaveLength(5)
      expect(backupSchema.safeParse(backup).success).toBe(true)
      expect(spy).not.toHaveBeenCalled()
    } finally { spy.mockRestore() }
  })

  it('round-trips a downloaded backup into an empty cookbook without losing any fields', async () => {
    seedStarterRecipes()
    populate()
    const backup = await (await request()).json()
    db.delete(tables.recipes).run()
    db.delete(tables.pantryItems).run()
    const response = await request('POST', backup)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ imported: { recipes: backup.recipes.length, pantry: backup.pantry.length } })
    expect(exportBackup()).toEqual({ ...backup, exportedAt: expect.any(String) })
    expect(db.select().from(tables.userKitchenProfile).get()?.stoveType).toBe('induction')
    expect(db.$client.pragma('foreign_key_check')).toEqual([])
  })

  it('merges matching IDs, replaces their children, and preserves unrelated data and memories', async () => {
    const recipe = populate()
    const backup = exportBackup()
    const unrelated = saveRecipe({ title: 'Keep me', description: '' })
    const [stock] = savePantry({ name: 'Keep my rice' })
    db.insert(tables.recipeMemories).values({ id: 'memory', recipeId: recipe.id, cookDate: 1, notes: 'Keep memory' }).run()
    db.insert(tables.cookingSessions).values({ id: 'session', recipeId: recipe.id }).run()
    saveRecipe({ title: 'Changed after export', ingredients: [{ name: 'New ingredient', amount: 2, unit: 'g' }], steps: [], equipment: [] }, recipe.id)
    db.update(tables.pantryItems).set({ quantity: 99 }).run()
    expect((await request('POST', backup)).status).toBe(200)
    expect(getRecipe(recipe.id)).toEqual({ ...backup.recipes[0], parent: null, variations: [] })
    expect(getRecipe(unrelated.id)).toEqual(unrelated)
    expect(db.select().from(tables.pantryItems).all()).toEqual(expect.arrayContaining(backup.pantry))
    expect(db.select().from(tables.pantryItems).all().find(row => row.id === stock!.id)?.quantity).toBe(99)
    expect(db.select().from(tables.recipeMemories).get()?.notes).toBe('Keep memory')
    expect(db.select().from(tables.cookingSessions).get()?.id).toBe('session')
  })

  it('repeated imports are idempotent and do not add pantry quantities', async () => {
    populate()
    const backup = exportBackup()
    const responses = await Promise.all([request('POST', backup), request('POST', backup)])
    expect(responses.map(response => response.status)).toEqual([200, 200])
    expect(exportBackup()).toEqual({ ...backup, exportedAt: expect.any(String) })
  })

  it('treats an empty backup as a non-destructive no-op', () => {
    populate()
    const before = exportBackup()
    expect(importBackup({ version: 1, exportedAt: new Date().toISOString(), recipes: [], pantry: [] })).toEqual({ imported: { recipes: 0, pantry: 0 } })
    expect(exportBackup()).toEqual({ ...before, exportedAt: expect.any(String) })
  })

  it('preserves null timestamps, original whitespace and derived total times', () => {
    db.insert(tables.recipes).values({ id: 'legacy', title: ' Soup ', description: '\nFamily\n', createdAt: null, updatedAt: null }).run()
    saveRecipe({ title: 'Long process', description: '', prepTimeMinutes: 100000, cookTimeMinutes: 100000 })
    const backup = exportBackup()
    db.delete(tables.recipes).run()
    importBackup(backup)
    expect(exportBackup()).toEqual({ ...backup, exportedAt: expect.any(String) })
  })

  it.each([
    ['version', (value: any) => { value.version = 2 }],
    ['missing pantry', (value: any) => { delete value.pantry }],
    ['invalid timestamp', (value: any) => { value.exportedAt = 'yesterday' }],
    ['unknown field', (value: any) => { value.settings = {} }],
    ['incomplete recipe', (value: any) => { delete value.recipes[0].ingredients }],
    ['negative quantity', (value: any) => { value.pantry[0].quantity = -1 }],
    ['invalid storage', (value: any) => { value.pantry[0].storageLocation = 'garage' }],
    ['invalid image URL', (value: any) => { value.recipes[0].imageUrl = 'javascript:alert(1)' }],
    ['duplicate recipe', (value: any) => { value.recipes.push(value.recipes[0]) }],
    ['duplicate pantry', (value: any) => { value.pantry.push(value.pantry[0]) }],
    ['duplicate child', (value: any) => { value.recipes[0].ingredients.push(value.recipes[0].ingredients[0]) }],
    ['duplicate step number', (value: any) => { value.recipes[0].steps[1].stepNumber = value.recipes[0].steps[0].stepNumber }],
    ['orphan child', (value: any) => { value.recipes[0].ingredients[0].recipeId = 'other' }],
    ['unknown nested field', (value: any) => { value.recipes[0].ingredients[0].extra = true }]
  ])('rejects %s before changing any rows', async (_label, mutate) => {
    populate()
    const before = exportBackup()
    const invalid = structuredClone(before)
    mutate(invalid)
    const response = await request('POST', invalid)
    expect(response.status).toBe(400)
    expect(exportBackup()).toEqual({ ...before, exportedAt: expect.any(String) })
  })

  it('rejects a child ID collision with another recipe without stealing its rows', async () => {
    populate()
    const before = exportBackup()
    const imported = structuredClone(before)
    imported.recipes[0]!.id = 'new-parent'
    for (const collection of ['ingredients', 'steps', 'equipment'] as const) {
      for (const child of imported.recipes[0]![collection]) child.recipeId = 'new-parent'
    }
    expect((await request('POST', imported)).status).toBe(409)
    expect(exportBackup()).toEqual({ ...before, exportedAt: expect.any(String) })
  })

  it.each(['steps', 'pantry_items'])('rolls back the entire restore on a late %s database failure', async table => {
    populate()
    const before = exportBackup()
    const changed = structuredClone(before)
    changed.recipes[0]!.title = 'Must roll back'
    changed.recipes[0]!.ingredients = []
    changed.pantry[0]!.quantity = 8
    const condition = table === 'pantry_items' ? `WHEN NEW.id = '${before.pantry.at(-1)!.id}'` : ''
    db.$client.exec(`CREATE TRIGGER reject_restore BEFORE INSERT ON ${table} ${condition} BEGIN SELECT RAISE(ABORT, 'restore failure'); END`)
    try {
      expect((await request('POST', changed)).status).toBe(500)
      expect(exportBackup()).toEqual({ ...before, exportedAt: expect.any(String) })
    } finally { db.$client.exec('DROP TRIGGER reject_restore') }
    expect((await request('POST', changed)).status).toBe(200)
  })

  it('restores large nested recipes without exceeding SQLite parameter limits', () => {
    const base = saveRecipe({ title: 'Big recipe', description: '' })
    const backup: CookbookBackup = exportBackup()
    backup.recipes[0]!.steps = Array.from({ length: 500 }, (_, index) => ({
      id: `step-${index}`, recipeId: base.id, stepNumber: index + 1, instruction: 'Stir',
      durationMinutes: null, timerRequired: false, heatLevel: null, scienceWhy: null,
      failurePrevention: null, sensoryVisual: null, sensoryAudio: null, sensoryAroma: null,
      sensoryTexture: null, internalTempTargetC: null, sortOrder: index
    }))
    importBackup(backup)
    expect(getRecipe(base.id).steps).toEqual(backup.recipes[0]!.steps)
  })

  it('rejects malformed JSON and cross-origin imports before any writes', async () => {
    populate()
    const before = exportBackup()
    const invalid = await handle(new Request('http://localhost/api/backup/import', {
      method: 'POST', headers: { Host: 'localhost', Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: '{'
    }))
    expect(invalid.status).toBe(400)
    expect((await request('POST', before, 'https://attacker.example')).status).toBe(403)
    expect(exportBackup()).toEqual({ ...before, exportedAt: expect.any(String) })
  })
})
