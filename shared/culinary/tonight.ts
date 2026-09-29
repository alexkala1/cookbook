import { ingredientKey, normalizePantryName } from './pantry'

export const BASIC_KITCHEN_STAPLES = [
  'olive oil', 'extra virgin olive oil', 'salt', 'sea salt', 'black pepper', 'pepper', 'water',
  'ελαιολαδο', 'αλατι', 'πιπερι', 'νερο'
] as const

export interface TonightStapleChip {
  id: string
  label: string
  emoji: string
  query: string
}

export const TONIGHT_CHIPS: readonly TonightStapleChip[] = [
  { id: 'eggs', label: 'Eggs', emoji: '🥚', query: 'eggs' },
  { id: 'tomatoes', label: 'Tomatoes', emoji: '🍅', query: 'tomatoes' },
  { id: 'feta', label: 'Feta', emoji: '🧀', query: 'feta' },
  { id: 'pasta', label: 'Pasta', emoji: '🍝', query: 'pasta' },
  { id: 'garlic', label: 'Garlic', emoji: '🧄', query: 'garlic' },
  { id: 'onions', label: 'Onions', emoji: '🧅', query: 'onions' },
  { id: 'chicken', label: 'Chicken', emoji: '🍗', query: 'chicken' },
  { id: 'potatoes', label: 'Potatoes', emoji: '🥔', query: 'potatoes' }
] as const

export interface TonightMatchInput {
  id: string
  title: string
  totalTimeMinutes?: number | null
  ingredients: { name: string; amount?: number; unit?: string }[]
}

export interface TonightMatchResult {
  id: string
  title: string
  totalTimeMinutes: number | null
  tier: 'ready' | 'missing-1' | 'missing-2' | 'other'
  matchedIngredients: string[]
  missingIngredients: string[]
  assumedStaples: string[]
  completeness: number
}

const stapleKeys = new Set(BASIC_KITCHEN_STAPLES.map(name => ingredientKey(normalizePantryName(name))))
const tierPriority = { ready: 0, 'missing-1': 1, 'missing-2': 2, other: 3 }

/** Matches ingredient presence only; amounts and units do not establish sufficient stock. */
export function matchTonight(
  recipes: TonightMatchInput[],
  selectedIngredients: string[],
  options?: { includeAssumedStaples?: boolean }
): TonightMatchResult[] {
  const selected = new Set(selectedIngredients.map(name => ingredientKey(normalizePantryName(name))).filter(Boolean))
  if (!selected.size) return []
  return recipes.map((recipe): TonightMatchResult => {
    const matchedIngredients: string[] = [], missingIngredients: string[] = [], assumedStaples: string[] = []
    for (const ingredient of recipe.ingredients) {
      const key = ingredientKey(normalizePantryName(ingredient.name))
      if (selected.has(key)) matchedIngredients.push(ingredient.name)
      else if (options?.includeAssumedStaples !== false && stapleKeys.has(key)) assumedStaples.push(ingredient.name)
      else missingIngredients.push(ingredient.name)
    }
    const missing = missingIngredients.length
    return {
      id: recipe.id, title: recipe.title, totalTimeMinutes: recipe.totalTimeMinutes ?? null,
      tier: missing === 0 ? 'ready' : missing === 1 ? 'missing-1' : missing === 2 ? 'missing-2' : 'other',
      matchedIngredients, missingIngredients, assumedStaples,
      completeness: recipe.ingredients.length ? Math.round((matchedIngredients.length + assumedStaples.length) / recipe.ingredients.length * 100) : 0
    }
  }).filter(recipe => recipe.matchedIngredients.length > 0)
    .sort((a, b) => tierPriority[a.tier] - tierPriority[b.tier]
      || (a.totalTimeMinutes ?? Infinity) - (b.totalTimeMinutes ?? Infinity)
      || a.title.localeCompare(b.title))
}
