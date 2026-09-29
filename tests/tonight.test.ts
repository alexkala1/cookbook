import { expect, it } from 'vitest'
import { BASIC_KITCHEN_STAPLES, TONIGHT_CHIPS, matchTonight, type TonightMatchInput } from '../shared/culinary/tonight'

function recipe(id: string, names: string[], totalTimeMinutes: number | null = 20): TonightMatchInput {
  return { id, title: id, totalTimeMinutes, ingredients: names.map(name => ({ name })) }
}

it('returns a ready dish when all ingredients are selected', () => {
  expect(matchTonight([recipe('Eggs with feta', ['eggs', 'tomatoes', 'feta'])], ['eggs', 'tomatoes', 'feta'])).toEqual([
    { id: 'Eggs with feta', title: 'Eggs with feta', totalTimeMinutes: 20, tier: 'ready', matchedIngredients: ['eggs', 'tomatoes', 'feta'], missingIngredients: [], assumedStaples: [], completeness: 100 }
  ])
})

it('assumes basic staples and keeps explicitly selected staples in the matched list', () => {
  const dish = recipe('Eggs', ['eggs', 'tomatoes', 'olive oil', 'salt'])
  expect(matchTonight([dish], ['eggs', 'tomatoes', 'salt'])[0]).toMatchObject({
    tier: 'ready', matchedIngredients: ['eggs', 'tomatoes', 'salt'], assumedStaples: ['olive oil'], missingIngredients: [], completeness: 100
  })
  expect(matchTonight([dish], ['eggs', 'tomatoes'], { includeAssumedStaples: false })[0]).toMatchObject({
    tier: 'missing-2', assumedStaples: [], missingIngredients: ['olive oil', 'salt'], completeness: 50
  })
})

it.each(BASIC_KITCHEN_STAPLES)('assumes the basic staple %s by default', staple => {
  expect(matchTonight([recipe('Eggs', ['eggs', staple])], ['egg'])[0]).toMatchObject({ tier: 'ready', assumedStaples: [staple] })
})

it.each([
  [['egg', 'feta'], 'missing-1', 50],
  [['egg', 'feta', 'tomato'], 'missing-2', 33],
  [['egg', 'feta', 'tomato', 'onion'], 'other', 25]
] as const)('assigns missing tiers and rounded completeness for %j', (names, tier, completeness) => {
  expect(matchTonight([recipe('Dinner', [...names])], ['eggs'])[0]).toMatchObject({ tier, completeness, missingIngredients: names.slice(1) })
})

it('sorts tier first, then time with unknown times last, then title', () => {
  const recipes = [
    recipe('Other', ['egg', 'a', 'b', 'c'], 1), recipe('Two missing', ['egg', 'a', 'b'], 1),
    recipe('One missing', ['egg', 'a'], 1), recipe('Slow', ['egg'], 45),
    recipe('Zulu', ['egg'], 20), recipe('Alpha', ['egg'], 20),
    recipe('Unknown Z', ['egg'], null), { ...recipe('Unknown A', ['egg']), totalTimeMinutes: undefined },
    recipe('No cooking', ['egg'], 0)
  ]
  const result = matchTonight(recipes, ['eggs'])
  expect(result.map(row => row.title)).toEqual(['No cooking', 'Alpha', 'Zulu', 'Slow', 'Unknown A', 'Unknown Z', 'One missing', 'Two missing', 'Other'])
  expect(result.find(row => row.id === 'Unknown A')!.totalTimeMinutes).toBeNull()
})

it('normalizes Greek accents, case, punctuation and English singular aliases', () => {
  const names = ['Φέτα', 'ΑΥΓΌ', 'tomatoes', 'onion', 'potatoes', 'Ελαιόλαδο', 'Αλάτι']
  expect(matchTonight([recipe('Greek dinner', names)], [' φετα! ', 'αυγό'.normalize('NFD'), 'TOMATO', 'onions', 'potato'])[0]).toMatchObject({
    tier: 'ready', matchedIngredients: names.slice(0, 5), assumedStaples: names.slice(5), completeness: 100
  })
})

it('returns no results for empty or blank selections', () => {
  const dishes = [recipe('Eggs', ['egg']), recipe('Blank', [''])]
  expect(matchTonight(dishes, [])).toEqual([])
  expect(matchTonight(dishes, [' ', '!!!'])).toEqual([])
})

it('excludes unrelated, staple-only assumed, empty and substring-matching recipes', () => {
  expect(matchTonight([
    recipe('Chicken', ['chicken']), recipe('Only assumed', ['salt', 'water']),
    recipe('Empty', []), recipe('Eggplant', ['eggplant']), recipe('Salted fish', ['salted fish'])
  ], ['egg'])).toEqual([])
  expect(matchTonight([recipe('Peppers', ['bell pepper', 'egg'])], ['egg'])[0]!.missingIngredients).toEqual(['bell pepper'])
})

it('does not mutate inputs or count duplicate selections more than once', () => {
  const dishes = [recipe('Eggs', ['eggs', 'salt'])]
  dishes[0]!.ingredients[0] = { name: 'eggs', amount: 12, unit: 'item' }
  const selected = ['eggs', 'egg', 'EGGS']
  const before = structuredClone(dishes)
  expect(matchTonight(dishes, selected)[0]).toMatchObject({ matchedIngredients: ['eggs'], completeness: 100 })
  expect(dishes).toEqual(before)
  expect(selected).toEqual(['eggs', 'egg', 'EGGS'])
})

it('provides eight distinct ready-to-use ingredient chips', () => {
  expect(TONIGHT_CHIPS.map(chip => chip.id)).toEqual(['eggs', 'tomatoes', 'feta', 'pasta', 'garlic', 'onions', 'chicken', 'potatoes'])
  for (const chip of TONIGHT_CHIPS) {
    expect(chip.label).toBeTruthy()
    expect(chip.emoji).toBeTruthy()
    expect(matchTonight([recipe(chip.id, [chip.query])], [chip.query])[0]!.tier).toBe('ready')
  }
})
