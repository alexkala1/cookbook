import { describe, expect, it, vi } from 'vitest'
import { importedRecipes, replaceAt, saveAllRecipes, switchTo } from '../app/utils/multi-recipe-import'
import type { RecipeInput } from '../server/utils/validation'

const recipe = (title: string, extra: Partial<RecipeInput> = {}) => ({ title, ingredients: [], steps: [], ...extra }) as unknown as RecipeInput
const titles = (list: readonly RecipeInput[]) => list.map(item => item.title)

describe('importedRecipes', () => {
  it('prefers recipes, falls back to the single recipe, and tolerates neither', () => {
    expect(titles(importedRecipes({ recipes: [recipe('A'), recipe('B')], recipe: recipe('Z') }))).toEqual(['A', 'B'])
    expect(titles(importedRecipes({ recipe: recipe('Solo') }))).toEqual(['Solo'])
    expect(titles(importedRecipes({ recipes: [], recipe: recipe('Solo') }))).toEqual(['Solo'])
    expect(importedRecipes({})).toEqual([])
  })
  it('adds a photographed card only to recipes without their own image, without mutating the input', () => {
    const own = recipe('B', { imageUrl: 'data:own' }), plain = recipe('A')
    expect(importedRecipes({ recipes: [plain, own] }, 'data:photo').map(item => item.imageUrl)).toEqual(['data:photo', 'data:own'])
    expect(plain.imageUrl).toBeUndefined()
  })
})

describe('switching between recipes', () => {
  it('moves to a valid index and ignores anything else', () => {
    expect(switchTo(3, 0, 2)).toBe(2)
    expect(switchTo(3, 2, 0)).toBe(0)
    for (const bad of [3, 7, -1, 1.5, NaN, '1', undefined]) expect(switchTo(3, 1, bad)).toBe(1)
  })
  it('replaces only the selected recipe, keeping edits to the others', () => {
    const list = [recipe('One'), recipe('Two'), recipe('Three')]
    const edited = replaceAt(list, 1, recipe('Δύο'))
    expect(titles(edited)).toEqual(['One', 'Δύο', 'Three'])
    expect(titles(list)).toEqual(['One', 'Two', 'Three'])
    expect(titles(replaceAt([], 0, recipe('First')))).toEqual(['First'])
  })
})

describe('save all', () => {
  it('saves every recipe, in order, leaving nothing behind', async () => {
    const post = vi.fn(async () => ({ id: 'x' }))
    const result = await saveAllRecipes([recipe('A'), recipe('B'), recipe('C')], post)
    expect(result).toEqual({ saved: 3, failed: 0, remaining: [] })
    expect(post.mock.calls.map(([item]) => (item as RecipeInput).title)).toEqual(['A', 'B', 'C'])
  })
  it('saves the edited version of a recipe', async () => {
    const edited = replaceAt([recipe('A'), recipe('B')], 1, recipe('B, edited'))
    const sent: string[] = []
    await saveAllRecipes(edited, async item => { sent.push(item.title) })
    expect(sent).toEqual(['A', 'B, edited'])
  })
  it('keeps only the recipes that failed, so a retry never saves one twice', async () => {
    const first = await saveAllRecipes([recipe('A'), recipe('B'), recipe('C')], async item => { if (item.title === 'B') throw new Error('nope') })
    expect(first.saved).toBe(2)
    expect(first.failed).toBe(1)
    expect(titles(first.remaining)).toEqual(['B'])
    const retry = vi.fn(async () => ({}))
    expect(await saveAllRecipes(first.remaining, retry)).toMatchObject({ saved: 1, failed: 0 })
    expect(retry).toHaveBeenCalledTimes(1)
  })
  it('does nothing for an empty list', async () => {
    expect(await saveAllRecipes([], vi.fn())).toEqual({ saved: 0, failed: 0, remaining: [] })
  })
})

describe('single-recipe backwards compatibility', () => {
  it('yields exactly one recipe, so the page shows no switcher', () => {
    expect(importedRecipes({ recipe: recipe('Only') }, '')).toHaveLength(1)
    expect(importedRecipes({ recipes: [recipe('Only')] })).toHaveLength(1)
  })
  it('has no recipes before an import and after a failed one', () => {
    expect(importedRecipes({})).toEqual([])
  })
})
