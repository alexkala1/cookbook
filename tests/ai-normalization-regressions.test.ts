import { describe, expect, it } from 'vitest'
import { enrichScience } from '../server/utils/ai/science'
import { extractJsonLd, parseIngredient } from '../server/utils/ai/normalize'

describe('poultry safety normalization', () => {
  it.each([
    ['Κοτόπουλο λεμονάτο', 'κοτόπουλο', 'Ψήστε το κοτόπουλο στον φούρνο.'],
    ['ΓΑΛΟΠΟΥΛΑ', 'γαλοπούλα', 'ΒΡΑΣΤΕ ΤΗ ΓΑΛΟΠΟΥΛΑ.'],
    ['Roast duck', 'duck breast', 'Roast until cooked.'],
    ['Duck breast', 'duck breast, fat trimmed', 'Roast until cooked.'],
    ['Goose', 'goose', 'Bake until tender.'],
    ['Πάπια', 'πάπια', 'Σοτάρετε την πάπια.'],
    ['Κότα', 'κότα', 'Ψήστε την κότα.'],
    ['Chicken', 'chicken', 'Fry until browned.']
  ])('%s enforces the poultry minimum', (title, name, instruction) => {
    const recipe = { title, description: '', ingredients: [{ name, amount: 1, unit: 'kg' }], steps: [{ stepNumber: 1, instruction, internalTempTargetC: 60 }] }
    expect(enrichScience(recipe).steps![0]!.internalTempTargetC).toBe(74)
    recipe.steps[0]!.internalTempTargetC = 80
    expect(enrichScience(recipe).steps![0]!.internalTempTargetC).toBe(80)
  })
  it.each(['chicken stock', 'duck eggs', 'ζωμός κοτόπουλου', 'αυγά πάπιας'])('does not treat %s as poultry meat', name => {
    expect(enrichScience({ title: name, description: '', ingredients: [{ name, amount: 1, unit: 'item' }], steps: [{ stepNumber: 1, instruction: 'Simmer gently.' }] }).steps![0]!.internalTempTargetC).toBeUndefined()
  })
  it('retains the title safety signal when the draft ingredient list is incomplete', () => {
    expect(enrichScience({ title: 'Roast chicken', description: '', ingredients: [{ name: 'salt', amount: 1, unit: 'tsp' }], steps: [{ stepNumber: 1, instruction: 'Roast until cooked.', internalTempTargetC: 60 }] }).steps![0]!.internalTempTargetC).toBe(74)
  })
})

describe('source measurement preservation', () => {
  it.each([
    ['1,5 kg chicken', 1.5, 'kg', 'chicken'],
    ['1½ cups flour', 1.5, 'cup', 'flour'],
    ['2 κ.σ. ελαιόλαδο', 2, 'tbsp', 'ελαιόλαδο'],
    ['½ κ.γ. αλάτι', 0.5, 'tsp', 'αλάτι'],
    ['250 γραμμάρια αλεύρι', 250, 'g', 'αλεύρι'],
    ['1 λίτρο γάλα', 1, 'l', 'γάλα'],
    ['2 lime wedges', 2, 'piece', 'lime wedges']
  ])('preserves %s', (line, amount, unit, name) => {
    expect(parseIngredient(line)).toMatchObject({ amount, unit, name })
  })
  it.each(['½–¾ tsp salt', '1/2–3/4 tsp salt', '3/4–1/2 tsp salt'])('preserves fractional range %s', line => {
    expect(parseIngredient(line)).toMatchObject({ amount: 0.5, unit: 'tsp', name: 'salt', notes: expect.stringContaining('Source range:') })
  })
  it('preserves mixed ranges and decimal comma ranges', () => {
    expect(parseIngredient('1 1/2–2 1/2 cups flour')).toMatchObject({ amount: 1.5, unit: 'cup', name: 'flour', notes: expect.stringContaining('1 1/2–2 1/2') })
    expect(parseIngredient('1,5–2,5 kg chicken')).toMatchObject({ amount: 1.5, unit: 'kg', name: 'chicken', notes: expect.stringContaining('1.5–2.5') })
  })
  it('keeps normalized measures in the extracted JSON-LD draft', () => {
    const recipe = extractJsonLd('<script type="application/ld+json">' + JSON.stringify({ '@type': 'Recipe', name: 'Κοτόπουλο', recipeIngredient: ['1,5 kg chicken', '½–¾ tsp salt'], recipeInstructions: ['Roast chicken.'] }) + '</script>')
    expect(recipe?.ingredients).toMatchObject([{ amount: 1.5, unit: 'kg', name: 'chicken' }, { amount: 0.5, unit: 'tsp', name: 'salt' }])
  })
})
