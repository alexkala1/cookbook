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
