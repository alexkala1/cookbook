// Parsing lives in shared/ so the meal-plan conductor on the server can use it too.
// Use the #shared alias: relative paths out of app/ break in the production build directory.
export { parseDurations } from '#shared/culinary/durations'
export interface QuickTimerPreset { label: string, seconds: number, description: string }
export const QUICK_TIMER_PRESETS: QuickTimerPreset[] = [
  { label: '1m', seconds: 60, description: 'Flash boil / Taste check' },
  { label: '3m', seconds: 180, description: 'Soft-boiled eggs' },
  { label: '5m', seconds: 300, description: 'Blanch / Steam greens' },
  { label: '10m', seconds: 600, description: 'Sauté / Soften onions' },
  { label: '15m', seconds: 900, description: 'Roast check' },
  { label: '30m', seconds: 1800, description: 'Rest dough / Cool' },
  { label: '45m', seconds: 2700, description: 'Simmer broth' }
]
export type CookingTimer = { id: number, name: string, duration: number, remaining: number, deadline: number, state: 'running' | 'paused' | 'idle' | 'finished' }
export function remainingSeconds(timer: CookingTimer, now: number) {
  return timer.state === 'running' ? Math.max(0, Math.ceil((timer.deadline - now) / 1000)) : timer.remaining
}
export function timerLabel(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
}

export function formatTimerHeading(name: string, seconds: number): string {
  return `${name} · ${timerLabel(seconds)}`
}

export function restoreTimers(raw: string | null): CookingTimer[] {
  try {
    const value = JSON.parse(raw || 'null')
    if (value?.version !== 1 || !Array.isArray(value.timers) || value.timers.length > 20) return []
    const ids = new Set<number>()
    return value.timers.filter((timer: CookingTimer) => {
      if (!timer || !Number.isSafeInteger(timer.id) || timer.id < 1 || ids.has(timer.id)
        || typeof timer.name !== 'string' || timer.name.length > 200
        || !Number.isFinite(timer.duration) || timer.duration <= 0 || timer.duration > 604800
        || !Number.isFinite(timer.remaining) || timer.remaining < 0 || timer.remaining > timer.duration
        || !Number.isSafeInteger(timer.deadline) || timer.deadline < 0 || timer.deadline > Date.now() + 604800000
        || !['running', 'paused', 'idle', 'finished'].includes(timer.state)) return false
      ids.add(timer.id); return true
    }).map((timer: CookingTimer) => ({ id: timer.id, name: timer.name, duration: timer.duration, remaining: timer.remaining, deadline: timer.deadline, state: timer.state }))
  } catch { return [] }
}
