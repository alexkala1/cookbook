import { describe, expect, it } from 'vitest'
import { shoppingListText, routeShoppingList, type MarketShoppingList } from '../app/utils/shopping-list'

const list: MarketShoppingList = {
  listId: 'list', title: 'Sunday dinner',
  prepAlerts: [{ course: 'main', recipeId: 'recipe', recipeTitle: 'Fasolada', text: 'Soak beans overnight for 12 hours.' }],
  destinations: [
    { section: 'chasapis', name: 'Butcher', localizedName: 'Χασάπης', items: [
      { id: 'lamb', key: 'lamb', section: 'chasapis', name: 'Lamb shoulder', amount: 1.8, unit: 'kg', usedIn: [], prepNotes: ['Keep bone in'], counterPhrase: '1,8 κιλά αρνί, σπάλα' }
    ] },
    { section: 'supermarket', name: 'Supermarket', localizedName: 'Σούπερ μάρκετ', items: [
      { id: 'feta', key: 'feta', section: 'supermarket', name: 'Feta', amount: 300, unit: 'g', usedIn: [], prepNotes: [], packageSizeToBuy: '1 × 400 g pack', surplusLeftoverTip: 'About 100 g left over.', note: 'Also listed in another measure; not combined without a density.' }
    ] }
  ]
}

describe('market shopping clipboard summary', () => {
  it('moves items into new destinations without duplicating, mutating or losing guidance', () => {
    const before = structuredClone(list)
    const routed = routeShoppingList(list, { feta: 'laiki', lamb: 'supermarket' })
    expect(routed.destinations.map(store => store.section)).toEqual(['laiki', 'supermarket'])
    expect(routed.destinations[0]?.items[0]?.id).toBe('feta')
    expect(routed.destinations[1]?.items[0]?.counterPhrase).toBe('1,8 κιλά αρνί, σπάλα')
    const text = shoppingListText(routed, ['feta'])
    expect(text).toContain('Laiki market · Λαϊκή Αγορά\n[x] 300 g Feta')
    expect(text).not.toContain('Butcher ·')
    expect(list).toEqual(before)
  })
  it('consolidates supermarket aisles and restores custom routing when mode changes', () => {
    const overrides = { feta: 'laiki' as const }
    const single = routeShoppingList(list, overrides, 'supermarket')
    expect(single.destinations).toHaveLength(1)
    expect(single.destinations[0]?.section).toBe('supermarket')
    expect(single.destinations[0]?.items.map(item => item.aisle)).toEqual(['Meat counter', 'Dairy, pantry & other'])
    expect(shoppingListText(single, ['lamb'])).toContain('Meat counter\n[x] 1.8 kg Lamb shoulder')
    expect(shoppingListText(single)).not.toContain('Butcher ·')
    expect(routeShoppingList(list, overrides).destinations[0]?.items[0]?.id).toBe('feta')
    expect(overrides).toEqual({ feta: 'laiki' })
  })
  it('preserves destination order, Greek phrases, quantities, prep and package guidance', () => {
    expect(shoppingListText(list)).toBe([
      'Sunday dinner', '', 'Prepare ahead', '- Fasolada: Soak beans overnight for 12 hours.', '',
      'Butcher · Χασάπης', '[ ] 1.8 kg Lamb shoulder', '  At the counter: 1,8 κιλά αρνί, σπάλα', '  Prep: Keep bone in', '',
      'Supermarket · Σούπερ μάρκετ', '[ ] 300 g Feta', '  Buy: 1 × 400 g pack', '  Surplus: About 100 g left over.',
      '  Note: Also listed in another measure; not combined without a density.'
    ].join('\n'))
  })
  it('marks only selected IDs without removing bought items or mutating the list', () => {
    const before = structuredClone(list)
    const text = shoppingListText(list, ['feta', 'unknown'])
    expect(text).toContain('[ ] 1.8 kg Lamb shoulder')
    expect(text).toContain('[x] 300 g Feta')
    expect(text).toContain('Surplus: About 100 g left over.')
    expect(list).toEqual(before)
    expect(shoppingListText(list)).not.toContain('[x]')
  })
  it('handles a recipe with no shopping items or prep alerts without placeholder garbage', () => {
    expect(shoppingListText({ listId: 'empty', title: 'Empty menu', destinations: [], prepAlerts: [] })).toBe('Empty menu')
  })
})
