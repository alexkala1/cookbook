import { expect, it } from 'vitest'
import { auditDietary } from '../shared/culinary/dietary'
it.each(['gluten', 'shellfish'])('flags the explicitly named allergen category %s', allergy => {
  const result = auditDietary([{ id: 'r', title: 'Dish', ingredients: [{ name: allergy }] }], [{ name: 'Guest', allergies: [allergy], dietaryRestrictions: [], dislikes: [] }])
  expect(result.conflicts).toContainEqual(expect.objectContaining({ type: 'critical_allergen', restriction: allergy }))
})
it('does not infer gluten from an explicit gluten-free rice flour label alone', () => {
  const result = auditDietary([{ id: 'r', title: 'Dish', ingredients: [{ name: 'gluten-free rice flour' }] }], [{ name: 'Guest', allergies: ['gluten'], dietaryRestrictions: [], dislikes: [] }])
  expect(result.conflicts).toEqual([])
  expect(result.notice).toContain('not a safety clearance')
})
