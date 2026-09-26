import { expect, it } from 'vitest'
import { detectSwipe, motionCentroid } from '../app/utils/motion'
it('maps sustained horizontal movement to the requested direction', () => {
  const samples = [0.8, 0.65, 0.5, 0.3].map((x, i) => ({ x, time: i * 100 }))
  expect(detectSwipe(samples, 350)).toBe('next')
  expect(detectSwipe(samples.map(sample => ({ ...sample, x: 1 - sample.x })), 350)).toBe('previous')
  expect(detectSwipe(samples, 2000)).toBeNull()
  expect(detectSwipe([{ x: 0.1, time: 0 }, { x: 0.9, time: 10 }], 20)).toBeNull()
})
it('ignores static frames and full-frame lighting changes', () => {
  const dark = new Uint8ClampedArray(100 * 100 * 4)
  expect(motionCentroid(dark, dark, 100)).toBeNull()
  expect(motionCentroid(dark, new Uint8ClampedArray(dark.length).fill(255), 100)).toBeNull()
  const current = dark.slice()
  for (let y = 30; y < 60; y++) for (let x = 20; x < 30; x++) current.fill(255, (y * 100 + x) * 4, (y * 100 + x) * 4 + 4)
  expect(motionCentroid(dark, current, 100)).toBeCloseTo(0.245)
})
