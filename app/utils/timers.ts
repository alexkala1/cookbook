export function parseDurations(text: string): number[] {
  const source = text.replace(/(\d+)?([½¼¾])/g, (_all, whole, fraction) => String(Number(whole || 0) + ({ '½': 0.5, '¼': 0.25, '¾': 0.75 } as Record<string, number>)[fraction]!))
    .replace(/\b(\d+)\s+(\d+)\/(\d+)\b/g, (_all, whole, numerator, denominator) => Number(denominator) ? String(Number(whole) + Number(numerator) / Number(denominator)) : 'unknown')
    .replace(/\b(\d+)\/(\d+)\b/g, (_all, numerator, denominator) => Number(denominator) ? String(Number(numerator) / Number(denominator)) : 'unknown')
  const pattern = /\b(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?(?:\s*-\s*|\s*)(hours?|hrs?|h|minutes?|mins?|min|seconds?|secs?|sec|s)\b/gi
  const durations: number[] = []
  let previousEnd = -1
  for (const match of source.matchAll(pattern)) {
    if (/[-−]\s*$/.test(source.slice(0, match.index))) continue
    const amount = Number(match[2] || match[1])
    const factor = /^h/i.test(match[3]!) ? 3600 : /^m/i.test(match[3]!) ? 60 : 1
    const seconds = Math.round(amount * factor)
    if (seconds <= 0 || seconds > 604800) continue
    const gap = source.slice(previousEnd, match.index)
    if (previousEnd >= 0 && /^\s*(?:and\s*)?$/i.test(gap)) durations[durations.length - 1]! += seconds
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
