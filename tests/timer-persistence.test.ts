import { expect, it } from 'vitest'
import { remainingSeconds, restoreTimers } from '../app/utils/timers'
const timer = () => ({ id: 1, name: 'Rest', duration: 60, remaining: 60, deadline: Date.now() + 60000, state: 'running' as const })
it('restores absolute deadlines, paused timers and elapsed countdowns', () => {
  const source = timer(), raw = JSON.stringify({ version: 1, timers: [source, { ...source, id: 2, remaining: 20, state: 'paused' }] })
  const restored = restoreTimers(raw)
  expect(restored).toHaveLength(2)
  expect(remainingSeconds(restored[0]!, source.deadline - 10000)).toBe(10)
  expect(remainingSeconds(restored[0]!, source.deadline + 10000)).toBe(0)
  expect(remainingSeconds(restored[1]!, source.deadline + 10000)).toBe(20)
})
it('rejects corrupt, oversized, duplicate and invalid persisted timers', () => {
  for (const raw of [null, 'bad', '{}', JSON.stringify({ version: 2, timers: [timer()] }), JSON.stringify({ version: 1, timers: Array(21).fill(timer()) })]) expect(restoreTimers(raw)).toEqual([])
  expect(restoreTimers(JSON.stringify({ version: 1, timers: [timer(), timer(), { ...timer(), id: 2, duration: -1 }, { ...timer(), id: 3, state: 'unknown' }] }))).toHaveLength(1)
})
it('preserves valid millisecond precision and rejects invalid millisecond values', () => {
  const source = { ...timer(), remaining: 20, remainingMs: 19125, state: 'paused' }
  expect(restoreTimers(JSON.stringify({ version: 1, timers: [source] }))[0]).toMatchObject({ remainingMs: 19125 })
  for (const remainingMs of [-1, 60001, '19125', null]) {
    expect(restoreTimers(JSON.stringify({ version: 1, timers: [{ ...source, remainingMs }] }))).toEqual([])
  }
})
