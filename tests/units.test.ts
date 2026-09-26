import { describe, expect, it } from 'vitest'
import { convertSalt, convertUnit, isPlainSalt, scaleIngredients, saltDensities } from '../app/utils/units'
import type { SaltType } from '../app/utils/units'

describe('salt density', () => {
  it.each(['salt', 'Fine SALT', 'sea salt', 'αλάτι', 'αλατι', 'ΑΛΆΤΙ', 'ΑΛΑΤΙ', 'ψιλό αλάτι', 'αλάτι'.normalize('NFD')])('recognizes plain salt: %s', name => expect(isPlainSalt(name)).toBe(true))
  it.each(['garlic salt', 'celery salt', 'seasoned salt', 'seasoned sea salt', 'GARLIC-SALT', 'αλάτι με σκόρδο', 'αλάτι σκόρδου', 'ΑΛΑΤΙ ΜΕ ΣΕΛΙΝΟ', 'αλάτι σέλινου', 'unsalted butter', 'salted butter', 'salty', 'αλατισμένο βούτυρο', 'pepper'])('excludes mixed or non-salt ingredients: %s', name => expect(isPlainSalt(name)).toBe(false))
  it('uses the four specified densities', () => {
    expect(saltDensities).toEqual({ diamond_crystal_kosher: 2.8, morton_kosher: 4.8, table_salt: 5.9, greek_fine_sea_salt: 5.5 })
  })
  it('preserves salt mass for every substitution and reverses without rounding loss', () => {
    for (const from of Object.keys(saltDensities) as SaltType[]) for (const to of Object.keys(saltDensities) as SaltType[]) {
      const amount = convertSalt(2, from, to, 'tsp')
      expect(amount * saltDensities[to]).toBeCloseTo(2 * saltDensities[from], 10)
      expect(convertSalt(amount, to, from, 'tsp')).toBeCloseTo(2, 10)
      expect(convertSalt(3, from, to, 'g')).toBe(3)
    }
  })
  it('works in tablespoons and handles zero', () => {
    expect(convertSalt(1, 'table_salt', 'diamond_crystal_kosher', 'tbsp')).toBeCloseTo(5.9 / 2.8)
    expect(convertSalt(0, 'morton_kosher', 'greek_fine_sea_salt', 'tsp')).toBe(0)
  })
  it('rejects unknown salts and unsuitable units', () => {
    expect(() => convertSalt(1, 'unknown' as SaltType, 'table_salt', 'tsp')).toThrow()
    expect(() => convertSalt(1, 'table_salt', 'greek_fine_sea_salt', 'piece')).toThrow()
  })
})
describe('unit conversion', () => {
  it.each([
    [1000, 'g', 'kg', 1], [1, 'lb', 'g', 453.59237], [1, 'oz', 'g', 28.349523125],
    [1, 'l', 'ml', 1000], [1, 'cup', 'ml', 236.5882365], [1, 'tbsp', 'tsp', 3],
    [1, 'fl oz', 'ml', 29.5735295625], [2, 'piece', 'piece', 2]
  ])('converts %s %s to %s', (amount, from, to, result) => expect(convertUnit(amount, from, to)).toBeCloseTo(result, 10))
  it('normalizes case and whitespace', () => expect(convertUnit(1, ' KG ', 'g')).toBe(1000))
  it.each([['g', 'ml'], ['g', 'piece'], ['pinch', 'tsp'], ['__proto__', 'g']])('rejects incompatible/unknown %s to %s', (from, to) => expect(() => convertUnit(1, from, to)).toThrow())
  it.each([-1, NaN, Infinity])('rejects invalid amount %s', value => expect(() => convertUnit(value, 'g', 'kg')).toThrow())
})
describe('ingredient scaling', () => {
  it('scales amounts and known gram equivalents without mutating inputs', () => {
    const source = [{ name: 'Flour', amount: 1, gramsEquivalent: 120 }, { name: 'Salt', amount: 0.5, gramsEquivalent: null }]
    expect(scaleIngredients(source, 6, 4)).toEqual([{ name: 'Flour', amount: 1.5, gramsEquivalent: 180 }, { name: 'Salt', amount: 0.75, gramsEquivalent: null }])
    expect(source[0]?.amount).toBe(1)
    expect(scaleIngredients([], 1, 4)).toEqual([])
  })
  it.each([0, -1, NaN, Infinity])('rejects invalid serving count %s', value => {
    expect(() => scaleIngredients([], value, 4)).toThrow()
    expect(() => scaleIngredients([], 4, value)).toThrow()
  })
})
