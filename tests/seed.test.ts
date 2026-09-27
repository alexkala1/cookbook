import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, createRouter, toWebHandler } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { fileURLToPath } from 'node:url'
import { db } from '../server/db'
import { recipes, ingredients, steps, recipeEquipment } from '../server/db/schema'
import seed from '../server/api/recipes/seed.post'
import csrf from '../server/middleware/csrf'
import { seedStarterRecipes } from '../server/utils/seed'
import { getRecipe, saveRecipe } from '../server/utils/recipes'

vi.mock('../server/db', async () => {
  vi.stubEnv('DATABASE_URL', ':memory:')
  return await vi.importActual('../server/db')
})
migrate(db, { migrationsFolder: fileURLToPath(new URL('../server/db/migrations', import.meta.url)) })
const app = createApp().use(csrf).use(createRouter().post('/api/recipes/seed', seed))
const handle = toWebHandler(app)
const request = (origin = 'http://localhost') => handle(new Request('http://localhost/api/recipes/seed', {
  method: 'POST', headers: { Host: 'localhost', Origin: origin }
}))
beforeEach(() => db.delete(recipes).run())
afterAll(() => { db.$client.close(); vi.unstubAllEnvs() })

describe('starter heirloom pack', () => {
  it('loads five complete recipes through HTTP and preserves stable rows on repeated calls', async () => {
    const response = await request()
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ created: 5 })
    const originals = db.select().from(recipes).all()
    expect(originals.map(row => row.title)).toEqual(['Arni me Patates', 'Traditional Spanakopita', 'Santorini Fava', 'Classic Fasolada', 'Revani with Citrus Syrup'])
    for (const row of originals) {
      const recipe = getRecipe(row.id)
      expect(recipe.ingredients.length).toBeGreaterThan(5)
      expect(recipe.equipment.length).toBeGreaterThan(1)
      expect(recipe.steps.length).toBeGreaterThan(2)
      expect(recipe.steps.some(step => step.scienceWhy && step.sensoryTexture || step.scienceWhy && step.sensoryVisual)).toBe(true)
      expect(recipe.heirloomNotes).toBeTruthy()
      expect(recipe.rating).toBeNull()
      expect(recipe.isFavorite).toBe(false)
      expect(recipe.originalSaltType).toBe('greek_fine_sea_salt')
    }
    const lamb = getRecipe(originals[0]!.id)
    expect(lamb.steps.some(step => step.internalTempTargetC === 74 && step.instruction.includes('190°C'))).toBe(true)
    expect(getRecipe(originals[3]!.id).steps[0]?.durationMinutes).toBe(720)
    const repeated = await request()
    expect(repeated.status).toBe(200)
    expect(await repeated.json()).toEqual({ created: 0 })
    expect(db.select().from(recipes).all()).toEqual(originals)
  })

  it('never adds starters to or overwrites a populated cookbook', async () => {
    const own = saveRecipe({ title: 'My family recipe', description: 'Keep me' })
    expect(await (await request()).json()).toEqual({ created: 0 })
    expect(db.select().from(recipes).all()).toHaveLength(1)
    expect(getRecipe(own.id)).toEqual(own)
  })

  it('rolls back the entire pack when a later nested write fails, then permits retry', () => {
    db.$client.exec("CREATE TRIGGER reject_seed BEFORE INSERT ON ingredients WHEN NEW.name = 'Yellow split peas' BEGIN SELECT RAISE(ABORT, 'seed failure'); END")
    try {
      expect(() => seedStarterRecipes()).toThrow('seed failure')
      for (const table of [recipes, ingredients, steps, recipeEquipment]) expect(db.select().from(table).all()).toEqual([])
    } finally { db.$client.exec('DROP TRIGGER reject_seed') }
    expect(seedStarterRecipes()).toEqual({ created: 5 })
  })

  it('handles simultaneous requests without duplicates', async () => {
    const responses = await Promise.all([request(), request(), request()])
    expect(responses.map(response => response.status).sort()).toEqual([200, 200, 201])
    expect(db.select().from(recipes).all()).toHaveLength(5)
  })

  it('rejects cross-origin seed requests without writes', async () => {
    expect((await request('https://attacker.example')).status).toBe(403)
    expect(db.select().from(recipes).all()).toEqual([])
  })
})
