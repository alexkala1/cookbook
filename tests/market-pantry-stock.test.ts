import { expect, it } from 'vitest'
import type { PantryItem } from '../shared/culinary/pantry'
import type { MarketShoppingList } from '../app/utils/shopping-list'
import { applyPantryStock } from '../app/utils/pantry-stock'

const NOW = Date.UTC(2026, 8, 30)
const item = (id: string, name: string, amount: number, unit: string, extra: object = {}) => ({
  id, key: name.toLowerCase(), name, section: 'supermarket' as const, amount, unit, usedIn: [], prepNotes: [], ...extra
})
const list = (...items: ReturnType<typeof item>[]): MarketShoppingList => ({
  listId: 'l1', title: 'Sunday', prepAlerts: [],
  destinations: [{ section: 'supermarket', name: 'Supermarket', localizedName: 'Σούπερ μάρκετ', items }]
})
const stock = (name: string, quantity: number, unit: string, extra: Partial<PantryItem> = {}): PantryItem => ({
  id: name + quantity + unit, name, normalizedName: name.toLowerCase(), quantity, unit, storageLocation: 'pantry', expiresAt: null, createdAt: 0, updatedAt: 0, ...extra
})
const names = (result: ReturnType<typeof applyPantryStock>) => result.list.destinations.flatMap(d => d.items.map(i => i.name))

it('moves a fully covered item to the covered group with what the cook has', () => {
  const result = applyPantryStock(list(item('a', 'Feta', 150, 'g')), [stock('feta', 200, 'g')], NOW)
  expect(names(result)).toEqual([])
  expect(result.list.destinations).toEqual([])
  expect(result.covered).toEqual([{ id: 'a', name: 'Feta', amount: 150, unit: 'g', have: '200 g' }])
})

it('reduces a partially covered item and drops amount-specific text', () => {
  const source = list(item('a', 'Feta', 300, 'g', { counterPhrase: 'Τριακόσια γραμμάρια', packageSizeToBuy: '400 g', surplusLeftoverTip: 'Freeze the rest.', note: 'Barrel-aged', prepNotes: ['Crumble'] }))
  const result = applyPantryStock(source, [stock('feta', 200, 'g')], NOW)
  const row = result.list.destinations[0]!.items[0]!
  expect(row).toMatchObject({ id: 'a', amount: 100, unit: 'g', pantryNote: 'Have 200 g', note: 'Barrel-aged', prepNotes: ['Crumble'] })
  expect(row.counterPhrase).toBeUndefined()
  expect(row.packageSizeToBuy).toBeUndefined()
  expect(row.surplusLeftoverTip).toBeUndefined()
  expect(result.covered).toEqual([])
})

it('never deducts across incompatible units', () => {
  const source = list(item('e', 'Eggs', 120, 'g'))
  const result = applyPantryStock(source, [stock('eggs', 2, 'item')], NOW)
  expect(result.list).toEqual(source)
  expect(result.covered).toEqual([])
})

it('converts compatible units', () => {
  const result = applyPantryStock(list(item('a', 'Flour', 300, 'g')), [stock('flour', 0.5, 'kg')], NOW)
  expect(result.list.destinations).toEqual([])
  expect(result.covered[0]).toMatchObject({ id: 'a', have: '500 g' })
})

it('shares one stock between items with the same ingredient', () => {
  const result = applyPantryStock(list(item('a', 'Flour', 300, 'g'), item('b', 'Flour', 300, 'g')), [stock('flour', 400, 'g')], NOW)
  expect(result.covered.map(row => row.id)).toEqual(['a'])
  expect(result.list.destinations[0]!.items[0]).toMatchObject({ id: 'b', amount: 200, pantryNote: 'Have 100 g' })
})

it('sums several pantry rows for the same ingredient', () => {
  const result = applyPantryStock(list(item('a', 'Milk', 1000, 'ml')), [stock('milk', 400, 'ml', { storageLocation: 'fridge' }), stock('Milk', 0.6, 'l', { storageLocation: 'freezer' })], NOW)
  expect(result.covered).toHaveLength(1)
})

it('ignores expired and empty stock', () => {
  const source = list(item('a', 'Feta', 100, 'g'))
  const result = applyPantryStock(source, [stock('feta', 500, 'g', { expiresAt: NOW - 1 }), stock('feta', 0, 'g')], NOW)
  expect(result.list).toEqual(source)
  expect(result.covered).toEqual([])
})

it('covers "as needed" items only when in-date stock exists', () => {
  const source = list(item('s', 'Salt', 0, 'as needed'))
  expect(applyPantryStock(source, [stock('salt', 1, 'item')], NOW).covered).toEqual([{ id: 's', name: 'Salt', amount: 0, unit: 'as needed', have: 'in stock' }])
  expect(applyPantryStock(source, [stock('salt', 1, 'item', { expiresAt: NOW - 1 })], NOW).covered).toEqual([])
  expect(applyPantryStock(source, [], NOW).list).toEqual(source)
})

it('returns an equal list for an empty pantry and drops emptied destinations only', () => {
  const source = list(item('a', 'Feta', 100, 'g'))
  expect(applyPantryStock(source, [], NOW)).toEqual({ list: source, covered: [] })
  const two: MarketShoppingList = { ...source, destinations: [...source.destinations, { section: 'laiki', name: 'Laiki market', localizedName: 'Λαϊκή', items: [{ ...item('t', 'Tomato', 2, 'item'), section: 'laiki' }] }] }
  const result = applyPantryStock(two, [stock('feta', 100, 'g')], NOW)
  expect(result.list.destinations.map(d => d.section)).toEqual(['laiki'])
})

it('matches Greek names regardless of case and accents and does not mutate inputs', () => {
  const source = list(item('a', 'Φέτα', 100, 'g'))
  const pantry = [stock('ΦΕΤΑ', 150, 'g')]
  const before = structuredClone({ source, pantry })
  const result = applyPantryStock(source, pantry, NOW)
  expect(result.covered).toHaveLength(1)
  expect({ source, pantry }).toEqual(before)
})

it('keeps list metadata and item order', () => {
  const source = { ...list(item('a', 'Feta', 300, 'g'), item('b', 'Olive oil', 1, 'l'), item('c', 'Salt', 1, 'kg')), prepAlerts: [{ course: 'main' as const, recipeId: 'r', recipeTitle: 'R', text: 'Marinate.' }] }
  const result = applyPantryStock(source, [stock('feta', 100, 'g')], NOW)
  expect(result.list).toMatchObject({ listId: 'l1', title: 'Sunday', prepAlerts: source.prepAlerts })
  expect(names(result)).toEqual(['Feta', 'Olive oil', 'Salt'])
})
