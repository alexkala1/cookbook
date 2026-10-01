import { expect, it } from 'vitest'
import { estimateShelfLifeDays, inferStorage, isLowStock, matchPantry, parseReceipt, storageLocations, type PantryItem, type StorageLocation } from '../shared/culinary/pantry'

const DAY = 86400000
const item = (quantity: number, unit: string, overrides: Partial<PantryItem> = {}): PantryItem => ({ id: 'stock', name: 'Flour', normalizedName: 'flour', quantity, unit, storageLocation: 'pantry', expiresAt: null, createdAt: 0, updatedAt: 0, ...overrides })

it('exposes four storage locations', () => {
  expect(storageLocations).toEqual(['pantry', 'fridge', 'freezer', 'spices'])
})

it.each<[string, StorageLocation, number]>([
  ['Milk', 'fridge', 7], ['Feta', 'fridge', 7], ['Soft cheese', 'fridge', 7], ['Yoghurt', 'fridge', 7], ['Γάλα', 'fridge', 7], ['Φέτα', 'fridge', 7],
  ['Parmesan', 'fridge', 25], ['Hard cheese', 'fridge', 25], ['Γραβιέρα', 'fridge', 25],
  ['Raw chicken', 'fridge', 2], ['Fish', 'fridge', 2], ['Salmon', 'fridge', 2], ['Raw beef', 'fridge', 3], ['Pork', 'fridge', 3], ['Κοτόπουλο', 'fridge', 2],
  ['Spinach', 'fridge', 5], ['Leafy greens', 'fridge', 5], ['Lettuce', 'fridge', 5], ['Σπανάκι', 'fridge', 5],
  ['Carrots', 'fridge', 21], ['Lemons', 'fridge', 21], ['Λεμόνια', 'fridge', 21], ['Root vegetables', 'fridge', 14], ['Potatoes', 'fridge', 14], ['Eggs', 'fridge', 28], ['Αυγά', 'fridge', 28],
  ['Beef', 'freezer', 180], ['Frozen fish', 'freezer', 180], ['Bread', 'freezer', 90], ['Frozen vegetables', 'freezer', 240],
  ['Bread', 'pantry', 5], ['Ψωμί', 'pantry', 5], ['Onions', 'pantry', 30], ['Potatoes', 'pantry', 30], ['Garlic', 'pantry', 60],
  ['Canned chickpeas', 'pantry', 365], ['Pasta', 'pantry', 365], ['Rice', 'pantry', 365], ['Olive oil', 'pantry', 365],
  ['Ground cumin', 'spices', 365], ['Dried oregano', 'spices', 365], ['Whole cumin', 'spices', 730], ['Peppercorns', 'spices', 730], ['Cinnamon sticks', 'spices', 730],
  ['Unknown food', 'fridge', 7], ['Unknown food', 'pantry', 365]
])('estimates %s in %s for %i days', (name, location, days) => {
  expect(estimateShelfLifeDays(name, location)).toBe(days)
})

it.each(['oregano', 'Dried thyme', 'cumin', 'cinnamon', 'paprika', 'black pepper', 'salt', 'ΡΙΓΑΝΗ', 'θυμάρι', 'κύμινο', 'κμινο', 'κανέλα', 'πιπέρι', 'αλάτι', 'dried herbs', 'red pepper flakes', 'Dried parsley', 'Αποξηραμένος δυόσμος'])('routes %s to spices', name => {
  expect(inferStorage(name)).toBe('spices')
})
it.each([['fresh thyme', 'fridge'], ['φρέσκια ρίγανη', 'fridge'], ['φρέσκος βασιλικός', 'fridge'], ['Parsley', 'fridge'], ['bell pepper', 'pantry'], ['red pepper', 'pantry'], ['Garlic cloves', 'pantry'], ['frozen oregano', 'freezer']])('keeps %s distinct from dried spices', (name, location) => {
  expect(inferStorage(name)).toBe(location)
})
it('uses the same pure estimate for receipt dates and one timestamp for a batch', () => {
  const now = 1800000000000
  const rows = parseReceipt('Milk 1.50\nGround cumin 50 g 2.00\nBread 2.00\nFrozen fish 5.00', now)
  expect(rows.map(row => row.expiresAt)).toEqual([now + 7 * DAY, now + 365 * DAY, now + 5 * DAY, now + 180 * DAY])
  expect(rows[1]).toMatchObject({ storageLocation: 'spices', quantity: 50, unit: 'g' })
})

it.each<[number, string, boolean]>([
  [0, 'g', true], [1, 'item', true], [2, 'items', false], [1, 'piece', true], [2, 'pieces', false],
  [100, 'g', true], [100.01, 'g', false], [100, 'ml', true], [101, 'ml', false],
  [0.1, 'kg', true], [0.101, 'kg', false], [0.1, 'l', true], [0.101, 'l', false],
  [100, ' G ', true], [101, ' ML ', false], [3, 'oz', true], [4, 'oz', false],
  [6, 'tbsp', true], [7, 'tbsp', false], [0.4, 'cup', true], [0.5, 'cup', false],
  [1, 'bag', true], [2, 'bag', false]
])('detects low stock for %s %s as %s', (quantity, unit, expected) => {
  expect(isLowStock(item(quantity, unit))).toBe(expected)
})

it('flags available low stock in matches without changing completeness or mutating inventory', () => {
  const stock = [item(100, 'g')]
  const [match] = matchPantry([{ id: 'r', title: 'Bread', ingredients: [{ name: 'Flour', amount: 50, unit: 'g' }] }], stock)
  expect(match).toMatchObject({ completeness: 100, in_stock: [{ name: 'Flour', lowStock: true }], missing: [] })
  expect(stock[0]!.quantity).toBe(100)
})
it('aggregates compatible lots before flagging low stock and excludes expired or empty lots', () => {
  const recipe = [{ id: 'r', title: 'Bread', ingredients: [{ name: 'Flour', amount: 10, unit: 'g' }] }]
  expect(matchPantry(recipe, [item(100, 'g'), item(0.1, 'kg', { id: 'other', storageLocation: 'freezer' })])[0]!.in_stock[0]!.lowStock).toBe(false)
  expect(matchPantry(recipe, [item(100, 'g'), item(1000, 'g', { id: 'expired', expiresAt: 1 }), item(0, 'g', { id: 'empty' })], 2)[0]!.in_stock[0]!.lowStock).toBe(true)
  expect(matchPantry(recipe, [item(0, 'g')])[0]!.completeness).toBe(0)
})
it('flags low-stock seasoning used to taste even when recipe units are absent', () => {
  const [match] = matchPantry([{ id: 'r', title: 'Soup', ingredients: [{ name: 'Salt', amount: 0, unit: '' }] }], [item(50, 'g', { name: 'Salt', storageLocation: 'spices' })])
  expect(match).toMatchObject({ completeness: 100, in_stock: [{ name: 'Salt', lowStock: true }] })
})
