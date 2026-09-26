import { describe, expect, it } from 'vitest'
import { assessIngredients, compensate, findProduce, peakProduce, seasonalityOf } from '../shared/culinary/seasonality'

describe('Greek seasonal calendar', () => {
  it.each([
    ['tomatoes', 8, 'peak'], ['ντομάτες', 6, 'in_season'], ['cherry tomatoes', 1, 'greenhouse'], ['μπάμιες', 1, 'off_season'], ['okra', 7, 'peak'],
    ['αγκινάρες', 4, 'peak'], ['artichokes', 9, 'off_season'], ['strawberries', 3, 'peak'], ['φράουλες', 9, 'off_season'], ['σταμναγκάθι', 2, 'peak'],
    ['βλίτα', 1, 'off_season'], ['βλίτα', 8, 'peak'], ['πορτοκάλια', 1, 'peak'], ['peaches', 12, 'off_season'], ['basil', 1, 'greenhouse'],
    ['άνηθος', 3, 'peak'], ['lemons', 7, 'in_season'], ['pomegranate', 1, 'in_season'], ['leeks', 7, 'off_season'], ['κολοκυθάκια', 7, 'peak'], ['κολοκύθα', 10, 'peak']
  ] as const)('%s in month %i is %s', (name, month, status) => expect(seasonalityOf(name, month)?.status).toBe(status))

  it('resolves the longest match so similar names do not collide', () => {
    expect(findProduce('cherry tomatoes')?.id).toBe('tomato')
    expect(findProduce('watermelon')?.id).toBe('watermelon')
    expect(findProduce('ροδάκινα')?.id).toBe('peach')
    expect(findProduce('κολοκυθάκια')?.id).toBe('zucchini')
    expect(findProduce('black pepper')).toBeUndefined()
    expect(findProduce('oregano')).toBeUndefined() // Greek cooking defaults to dried oregano.
  })

  it('never flags preserved forms, which are made from peak produce', () => {
    for (const name of ['canned tomatoes', 'tomato paste', 'ντοματοπελτές', 'πελτές', 'passata sauce', 'dried oregano', 'frozen peas', 'strawberry jam', 'λιαστές ντομάτες', 'red pepper flakes', 'orange juice', 'split peas', 'orange blossom water'])
      expect(seasonalityOf(name, 1), name).toBeNull()
  })

  it('lists peak produce for every month and validates the month', () => {
    for (let month = 1; month <= 12; month++) expect(peakProduce(month).length, `month ${month}`).toBeGreaterThanOrEqual(4)
    expect(peakProduce(2, 'greens').map(item => item.id)).toEqual(expect.arrayContaining(['radikia', 'stamnagathi', 'zochoi']))
    expect(peakProduce(8, 'greens').map(item => item.id)).toEqual(expect.arrayContaining(['vlita', 'purslane']))
    expect(() => seasonalityOf('tomato', 0)).toThrow(RangeError)
    expect(() => peakProduce(13)).toThrow(RangeError)
    expect(() => seasonalityOf('tomato', 1.5)).toThrow(RangeError)
  })
})

describe('off-season flavor compensation', () => {
  it('restores winter tomatoes with paste, sugar, and red wine vinegar', () => {
    const result = compensate('ντομάτες', 1)!
    expect(result.status).toBe('greenhouse')
    const text = result.advice.join(' ')
    expect(text).toContain('1 tsp tomato paste (πελτές)')
    expect(text).toContain('pinch of sugar')
    expect(text).toContain('½ tsp red wine vinegar')
    expect(text).toContain('brix')
    expect(text).toContain('canned whole tomatoes')
    expect(result.advice.at(-1)).toMatch(/^In season now: .*Leek/)
  })
  it('macerates out-of-season berries with balsamic', () => {
    expect(compensate('strawberries', 10)!.advice.join(' ')).toMatch(/1 tbsp sugar and 1 tsp balsamic vinegar.*30 minutes/)
  })
  it('rehydrates dried herbs in oil at one third of the fresh amount, with a basil exception', () => {
    expect(compensate('fresh dill', 7)!.advice.join(' ')).toContain('one third of the fresh amount, bloomed in warm olive oil')
    const basil = compensate('basil', 12)!.advice.join(' ')
    expect(basil).toContain('greenhouse-grown')
    expect(basil).toContain('pesto or frozen basil')
  })
  it('points out-of-season greens to the wild greens at the laiki now', () => {
    const text = compensate('βλίτα', 2)!.advice.join(' ')
    expect(text).toContain('Swap to the greens in season now')
    expect(text).toMatch(/In season now: .*Σταμναγκάθι/)
  })
  it('gives no advice for produce at peak or in season, or for unknown ingredients', () => {
    expect(compensate('tomatoes', 8)).toBeNull()
    expect(compensate('tomatoes', 6)).toBeNull()
    expect(compensate('feta', 1)).toBeNull()
  })
  it('assesses a recipe ingredient list for badges, skipping non-produce', () => {
    const result = assessIngredients([{ name: 'ντομάτες' }, { name: 'feta' }, { name: 'αγγούρι' }, { name: 'olive oil' }, { name: 'fresh oregano' }], 1)
    expect(result.map(row => [row.ingredient, row.status, row.advice.length > 0])).toEqual([
      ['ντομάτες', 'greenhouse', true], ['αγγούρι', 'greenhouse', true], ['fresh oregano', 'off_season', true]
    ])
    expect(assessIngredients([{ name: 'tomatoes' }], 8)[0]).toMatchObject({ status: 'peak', advice: [] })
  })
})
