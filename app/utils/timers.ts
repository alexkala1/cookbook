// Greek units are matched on accent-folded text: λεπτά → λεπτα, ώρα → ωρα.
const durationPattern = /(?<![\d.])(\d+(?:\.\d+)?)(?:\s*(?:[-–]|to|εως|ως)\s*(\d+(?:\.\d+)?))?(?:\s*-\s*|\s*)(hours?|hrs?|h|minutes?|mins?|min|seconds?|secs?|sec|s|ωρ(?:α|ες|ας|ων)|λεπτ(?:α|ο|ων)|δευτ(?:ερολεπτ(?:α|ο|ων))?\.?)(?!\p{L})/gu
// Ranges return the lower bound: check doneness early, then extend.
export function parseDurations(text: string): number[] {
  const source = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/(\d+)?([½¼¾])/g, (_all, whole, fraction) => String(Number(whole || 0) + ({ '½': 0.5, '¼': 0.25, '¾': 0.75 } as Record<string, number>)[fraction]!))
    .replace(/\b(\d+)\s+(\d+)\/(\d+)\b/g, (_all, whole, numerator, denominator) => Number(denominator) ? String(Number(whole) + Number(numerator) / Number(denominator)) : 'unknown')
    .replace(/\b(\d+)\/(\d+)\b/g, (_all, numerator, denominator) => Number(denominator) ? String(Number(numerator) / Number(denominator)) : 'unknown')
  const durations: number[] = []
  let previousEnd = -1
  for (const match of source.matchAll(durationPattern)) {
    if (/[-−]\s*$/.test(source.slice(0, match.index))) continue
    const amount = match[2] ? Math.min(Number(match[1]), Number(match[2])) : Number(match[1])
    const factor = /^[hω]/.test(match[3]!) ? 3600 : /^[mλ]/.test(match[3]!) ? 60 : 1
    const seconds = Math.round(amount * factor)
    if (seconds <= 0 || seconds > 604800) continue
    const gap = source.slice(previousEnd, match.index)
    if (previousEnd >= 0 && /^\s*(?:(?:and|και)\s*)?$/.test(gap)) durations[durations.length - 1]! += seconds
    else durations.push(seconds)
    previousEnd = match.index! + match[0].length
  }
  return durations.filter(seconds => seconds <= 604800)
}
export type CookingTimer = { id: number, name: string, duration: number, remaining: number, deadline: number, state: 'running' | 'paused' | 'idle' | 'finished' }
export function remainingSeconds(timer: CookingTimer, now: number) {
  return timer.state === 'running' ? Math.max(0, Math.ceil((timer.deadline - now) / 1000)) : timer.remaining
}
export function timerLabel(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
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
