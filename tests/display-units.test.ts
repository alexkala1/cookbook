import { expect, it } from 'vitest'
import { formatCulinaryAmount, formatIngredientNotes, ingredientInSystem, inSystem, parseServings } from '../app/utils/display-units'
import { scaleIngredients } from '../shared/culinary/units'
import { parseIngredientLine } from '../shared/culinary/ingredient-line'

it('parses only sensible ?servings= values', () => {
  expect(parseServings('6')).toBe(6)
  expect(parseServings('2.5')).toBe(2.5)
  expect(parseServings(['3', '9'])).toBe(3)
  for (const bad of [undefined, '', '0', '-2', 'abc', '1001', 'Infinity', null]) expect(parseServings(bad)).toBeNull()
})

it('converts to US or metric and leaves other units alone', () => {
  expect(inSystem(454, 'g', true)).toMatchObject({ unit: 'oz' })
  expect(inSystem(1, 'kg', true).unit).toBe('lb')
  expect(inSystem(2, 'lb', false)).toMatchObject({ unit: 'g' })
  expect(inSystem(2, 'lb', false).amount).toBeCloseTo(907.18, 1)
  expect(inSystem(3, ' Cloves ', true)).toEqual({ amount: 3, unit: 'cloves' })
  expect(inSystem(2, 'tbsp', false)).toEqual({ amount: 2, unit: 'tbsp' })
})

it('preserves cups and prefers explicit gram equivalents only in metric mode', () => {
  expect(inSystem(0.25, 'cup', false)).toEqual({ amount: 0.25, unit: 'cup' })
  expect(inSystem(2, 'cup', false, 380)).toEqual({ amount: 380, unit: 'g' })
  expect(inSystem(2, 'cup', true, 380)).toEqual({ amount: 2, unit: 'cup' })
})

it.each([[0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾'], [1.5, '1 ½'], [2.5, '2 ½']])('formats %s as %s', (amount, expected) => {
  expect(formatCulinaryAmount(amount, 'cup')).toBe(expected)
})

it('rounds metric quantities without losing small measures', () => {
  expect(formatIngredientNotes('Source volume: 80 ml for 0.3333333333333333 cup.')).toBe('Source volume: 80 ml for ⅓ cup.')
  expect(formatCulinaryAmount(473.176, 'g')).toBe('473')
  expect(formatCulinaryAmount(119.9999, 'ml')).toBe('120')
  expect(formatCulinaryAmount(0.3, 'g')).toBe('0.3')
})

it('extracts explicit gram weights, preserving original measures and other parentheticals', () => {
  expect(parseIngredientLine('2 cups (380g) uncooked jasmine rice')).toMatchObject({ amount: 2, unit: 'cup', gramsEquivalent: 380, name: 'uncooked jasmine rice' })
  expect(parseIngredientLine('3 lbs (1.5 kg) chicken thighs (bone-in)')).toMatchObject({ amount: 3, unit: 'lb', gramsEquivalent: 1500, name: 'chicken thighs (bone-in)' })
})

it('preserves source milliliters without inventing gram weights and scales both display modes', () => {
  const ingredient = parseIngredientLine('1/2 cup (120ml) soy sauce (light)')
  expect(ingredient.name).toBe('soy sauce (light)')
  expect(ingredient.gramsEquivalent).toBeUndefined()
  expect(ingredientInSystem(ingredient, false)).toEqual({ amount: 120, unit: 'ml' })
  expect(ingredientInSystem(ingredient, true)).toEqual({ amount: 0.5, unit: 'cup' })
  const doubled = scaleIngredients([ingredient], 8, 4)[0]!
  expect(ingredientInSystem(doubled, false)).toEqual({ amount: 240, unit: 'ml' })
  expect(ingredientInSystem(doubled, true)).toEqual({ amount: 1, unit: 'cup' })
  const rice = scaleIngredients([parseIngredientLine('2 cups (380g) rice')], 2, 4)[0]!
  expect(ingredientInSystem(rice, false)).toEqual({ amount: 190, unit: 'g' })
  expect(ingredientInSystem(rice, true)).toEqual({ amount: 1, unit: 'cup' })
})
