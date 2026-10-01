import { describe, expect, it } from 'vitest'
import { buildGroceryList, marketSections, sectionInfo, type GroceryRecipe } from '../shared/culinary/grocery'
import { menuShoppingDrinks, recommendPairingForMenu } from '../shared/culinary/beverage-pairings'
import { routeShoppingList, type MarketShoppingList } from '../app/utils/shopping-list'

const sectionOf = (name: string) => {
  const recipe: GroceryRecipe = { id: 'r', title: 'T', servings: 1, ingredients: [{ name, amount: 1, unit: 'piece' }] }
  return buildGroceryList([{ course: 'main', recipe }]).sections[0]!.section
}

describe('kava section', () => {
  it('is registered and maps to the persisted kava_cellar destination', () => {
    expect(marketSections).toContain('kava')
    expect(sectionInfo.kava).toEqual({ name: 'Cellar & Beverages', localizedName: 'Κάβα', storeType: 'kava_cellar', category: 'beverage' })
  })
  it.each([
    'Assyrtiko', 'Moschofilero', 'Malagousia', 'Xinomavro', 'Agiorgitiko', 'Vinsanto', 'Retsina', 'Savatiano', 'Vidiano', 'dry white wine', 'Κόκκινο κρασί', 'Ξινόμαυρο',
    'Tsipouro', 'Tsikoudia', 'Ouzo', 'Raki', 'Metaxa', 'Mastiha', 'Masticha', 'τσίπουρο', 'ούζο', 'ρακή', 'μαστίχα',
    'Greek craft beer', 'lager', 'pilsner', 'pale ale', 'ale', 'μπύρα', 'μπίρα', 'Fix', 'Mythos', 'Nissos', 'Septem',
    'Greek mountain tea', 'τσάι του βουνού', 'Soumada', 'σουμάδα'
  ])('routes %s to the Κάβα', name => expect(sectionOf(name)).toBe('kava'))
  it.each(['red wine vinegar', 'Aleppo pepper', 'fixed price menu', 'tea bags', 'vine leaves', 'lamb shoulder', 'feta'])('does not route %s to the Κάβα', name => {
    expect(sectionOf(name)).not.toBe('kava')
  })
  it('lists a recipe’s wine in the Κάβα next to its other ingredients', () => {
    const recipe: GroceryRecipe = { id: 'r', title: 'Stifado', servings: 4, ingredients: [{ name: 'beef', amount: 1, unit: 'kg' }, { name: 'red wine', amount: 250, unit: 'ml' }, { name: 'onions', amount: 500, unit: 'g' }] }
    const list = buildGroceryList([{ course: 'main', recipe }])
    expect(list.sections.map(s => s.section)).toEqual(['laiki', 'chasapis', 'kava'])
  })
})

describe('menu drinks for the shopping list', () => {
  const menu = recommendPairingForMenu([{ title: 'Grilled Octopus', course: 'appetizer' }, { title: 'Lamb Stifado', course: 'main' }, { title: 'Beef Stifado', course: 'side' }, { title: 'Baklava', course: 'dessert' }])
  it('names each distinct alcoholic pairing once, in menu order', () => {
    expect(menuShoppingDrinks(menu)).toEqual(['Ouzo', 'Xinomavro', 'Vinsanto / Muscat of Samos'])
  })
  it('puts every exported drink in the Κάβα', () => {
    const drinks = menuShoppingDrinks(menu)
    const recipe: GroceryRecipe = { id: 'dinner-drinks', title: 'Dinner drinks', servings: 1, ingredients: drinks.map(name => ({ name, amount: 1, unit: 'piece' })) }
    const sections = buildGroceryList([{ course: 'beverage', recipe }]).sections
    expect(sections.map(s => s.section)).toEqual(['kava'])
    expect(sections[0]!.items.map(i => i.name).sort()).toEqual([...drinks].sort())
  })
  it('returns nothing for an empty menu', () => expect(menuShoppingDrinks([])).toEqual([]))
})

describe('routing modes', () => {
  const list: MarketShoppingList = { listId: 'l', title: 'T', prepAlerts: [], destinations: [{ section: 'kava', name: 'Cellar & Beverages', localizedName: 'Κάβα', items: [{ key: 'k', id: 'i1', name: 'Xinomavro', section: 'kava', amount: 1, unit: 'piece', usedIn: [], prepNotes: [] }] }] }
  it('keeps the Κάβα in market mode and labels its aisle in one-stop mode', () => {
    expect(routeShoppingList(list).destinations[0]!.section).toBe('kava')
    const one = routeShoppingList(list, {}, 'supermarket')
    expect(one.destinations[0]!.section).toBe('supermarket')
    expect(one.destinations[0]!.items[0]!.aisle).toBe('Cellar & beverages')
  })
})
