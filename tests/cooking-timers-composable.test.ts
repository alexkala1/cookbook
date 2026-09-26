import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useCookingTimers } from '../app/composables/useCookingTimers'

let mount: () => void, unmount: () => void
let stored: Map<string, string>
const initialTime = new Date('2026-09-26T12:00:00Z')
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(initialTime)
  stored = new Map()
  vi.stubGlobal('ref', <T>(value: T) => ({ value }))
  vi.stubGlobal('onMounted', (callback: () => void) => { mount = callback })
  vi.stubGlobal('onBeforeUnmount', (callback: () => void) => { unmount = callback })
  vi.stubGlobal('document', new EventTarget())
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value)
  })
})
afterEach(() => { unmount?.(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('finishes and persists an elapsed timer when Pause precedes the interval callback', () => {
  const cooking = useCookingTimers('recipe')
  mount()
  cooking.start('Simmer', 60)
  const timer = cooking.timers.value[0]!
  // Advance wall time without dispatching interval callbacks (a throttled tab).
  vi.setSystemTime(initialTime.getTime() + 60001)
  cooking.toggle(timer)
  expect(timer).toMatchObject({ state: 'finished', remaining: 0 })
  expect(cooking.alerts.value).toEqual(['Simmer finished'])
  expect(JSON.parse(stored.get('heirloom:timers:v1:recipe')!).timers[0]).toMatchObject({ state: 'finished', remaining: 0 })
  vi.advanceTimersByTime(1000)
  expect(cooking.alerts.value).toEqual(['Simmer finished'])
  expect(timer.state).toBe('finished')
})

it('preserves the remaining duration across an ordinary pause, resume and completion', () => {
  const cooking = useCookingTimers('recipe')
  mount(); cooking.start('Rest', 60)
  const timer = cooking.timers.value[0]!
  vi.setSystemTime(initialTime.getTime() + 20000)
  cooking.toggle(timer)
  expect(timer).toMatchObject({ state: 'paused', remaining: 40 })
  vi.advanceTimersByTime(10000)
  expect(timer.remaining).toBe(40)
  expect(cooking.alerts.value).toEqual([])
  cooking.toggle(timer)
  expect(timer).toMatchObject({ state: 'running', deadline: Date.now() + 40000 })
  vi.advanceTimersByTime(40000)
  expect(timer).toMatchObject({ state: 'finished', remaining: 0 })
  expect(cooking.alerts.value).toEqual(['Rest finished'])
})
