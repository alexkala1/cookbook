import { expect, it } from 'vitest'
import { parseDurations, remainingSeconds, timerLabel, type CookingTimer } from '../app/utils/timers'
it.each([
  ['simmer for 15 minutes', [900]], ['rest 10 min', [600]], ['Bake for 1 hour 30 minutes', [5400]],
  ['Cook 10–15 minutes, then rest 5 min', [900, 300]], ['whisk 1.5 minutes', [90]],
  ['Sear for 30 seconds per side', [30]], ['Wait 0 seconds', []], ['Bake at 200°C', []],
  ['Cook for 2 hrs and 10 mins', [7800]], ['No time given', []], ['Wait 999999 hours', []],
  ['Rest 1/2 hour', [1800]], ['Rest 1 1/2 hours', [5400]], ['Cook for ½ hour', [1800]], ['Cook for 1½ hours', [5400]], ['15-minute rest', [900]], ['Wait -5 minutes', []], ['Wait 1/0 hours', []]
])('parses %s', (text, expected) => expect(parseDurations(text as string)).toEqual(expected))
it('uses deadlines to recover elapsed time after a delayed browser tick', () => {
  const timer: CookingTimer = { id: 1, name: 'Simmer', duration: 60, remaining: 60, deadline: 61000, state: 'running' }
  expect(remainingSeconds(timer, 41000)).toBe(20)
  expect(remainingSeconds(timer, 99000)).toBe(0)
  expect(remainingSeconds({ ...timer, state: 'paused', remaining: 15 }, 99000)).toBe(15)
  expect(timerLabel(125)).toBe('02:05')
})
