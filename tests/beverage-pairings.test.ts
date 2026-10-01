import { describe, expect, it } from 'vitest'
import { beverages, recommendPairingForMenu, recommendPairingForRecipe } from '../shared/culinary/beverage-pairings'

const pick = (title: string, extra: { ingredients?: any[], tags?: string[] } = {}) => recommendPairingForRecipe({ title, ...extra }).beverage.id

describe('recommendPairingForRecipe', () => {
  it('pairs seafood, salads and feta with Assyrtiko', () => {
    expect(pick('Grilled Sea Bass')).toBe('assyrtiko')
    expect(pick('Horiatiki Salad')).toBe('assyrtiko')
  })
  it('pairs lamb and tomato braises with Xinomavro', () => {
    expect(pick('Arni me Patates')).toBe('xinomavro')
    expect(pick('Beef Stifado')).toBe('xinomavro')
    expect(pick('Chicken Kokkinisto')).toBe('xinomavro')
  })
  it('keeps lamb on Xinomavro even with feta in the ingredients', () => {
    expect(pick('Lamb Kleftiko'.replace('Kleftiko', 'Shanks'), { ingredients: [{ name: 'feta' }] })).toBe('xinomavro')
  })
  it('pairs moussaka and souvlaki with Agiorgitiko', () => {
    expect(pick('Moussaka')).toBe('agiorgitiko')
    expect(pick('Pork Souvlaki')).toBe('agiorgitiko')
  })
  it('pairs mezedes with ouzo or tsipouro', () => {
    expect(pick('Grilled Octopus')).toBe('ouzo')
    expect(pick('Fried Kalamari')).toBe('ouzo')
    expect(pick('Loukaniko with peppers')).toBe('tsipouro')
  })
  it('pairs gyro with Greek craft beer and desserts with Vinsanto', () => {
    expect(pick('Pork Gyro')).toBe('beer')
    expect(pick('Baklava')).toBe('vinsanto')
    expect(pick('Galaktoboureko')).toBe('vinsanto')
  })
  it('pairs poultry/vegetarian with Moschofilero and pies with Malagousia', () => {
    expect(pick('Lemon Chicken')).toBe('moschofilero')
    expect(pick('Hortopita')).toBe('malagousia')
  })
  it('falls back on ingredients, then course, and always offers a non-alcoholic option', () => {
    expect(pick('Family Special', { ingredients: [{ name: 'prawns' }, 'garlic'] })).toBe('assyrtiko')
    expect(recommendPairingForRecipe({ title: 'Mystery', course: 'dessert' }).beverage.id).toBe('vinsanto')
    const p = recommendPairingForRecipe({ title: 'Baklava' })
    expect(p.nonAlcoholic.category).toBe('non-alcoholic')
    expect(p.reason).not.toBe('')
  })
  it('describes every beverage completely', () => {
    for (const drink of Object.values(beverages)) {
      expect(drink.name && drink.greekName && drink.region && drink.tastingNotes && drink.phrase).toBeTruthy()
      expect(['wine', 'spirit', 'beer', 'non-alcoholic']).toContain(drink.category)
      expect(Number.isFinite(drink.servingTempC)).toBe(true)
    }
  })
})

describe('recommendPairingForMenu', () => {
  it('pairs each course, forcing the sweet wine for dessert', () => {
    const menu = recommendPairingForMenu([{ title: 'Grilled Octopus', course: 'appetizer' }, { title: 'Lamb Stifado', course: 'main' }, { title: 'Rice pudding', course: 'dessert' }])
    expect(menu.map(m => m.pairing.beverage.id)).toEqual(['ouzo', 'xinomavro', 'vinsanto'])
  })
})
