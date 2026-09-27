import { describe, expect, it } from 'vitest'
import { applyMetric, suggestMetric } from '../shared/culinary/densities'

describe('reviewed metric conversions', () => {
  it.each([
    ['all-purpose flour', 'cups', 1, 120, 'g', 120], ['bread flour', 'cup', 1, 120, 'g', 120],
    ['pastry flour', 'tbsp', 2, 15, 'g', 15], ['granulated sugar', 'cup', 1, 200, 'g', 200],
    ['brown sugar', 'cup', 1, 220, 'g', 220], ['powdered sugar', 'cup', 1, 120, 'g', 120],
    ['butter', 'stick', 1, 113, 'g', 113], ['unsalted butter', 'tbsp', 8, 113, 'g', 113],
    ['butter', 'cup', 1, 227, 'g', 227], ['olive oil', 'cup', 1, 240, 'ml', 215],
    ['vegetable oil', 'tbsp', 1, 15, 'ml', 13.44], ['honey', 'cup', 1, 340, 'g', 340],
    ['rolled oats', 'cup', 1, 90, 'g', 90], ['rice', 'cup', 1, 185, 'g', 185],
    ['table salt', 'tsp', 1, 5.9, 'g', 5.9], ['Morton kosher salt', 'tsp', 1, 4.8, 'g', 4.8],
    ['Diamond Crystal kosher salt', 'tsp', 1, 2.8, 'g', 2.8], ['Greek fine sea salt', 'tsp', 1, 5.5, 'g', 5.5],
    ['chicken', 'lb', 1, 453.59, 'g', 453.59], ['chocolate', 'oz', 1, 28.35, 'g', 28.35]
  ])('%s: %s → metric', (name, unit, amount, targetAmount, targetUnit, grams) => {
    expect(suggestMetric({ name, unit, amount })).toMatchObject({ amount: targetAmount, unit: targetUnit, gramsEquivalent: grams })
  })
  it.each(['almond flour', 'cooked rice', 'rice flour', 'peanut butter', 'coconut milk', 'garlic salt', 'salt and pepper', 'salt'])('does not invent a density for %s', name => {
    expect(suggestMetric({ name, amount: 1, unit: 'cup' })).toBeNull()
  })
  it('uses recorded grams rather than replacing an existing measurement with an estimate', () => {
    expect(suggestMetric({ name: 'flour', amount: 1, unit: 'cup', gramsEquivalent: 135 })).toMatchObject({ amount: 135, unit: 'g', gramsEquivalent: 135 })
    expect(suggestMetric({ name: 'salt', amount: 1, unit: 'tsp' }, 'morton_kosher')).toMatchObject({ amount: 4.8 })
  })
  it('preserves notes, source measure and other fields without changing its input; application is idempotent', () => {
    const source = { name: 'flour', amount: 2, unit: 'cups', notes: 'Sift first.\nFamily measure.', category: 'pantry' }
    const converted = applyMetric(source)
    expect(converted).toMatchObject({ amount: 240, unit: 'g', gramsEquivalent: 240, category: 'pantry', notes: 'Sift first.\nFamily measure.\nOriginal measure: 2 cups' })
    expect(applyMetric(converted)).toEqual(converted)
    expect(source.unit).toBe('cups')
    expect(suggestMetric(converted)).toBeNull()
  })
  it('keeps unknown and already-metric ingredients unchanged', () => {
    for (const item of [{ name: 'flour', amount: 120, unit: 'g' }, { name: 'mystery spice', amount: 1, unit: 'tbsp' }]) expect(applyMetric(item)).toEqual(item)
  })
  it('rejects invalid, oversized and effectively zero conversions and preserves notes at the storage limit', () => {
    for (const amount of [-1, 0, NaN, Infinity, 1000000, 0.0000001]) expect(suggestMetric({ name: 'flour', amount, unit: 'cup' })).toBeNull()
    expect(suggestMetric({ name: 'flour', amount: 1, unit: 'cup', notes: 'x'.repeat(10000) })).toBeNull()
    expect(suggestMetric({ name: 'sugar', amount: 1, unit: 'stick' })).toBeNull()
  })
})
