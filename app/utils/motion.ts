export function motionCentroid(previous: Uint8ClampedArray, current: Uint8ClampedArray, width: number) {
  let changed = 0, sumX = 0
  for (let i = 0; i < current.length; i += 4) {
    const delta = Math.abs(current[i]! - previous[i]!) + Math.abs(current[i + 1]! - previous[i + 1]!) + Math.abs(current[i + 2]! - previous[i + 2]!)
    if (delta > 100) { changed++; sumX += (i / 4) % width }
  }
  const ratio = changed / (current.length / 4)
  // Ignore tiny sensor noise and whole-frame exposure changes.
  return ratio >= 0.012 && ratio <= 0.45 ? sumX / changed / width : null
}
export function detectSwipe(samples: { x: number, time: number }[], now: number): 'next' | 'previous' | null {
  const recent = samples.filter(sample => now - sample.time < 900)
  if (recent.length < 4) return null
  const first = recent[0]!, last = recent.at(-1)!
  if (last.time - first.time < 180) return null
  const displacement = last.x - first.x
  if (Math.abs(displacement) < 0.3) return null
  const consistent = recent.slice(1).filter((sample, i) => Math.sign(sample.x - recent[i]!.x) === Math.sign(displacement)).length
  return consistent / (recent.length - 1) >= 0.7 ? displacement < 0 ? 'next' : 'previous' : null
}
