import { describe, expect, it, vi } from 'vitest'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { db } from '../server/db'
import { recipes } from '../server/db/schema'
import { listRecipes, getRecipe, saveRecipe } from '../server/utils/recipes'
import { listPantry, savePantry, pantryMatches } from '../server/utils/pantry'
import { seedStarterRecipes } from '../server/utils/seed'
import { z } from 'zod'
import '../server/mcp/index'

const registered = vi.hoisted(() => new Map<string, { schema: z.ZodRawShape, handler: (input: any) => Promise<any> }>())
vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({ McpServer: class {
  tool(name: string, _description: string, schema: z.ZodRawShape, handler: (input: any) => Promise<any>) { registered.set(name, { schema, handler }) }
  async connect() {}
} }))
vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({ StdioServerTransport: class {} }))

async function mcpSave(input: unknown) {
  const tool = registered.get('heirloom_save_recipe')!
  return tool.handler(z.object(tool.schema).parse(input))
}

// Hermetic: an in-memory database, the committed migrations and the starter recipes, never a developer's heirloom.db.
vi.mock('../server/db', async () => { vi.stubEnv('DATABASE_URL', ':memory:'); return vi.importActual('../server/db') })
migrate(db, { migrationsFolder: fileURLToPath(new URL('../server/db/migrations', import.meta.url)) })
seedStarterRecipes()

describe('Heirloom MCP Server core capabilities', () => {
  it('preserves omitted fields and child identities through the actual MCP update schema', async () => {
    const original = saveRecipe({ title: 'Family Lemonade', description: 'Keepsake', heirloomNotes: 'Grandmother’s handwritten notes', difficulty: 'easy', servings: 7, prepTimeMinutes: 3, cookTimeMinutes: 0, totalTimeMinutes: 3, recipeType: 'drink', sourceType: 'prompt', ingredients: [{ name: 'water', amount: 1, unit: 'l' }], steps: [{ stepNumber: 1, instruction: 'Pour and serve.' }], equipment: [{ name: 'Pitcher', isEssential: true, substituteTool: 'Jug' }] })
    const result = await mcpSave({ id: original.id, recipe: { title: 'Renamed Family Lemonade' } })
    expect(result.isError).not.toBe(true)
    expect(getRecipe(original.id)).toEqual({ ...original, title: 'Renamed Family Lemonade', updatedAt: expect.any(String) })
    const replaced = await mcpSave({ id: original.id, recipe: { heirloomNotes: '', servings: 2, prepTimeMinutes: 0, equipment: [] } })
    expect(replaced.isError).not.toBe(true)
    expect(getRecipe(original.id)).toMatchObject({ heirloomNotes: '', servings: 2, prepTimeMinutes: 0, totalTimeMinutes: 3, equipment: [] })
  })
  it('retains creation defaults and rejects incomplete or unknown-ID saves', async () => {
    const input = { title: 'New MCP recipe', ingredients: [{ name: 'water', amount: 1, unit: 'l' }], steps: [{ stepNumber: 1, instruction: 'Pour.' }] }
    const result = await mcpSave({ recipe: input })
    expect(result.isError).not.toBe(true)
    expect(JSON.parse(result.content[0].text).recipe).toMatchObject({ description: '', servings: 4, difficulty: 'intermediate', prepTimeMinutes: 15, cookTimeMinutes: 30, totalTimeMinutes: 45, equipment: [] })
    expect((await mcpSave({ recipe: { title: 'Incomplete' } })).isError).toBe(true)
    expect((await mcpSave({ id: '00000000-0000-4000-8000-000000000000', recipe: input })).isError).toBe(true)
  })
  it('writes sequential ingredient and step sortOrder regardless of supplied collisions or jumps', () => {
    const saved = saveRecipe({ title: 'Ordered', description: '', ingredients: [{ name: 'water', amount: 1, unit: 'l', sortOrder: 80 }, { name: 'salt', amount: 1, unit: 'g', sortOrder: 80 }], steps: [{ stepNumber: 1, instruction: 'Pour.', sortOrder: 900 }, { stepNumber: 2, instruction: 'Stir.', sortOrder: 0 }] })
    expect(saved.ingredients.map(row => [row.name, row.sortOrder])).toEqual([['water', 1], ['salt', 2]])
    expect(saved.steps.map(row => row.sortOrder)).toEqual([1, 2])
    const updated = saveRecipe({ ingredients: [{ name: 'oil', amount: 1, unit: 'ml' }], steps: [{ stepNumber: 1, instruction: 'Serve.' }] }, saved.id)
    expect(updated.ingredients[0]!.sortOrder).toBe(1)
    expect(updated.steps[0]!.sortOrder).toBe(1)
  })
  it('lists existing recipes from the database', () => {
    const list = listRecipes({})
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBeGreaterThan(0)
  })

  it('retrieves recipe details by ID including ingredients and steps', () => {
    const first = listRecipes({})[0]!
    const recipe = getRecipe(first.id)
    expect(recipe.id).toBe(first.id)
    expect(Array.isArray(recipe.ingredients)).toBe(true)
    expect(Array.isArray(recipe.steps)).toBe(true)
  })

  it('saves and updates a recipe with schema validation', () => {
    const testRecipe = {
      title: 'MCP Test Lemonade',
      description: 'Refreshing citrus drink for testing.',
      recipeType: 'drink' as const,
      servings: 2,
      prepTimeMinutes: 5,
      cookTimeMinutes: 0,
      totalTimeMinutes: 5,
      difficulty: 'easy' as const,
      ingredients: [
        { name: 'fresh lemon juice', amount: 60, unit: 'ml' },
        { name: 'cold water', amount: 250, unit: 'ml' },
        { name: 'honey', amount: 1, unit: 'tbsp' }
      ],
      steps: [
        { stepNumber: 1, instruction: 'Stir lemon juice, water, and honey together until dissolved.' }
      ],
      equipment: [{ name: 'glass' }]
    }

    const saved = saveRecipe(testRecipe)
    expect(saved.id).toBeDefined()
    expect(saved.title).toBe('MCP Test Lemonade')
    expect(saved.ingredients).toHaveLength(3)
    expect(saved.steps).toHaveLength(1)

    // Clean up
    const { eq } = require('drizzle-orm')
    db.delete(recipes).where(eq(recipes.id, saved.id)).run()
  })

  it('lists and updates pantry items', () => {
    const items = [
      { name: 'Diamond Crystal Kosher Salt', quantity: 500, unit: 'g', storageLocation: 'pantry' as const }
    ]
    const updated = savePantry(items)
    expect(updated).toHaveLength(1)
    expect(updated[0]!.name).toBe('Diamond Crystal Kosher Salt')

    const pantry = listPantry()
    expect(pantry.some(p => p.normalizedName.includes('diamond crystal'))).toBe(true)
  })

  it('computes recipe matches against current pantry', () => {
    const matches = pantryMatches()
    expect(Array.isArray(matches)).toBe(true)
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0]).toHaveProperty('completeness')
  })
})
