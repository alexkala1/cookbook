import { expect, it } from 'vitest'
import { inSystem, parseServings } from '../app/utils/display-units'

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
