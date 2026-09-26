import { expect, it } from 'vitest'
import { evaluateCocktail } from '../server/utils/ai/cocktails'
import { enrichScience } from '../server/utils/ai/science'
it('stirs spirit-forward drinks and shakes citrus or egg drinks', () => {
  expect(evaluateCocktail([{ name: 'gin' }, { name: 'vermouth' }])).toMatchObject({ technique: 'Stirred', dilutionPercent: [40, 45], temperatureDropC: [15, 20], glassware: 'Nick & Nora' })
  expect(evaluateCocktail([{ name: 'lime juice' }, { name: 'tequila' }])).toMatchObject({ technique: 'Shaken', dilutionPercent: [50, 60], temperatureDropC: [20, 25], glassware: 'Coupe' })
  expect(evaluateCocktail([{ name: 'egg white' }]).technique).toBe('Shaken')
  expect(evaluateCocktail([{ name: 'soda' }, { name: 'lemon wedge' }]).technique).toBe('Built')
})
it.each(['twist', 'peel', 'wheel', 'zest', 'wedge', 'garnish'])('keeps a Martini with lemon %s stirred', garnish => {
  expect(evaluateCocktail([{ name: 'gin' }, { name: 'vermouth' }, { name: 'lemon ' + garnish }], 'Martini')).toMatchObject({ technique: 'Stirred', glassware: 'Nick & Nora' })
})
it('shakes a French 75 base before topping with sparkling in a flute', () => {
  const result = evaluateCocktail([{ name: 'gin' }, { name: 'lemon juice' }, { name: 'champagne' }, { name: 'lemon twist' }], 'French 75')
  expect(result).toMatchObject({ technique: 'Shaken, topped with sparkling', dilutionPercent: [50, 60], temperatureDropC: [20, 25], glassware: 'Flute' })
  expect(result.note).toContain('Never shake carbonation')
})
it.each([undefined, null, 60, 74, 85])('enforces poultry temperature without lowering a higher target (%s)', target => {
  const recipe = enrichScience({ title: 'Chicken', description: '', steps: [{ stepNumber: 1, instruction: 'Roast chicken', internalTempTargetC: target, sensoryVisual: 'Golden' }] })
  expect(recipe.steps?.[0]?.internalTempTargetC).toBe(Math.max(target ?? 0, 74))
  expect(recipe.steps?.[0]?.sensoryVisual).toBe('Golden')
})
it('covers grilled poultry but leaves non-cooking and non-poultry targets unchanged', () => {
  expect(enrichScience({ title: 'Turkey', description: '', steps: [{ stepNumber: 1, instruction: 'Grill turkey', internalTempTargetC: 50 }] }).steps?.[0]?.internalTempTargetC).toBe(74)
  expect(enrichScience({ title: 'Chicken', description: '', steps: [{ stepNumber: 1, instruction: 'Marinate overnight', internalTempTargetC: 4 }] }).steps?.[0]?.internalTempTargetC).toBe(4)
  expect(enrichScience({ title: 'Chicken', description: '', steps: [{ stepNumber: 1, instruction: 'Keep uncooked chicken refrigerated', internalTempTargetC: 4 }] }).steps?.[0]?.internalTempTargetC).toBe(4)
  expect(enrichScience({ title: 'Bread', description: '', steps: [{ stepNumber: 1, instruction: 'Bake bread', internalTempTargetC: 95 }] }).steps?.[0]?.internalTempTargetC).toBe(95)
})
it('enriches relevant science without overwriting authored cues', () => {
  const recipe = enrichScience({ title: 'Stew', description: '', steps: [{ stepNumber: 1, instruction: 'Brown the meat', sensoryVisual: 'Chestnut crust' }, { stepNumber: 2, instruction: 'Simmer gently' }] })
  expect(recipe.steps?.[0]?.scienceWhy).toContain('Maillard')
  expect(recipe.steps?.[0]?.sensoryVisual).toBe('Chestnut crust')
  expect(recipe.steps?.[1]?.sensoryAudio).toContain('bubbling')
})
