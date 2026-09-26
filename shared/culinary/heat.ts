export type Oven = 'convection_fan' | 'static_conventional'
export type Stove = 'gas' | 'induction' | 'electric_radiant'

// These are two alternative cooking heuristics, not an exact C/F equivalence.
export function convertOven(temperature: number, minutes: number, from: Oven, to: Oven, unit: 'C' | 'F' = 'C', strategy: 'temperature' | 'time' = 'temperature') {
  if (!Number.isFinite(temperature) || !Number.isFinite(minutes) || minutes < 0) throw new RangeError('Use finite temperature and nonnegative time')
  if (from === to) return { temperature, minutes }
  const toFan = to === 'convection_fan'
  if (strategy === 'time') return { temperature, minutes: toFan ? minutes * 0.8 : minutes / 0.8 }
  return { temperature: temperature + (toFan ? -1 : 1) * (unit === 'C' ? 20 : 25), minutes }
}

export function burnerAdvice(stove: Stove, heat?: string | null) {
  const control = heat && heat !== 'none' ? `For ${heat} heat: ` : ''
  const advice = {
    gas: 'Flame changes respond quickly, but the pan retains heat. Keep flames under the pan base and lower the flame when sizzling becomes harsh.',
    induction: 'The pan heats rapidly through induction. Begin below boost, increase gradually, and reduce power early; the pan can stay hot after power drops.',
    electric_radiant: 'The element stores heat and cools slowly. Reduce power ahead of the target; move the pan to a cool burner if cooking must slow immediately.'
  }
  return control + advice[stove]
}

export function ovenTemperature(text: string): { temperature: number, unit: 'C' | 'F' } | null {
  // Exclude food probe/readout temperatures from oven settings.
  const settings = text.replace(/(?:internal(?:\s+temperature)?|thermometer|probe|core)[^.;]*?\d{2,3}\s*(?:°\s*|degrees?\s*)?[CF]\b/gi, '')
  for (const match of settings.matchAll(/\b(\d{2,3})\s*(?:°\s*|degrees?\s*)?([CF])\b/gi)) {
    if (/\b(?:until|reach(?:es)?)\b[^.;]*$/i.test(settings.slice(0, match.index))) continue
    return { temperature: Number(match[1]), unit: match[2]!.toUpperCase() as 'C' | 'F' }
  }
  return null
}
