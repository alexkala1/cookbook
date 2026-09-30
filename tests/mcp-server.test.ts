import { describe, expect, it } from 'vitest'
import { db } from '../server/db/index'
import { recipes } from '../server/db/schema'
import { listRecipes, getRecipe, saveRecipe } from '../server/utils/recipes'
import { listPantry, savePantry, pantryMatches } from '../server/utils/pantry'

describe('Heirloom MCP Server core capabilities', () => {
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
