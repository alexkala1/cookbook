import { expect, it } from 'vitest'
import { conduct } from '../shared/culinary/conductor'

function clashes(fan: boolean) {
  return conduct({ targetTime: '19:00', courses: [
    { course: 'main', recipe: { id: 'hot', title: 'Hot dish', steps: [{ stepNumber: 1, instruction: `Bake at 200 C${fan ? ' fan' : ''}`, durationMinutes: 30 }] } },
    { course: 'main', recipe: { id: 'cool', title: 'Cool dish', steps: [{ stepNumber: 1, instruction: 'Bake at 180 C', durationMinutes: 30 }] } }
  ] }).bottlenecks
}
it('does not offer another fan reduction when a recipe already specifies fan heat', () => {
  expect(clashes(true).flatMap(conflict => conflict.resolutions).some(tip => tip.includes('its fan equivalent'))).toBe(false)
})
it('qualifies conversion advice when source oven modes are unspecified', () => {
  expect(clashes(false).flatMap(conflict => conflict.resolutions).filter(tip => tip.includes('its fan equivalent')).every(tip => tip.includes('Only if both recipes use conventional'))).toBe(true)
})
