import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { useCookingTimers } from '../app/composables/useCookingTimers'
import { QUICK_TIMER_PRESETS, formatTimerHeading } from '../app/utils/timers'

// Vue is supplied by Nuxt rather than declared as a direct dependency.
const require = createRequire(import.meta.url)
const { computed, ref } = require(require.resolve('vue', { paths: [require.resolve('nuxt/package.json')] }))

let mount: () => void, unmount: () => void
let stored: Map<string, string>
const initialTime = new Date('2026-09-26T12:00:00Z')
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(initialTime)
  stored = new Map()
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('onMounted', (callback: () => void) => { mount = callback })
  vi.stubGlobal('onBeforeUnmount', (callback: () => void) => { unmount = callback })
  vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false, title: 'Heirloom' }))
  vi.stubGlobal('navigator', { vibrate: vi.fn() })
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value)
  })
})
afterEach(() => { unmount?.(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('provides the seven kitchen presets with the requested intervals and descriptions', () => {
  expect(QUICK_TIMER_PRESETS).toEqual([
    { label: '1m', seconds: 60, description: 'Flash boil / Taste check' },
    { label: '3m', seconds: 180, description: 'Soft-boiled eggs' },
    { label: '5m', seconds: 300, description: 'Blanch / Steam greens' },
    { label: '10m', seconds: 600, description: 'Sauté / Soften onions' },
    { label: '15m', seconds: 900, description: 'Roast check' },
    { label: '30m', seconds: 1800, description: 'Rest dough / Cool' },
    { label: '45m', seconds: 2700, description: 'Simmer broth' }
  ])
})

it.each([
  ['Eggs', 180, 'Eggs · 03:00'],
  ['Taste check', 90, 'Taste check · 01:30'],
  ['Done', 0, 'Done · 00:00'],
  ['Slow broth', 7200, 'Slow broth · 120:00']
])('formats the heading for %s', (name, seconds, expected) => {
  expect(formatTimerHeading(name, seconds)).toBe(expected)
})

it('starts a preset through the existing persistent timer lifecycle', () => {
  const cooking = useCookingTimers('recipe')
  mount()
  cooking.startPreset('3m', 180)
  expect(cooking.timers.value[0]).toMatchObject({ name: '3m', duration: 180, remaining: 180, state: 'running', deadline: initialTime.getTime() + 180000 })
  expect(JSON.parse(stored.get('heirloom:timers:v1:recipe')!).timers).toEqual(cooking.timers.value)
})

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

it('starts custom timers in minutes, including fractional minutes', () => {
  const cooking = useCookingTimers('recipe')
  mount()
  cooking.startCustom('Rest dough', 15)
  cooking.startCustom('Taste check', 1.5)
  expect(cooking.timers.value.map(timer => [timer.name, timer.duration, timer.deadline])).toEqual([
    ['Rest dough', 900, initialTime.getTime() + 900000],
    ['Taste check', 90, initialTime.getTime() + 90000]
  ])
  expect(JSON.parse(stored.get('heirloom:timers:v1:recipe')!).timers).toEqual(cooking.timers.value)
})

it('preserves duration validation and the timer limit through both start helpers', () => {
  const cooking = useCookingTimers('recipe')
  mount()
  for (const duration of [0, -1, NaN, Infinity, 604801]) {
    cooking.startPreset('Invalid', duration)
    cooking.startCustom('Invalid', duration)
  }
  expect(cooking.timers.value).toEqual([])
  for (let index = 0; index < 20; index++) cooking.startPreset('Eggs', 180)
  cooking.startCustom('Overflow', 5)
  cooking.startPreset('Overflow', 60)
  expect(cooking.timers.value).toHaveLength(20)
  expect(cooking.runningCount.value).toBe(20)
})

it('reactively counts running timers and includes paused timers only in the active list', () => {
  const cooking = useCookingTimers('recipe')
  mount()
  expect(cooking.runningCount.value).toBe(0)
  expect(cooking.activeTimers.value).toEqual([])
  cooking.startPreset('Quick', 2)
  cooking.startCustom('Rest', 1)
  expect(cooking.runningCount.value).toBe(2)
  expect(cooking.activeTimers.value).toEqual(cooking.timers.value)
  const [quick, rest] = cooking.timers.value
  cooking.toggle(rest!)
  expect(cooking.runningCount.value).toBe(1)
  expect(cooking.activeTimers.value).toEqual([quick, rest])
  vi.advanceTimersByTime(2000)
  expect(cooking.runningCount.value).toBe(0)
  expect(cooking.activeTimers.value).toEqual([rest])
  cooking.toggle(rest!)
  expect(cooking.runningCount.value).toBe(1)
  cooking.reset(rest!)
  expect(cooking.runningCount.value).toBe(0)
  expect(cooking.activeTimers.value).toEqual([])
  cooking.toggle(rest!)
  cooking.remove(rest!)
  expect(cooking.runningCount.value).toBe(0)
  expect(cooking.activeTimers.value).toEqual([])
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

it('preserves milliseconds across repeated pause cycles and a paused reload', () => {
  let cooking = useCookingTimers('recipe')
  mount(); cooking.start('Rest', 2)
  let timer = cooking.timers.value[0]!
  vi.advanceTimersByTime(125)
  cooking.toggle(timer)
  expect(timer).toMatchObject({ remaining: 2, remainingMs: 1875, state: 'paused' })
  unmount()
  cooking = useCookingTimers('recipe'); mount()
  timer = cooking.timers.value[0]!
  expect(timer.remainingMs).toBe(1875)
  for (let cycle = 0; cycle < 3; cycle++) {
    cooking.toggle(timer)
    vi.advanceTimersByTime(125)
    cooking.toggle(timer)
  }
  expect(timer.remainingMs).toBe(1500)
  cooking.toggle(timer)
  expect(timer.deadline).toBe(initialTime.getTime() + 2000)
  vi.advanceTimersByTime(1500)
  document.dispatchEvent(new Event('visibilitychange'))
  expect(timer.state).toBe('finished')
})

it('resumes legacy paused timers that have no millisecond field', () => {
  stored.set('heirloom:timers:v1:recipe', JSON.stringify({ version: 1, timers: [{ id: 1, name: 'Rest', duration: 60, remaining: 20, deadline: initialTime.getTime(), state: 'paused' }] }))
  const cooking = useCookingTimers('recipe'); mount()
  cooking.toggle(cooking.timers.value[0]!)
  expect(cooking.timers.value[0]).toMatchObject({ remainingMs: 20000, deadline: initialTime.getTime() + 20000, state: 'running' })
})

it('vibrates once on completion and flashes the hidden title until visible', () => {
  const cooking = useCookingTimers('recipe'); mount()
  Object.defineProperty(document, 'hidden', { configurable: true, value: true })
  cooking.start('Rest', 1)
  vi.advanceTimersByTime(1000)
  expect(navigator.vibrate).toHaveBeenCalledExactlyOnceWith([300, 150, 300, 150, 300])
  expect(document.title).toBe('⏰ Timer finished!')
  vi.advanceTimersByTime(1000)
  expect(document.title).toBe('Heirloom')
  vi.advanceTimersByTime(1000)
  expect(document.title).toBe('⏰ Timer finished!')
  Object.defineProperty(document, 'hidden', { value: false })
  document.dispatchEvent(new Event('visibilitychange'))
  expect(document.title).toBe('Heirloom')
  vi.advanceTimersByTime(2000)
  expect(document.title).toBe('Heirloom')
  expect(navigator.vibrate).toHaveBeenCalledTimes(1)
})

it('resumes suspended audio when becoming visible and tolerates denied resume', async () => {
  const audio = { state: 'suspended', resume: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) }
  vi.stubGlobal('AudioContext', class { constructor() { return audio } })
  const cooking = useCookingTimers('recipe'); mount()
  await cooking.enableSound()
  audio.resume.mockClear()
  Object.defineProperty(document, 'hidden', { configurable: true, value: true })
  document.dispatchEvent(new Event('visibilitychange'))
  expect(audio.resume).not.toHaveBeenCalled()
  audio.resume.mockRejectedValue(new Error('Audio denied'))
  Object.defineProperty(document, 'hidden', { value: false })
  document.dispatchEvent(new Event('visibilitychange'))
  await Promise.resolve()
  expect(audio.resume).toHaveBeenCalledTimes(1)
})

it('restores the title and cleans up flashing, ticks and listeners on unmount', () => {
  const documentRemove = vi.spyOn(document, 'removeEventListener')
  const windowRemove = vi.spyOn(window, 'removeEventListener')
  const cooking = useCookingTimers('recipe'); mount()
  Object.defineProperty(document, 'hidden', { configurable: true, value: true })
  cooking.start('Rest', 1); vi.advanceTimersByTime(1000)
  expect(document.title).toBe('⏰ Timer finished!')
  unmount()
  expect(document.title).toBe('Heirloom')
  expect(vi.getTimerCount()).toBe(0)
  expect(documentRemove).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  expect(windowRemove).toHaveBeenCalledWith('pagehide', expect.any(Function))
})

it('still completes when vibration is unavailable or denied', () => {
  vi.stubGlobal('navigator', { vibrate: () => { throw new Error('Denied') } })
  const cooking = useCookingTimers('recipe'); mount()
  cooking.start('Rest', 1); vi.advanceTimersByTime(1000)
  expect(cooking.alerts.value).toEqual(['Rest finished'])
  expect(cooking.timers.value[0]!.state).toBe('finished')
})
