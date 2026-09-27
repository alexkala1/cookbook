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

it('writes storage only on state changes, never on countdown ticks', () => {
  const writes: string[] = []
  vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: (_key: string, value: string) => { writes.push(value) } })
  const cooking = useCookingTimers('recipe')
  mount()
  const afterMount = writes.length
  cooking.start('Simmer', 60); cooking.start('Rest', 30)
  expect(writes.length).toBe(afterMount + 2)
  vi.advanceTimersByTime(10000) // 40 ticks while both run
  expect(writes.length).toBe(afterMount + 2)
  expect(cooking.timers.value[0]!.remaining).toBe(50)
  cooking.toggle(cooking.timers.value[0]!); cooking.toggle(cooking.timers.value[0]!); cooking.reset(cooking.timers.value[1]!)
  expect(writes.length).toBe(afterMount + 5)
  vi.advanceTimersByTime(50000) // Simmer finishes: one write for the state change
  expect(writes.length).toBe(afterMount + 6)
  expect(JSON.parse(writes.at(-1)!).timers[0]).toMatchObject({ state: 'finished' })
})

it('persists timer removal immediately', () => {
  const cooking = useCookingTimers('recipe')
  mount(); cooking.start('Simmer', 60); cooking.start('Rest', 30)
  cooking.remove(cooking.timers.value[0]!)
  expect(cooking.timers.value.map(timer => timer.name)).toEqual(['Rest'])
  expect(JSON.parse(stored.get('heirloom:timers:v1:recipe')!).timers.map((timer: { name: string }) => timer.name)).toEqual(['Rest'])
})

it('restores the original deadline and writes storage exactly once', () => {
  const writes = vi.fn()
  vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: writes })
  const cooking = useCookingTimers('recipe')
  mount(); cooking.start('Simmer', 60)
  const original = { ...cooking.timers.value[0]! }
  cooking.remove(original)
  vi.advanceTimersByTime(4000)
  writes.mockClear()
  cooking.restore(original)
  expect(writes).toHaveBeenCalledTimes(1)
  expect(cooking.timers.value[0]).toMatchObject({ id: original.id, deadline: original.deadline, remaining: 56, state: 'running' })
  cooking.restore(original)
  expect(writes).toHaveBeenCalledTimes(1)
  expect(cooking.timers.value).toHaveLength(1)
})

it('finishes a restored overdue timer once without resetting its deadline', () => {
  const cooking = useCookingTimers('recipe')
  mount(); cooking.start('Rest', 2)
  const original = { ...cooking.timers.value[0]! }
  cooking.remove(original); vi.advanceTimersByTime(3000); cooking.restore(original)
  expect(cooking.timers.value[0]).toMatchObject({ deadline: original.deadline, remaining: 0, state: 'finished' })
  expect(cooking.alerts.value).toEqual(['Rest finished'])
  vi.advanceTimersByTime(1000)
  expect(cooking.alerts.value).toEqual(['Rest finished'])
})

it('restores paused timers without counting removed time against them', () => {
  const cooking = useCookingTimers('recipe')
  mount(); cooking.start('Rest', 60); cooking.toggle(cooking.timers.value[0]!)
  const paused = { ...cooking.timers.value[0]! }
  cooking.remove(paused); vi.advanceTimersByTime(4000); cooking.restore(paused)
  expect(cooking.timers.value[0]).toEqual(paused)
})
