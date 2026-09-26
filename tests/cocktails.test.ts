import { expect, it } from 'vitest'
import { evaluateCocktail } from '../server/utils/ai/cocktails'
import { enrichScience } from '../server/utils/ai/science'
it('stirs spirit-forward drinks and shakes citrus or egg drinks', () => {
  expect(evaluateCocktail([{ name: 'gin' }, { name: 'vermouth' }])).toMatchObject({ technique: 'Stirred', dilutionPercent: [20, 25], glassware: 'Nick & Nora' })
  expect(evaluateCocktail([{ name: 'lime juice' }, { name: 'tequila' }])).toMatchObject({ technique: 'Shaken', dilutionPercent: [30, 35], glassware: 'Coupe' })
  expect(evaluateCocktail([{ name: 'egg white' }]).technique).toBe('Shaken')
  expect(evaluateCocktail([{ name: 'soda' }, { name: 'lemon' }]).technique).toBe('Built')
})
it('enriches relevant science without overwriting authored cues', () => {
  const recipe = enrichScience({ title: 'Stew', description: '', steps: [{ stepNumber: 1, instruction: 'Brown the meat', sensoryVisual: 'Chestnut crust' }, { stepNumber: 2, instruction: 'Simmer gently' }] })
  expect(recipe.steps?.[0]?.scienceWhy).toContain('Maillard')
  expect(recipe.steps?.[0]?.sensoryVisual).toBe('Chestnut crust')
  expect(recipe.steps?.[1]?.sensoryAudio).toContain('bubbling')
})
