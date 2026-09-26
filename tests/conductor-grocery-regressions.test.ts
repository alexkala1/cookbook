import { describe, expect, it } from 'vitest'
import { classifyStep, conduct } from '../shared/culinary/conductor'
import { buildGroceryList } from '../shared/culinary/grocery'

const recipe = (id: string, steps: [string, number][]) => ({ id, title: id, steps: steps.map(([instruction, durationMinutes], index) => ({ stepNumber: index + 1, instruction, durationMinutes })) })

describe('conductor resource regressions', () => {
  it('counts only simultaneous burner steps across adjacent windows', () => {
    const plan = conduct({ targetTime: '19:00', burners: 1, courses: ['a', 'b'].map(id => ({ course: 'main', recipe: recipe(id, [['Simmer sauce', 10], ['Simmer more sauce', 10]]) })) })
    expect(plan.bottlenecks).toHaveLength(1)
    expect(plan.bottlenecks.every(conflict => conflict.message.includes('2 burners needed'))).toBe(true)
  })
  it('carries preheat settings into overlapping bake steps', () => {
    const plan = conduct({ targetTime: '19:00', courses: [
      { course: 'main', recipe: recipe('hot', [['Preheat oven to 220 C', 10], ['Bake for 30 minutes', 30]]) },
      { course: 'main', recipe: recipe('cool', [['Preheat oven to 160 C', 10], ['Bake for 10 minutes', 10]]) }
    ] })
    expect(plan.bottlenecks.some(conflict => conflict.type === 'oven_temperature' && conflict.start <= -10 && conflict.end === 0)).toBe(true)
  })
  it('replaces the inherited oven setting when explicitly changed', () => {
    const plan = conduct({ targetTime: '19:00', courses: [{ course: 'main', recipe: recipe('cake', [['Preheat oven to 220 C', 10], ['Bake', 10], ['Bake at 160 C', 10], ['Bake until set', 10]]) }] })
    expect(plan.timeline.map(step => step.ovenTempC)).toEqual([220, 220, 160, 160])
  })
  it.each(['Place cake pan in oven and bake for 40 minutes', 'Remove from heat and rest in the pan', 'Rest the meat in a skillet', 'Grease the cake pan', 'Chop potatoes', 'Put chopped onions in a pot'])('does not allocate a burner for %s', instruction => {
    expect(classifyStep({ stepNumber: 1, instruction }).burners).toBe(0)
  })
  it.each(['Heat a pan', 'Melt butter', 'Stir on the stove', 'Stir on the hob', 'Ζεστάνετε την κατσαρόλα'])('retains active stovetop evidence for %s', instruction => {
    expect(classifyStep({ stepNumber: 1, instruction }).burners).toBe(1)
  })
  it('retains mixed stovetop and oven demand', () => {
    expect(classifyStep({ stepNumber: 1, instruction: 'Sear the lamb in a skillet, then roast in the oven' })).toMatchObject({ oven: true, burners: 1 })
    expect(classifyStep({ stepNumber: 1, instruction: 'Simmer for ten minutes, remove from heat and rest' }).burners).toBe(1)
  })
  it('keeps different demands in separate conflict windows', () => {
    const plan = conduct({ targetTime: '19:00', burners: 1, courses: [
      { course: 'main', recipe: recipe('a', [['Fry in two pans', 10], ['Simmer in one pan', 10]]) },
      { course: 'main', recipe: recipe('b', [['Simmer sauce', 20]]) }
    ] })
    expect(plan.bottlenecks.map(conflict => conflict.message)).toEqual([
      'Burner overload: 3 burners needed at once, 1 available.',
      'Burner overload: 2 burners needed at once, 1 available.'
    ])
  })
})

describe('grocery ingredient identity regressions', () => {
  it.each([['rice flour', 'wheat flour'], ['oat milk', 'milk'], ['fresh yeast', 'dried yeast'], ['αλεύρι ρυζιού', 'αλεύρι σίτου'],
    ['almond butter', 'butter'], ['coconut cream', 'cream'], ['plant yogurt', 'yogurt'], ['brown sugar', 'sugar'], ['basmati rice', 'rice']
  ])('keeps %s separate from %s', (first, second) => {
    const plan = buildGroceryList([{ course: 'main', recipe: { id: 'r', title: 'Recipe', servings: 1, ingredients: [first, second].map(name => ({ name, amount: 100, unit: 'g' })) } }])
    const items = plan.sections.flatMap(section => section.items)
    expect(items).toHaveLength(2)
    expect(items.map(item => item.amount)).toEqual([100, 100])
  })
  it.each([['butter', 'βούτυρο'], ['cream', 'κρέμα γάλακτος'], ['yogurt', 'γιαούρτι'], ['sugar', 'ζάχαρη'], ['rice', 'ρύζι']])('retains equivalent aliases %s and %s', (first, second) => {
    const items = buildGroceryList([{ course: 'main', recipe: { id: 'r', title: 'Recipe', servings: 1, ingredients: [first, second].map(name => ({ name, amount: 100, unit: 'g' })) } }]).sections.flatMap(section => section.items)
    expect(items).toHaveLength(1)
    expect(items[0]!.amount).toBe(200)
  })
  it.each(['fresh yeast', 'νωπή μαγιά', 'φρέσκια μαγιά'])('does not advise dry sachets for %s', name => {
    const items = buildGroceryList([{ course: 'main', recipe: { id: 'r', title: 'Recipe', servings: 1, ingredients: [{ name, amount: 25, unit: 'g' }] } }]).sections.flatMap(section => section.items)
    expect(items[0]!.packageSizeToBuy).toBeUndefined()
  })
})
