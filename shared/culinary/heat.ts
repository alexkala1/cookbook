export type Oven = 'convection_fan' | 'static_conventional'
export type Stove = 'gas' | 'induction' | 'electric_radiant'

// Below these settings the fan offset would push slow cooking toward the bacterial danger zone.
const lowTemperature = { C: 120, F: 250 }
const minimumTemperature = { C: 60, F: 140 }
export const lowTemperatureNote = 'Low-temperature cooking: no fan temperature reduction below 120 °C / 250 °F. Keep the recipe setting and confirm doneness with a thermometer.'

// These are two alternative cooking heuristics, not an exact C/F equivalence.
export function convertOven(temperature: number, minutes: number, from: Oven, to: Oven, unit: 'C' | 'F' = 'C', strategy: 'temperature' | 'time' = 'temperature'): { temperature: number, minutes: number, note?: string } {
  if (!Number.isFinite(temperature) || !Number.isFinite(minutes) || minutes < 0) throw new RangeError('Use finite temperature and nonnegative time')
  if (from === to) return { temperature, minutes }
  const toFan = to === 'convection_fan'
  if (strategy === 'time') return { temperature, minutes: toFan ? minutes * 0.8 : minutes / 0.8 }
  if (toFan && temperature < lowTemperature[unit]) return { temperature, minutes, note: lowTemperatureNote }
  return { temperature: Math.max(minimumTemperature[unit], temperature + (toFan ? -1 : 1) * (unit === 'C' ? 20 : 25)), minutes }
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

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const probeReading = /(?:internal(?:\s+temperature)?|thermometer|probe|core|θερμομετρ\p{L}*|εσωτερικ\p{L}*(?:\s+θερμοκρασι\p{L}*)?)[^.;]*?\d{2,3}\s*(?:°\s*|degrees?\s*|βαθμ\p{L}*\s*)?(?:[cf](?!\p{L})|κελσιου|φαρεναιτ)?/gu
const setting = /(?<![\d.])(\d{2,3})\s*(?:(?:°\s*|degrees?\s*)?([cf])(?!\p{L})|°?\s*βαθμ\p{L}*(?:\s+(κελσιου|φαρεναιτ))?|°(?!\s*[cf]))/gu
const untilClause = /(?<!\p{L})(?:until|reach(?:es)?|μεχρι|ωσπου|φτασει)(?!\p{L})[^.;,]*$/u

export function ovenTemperature(text: string): { temperature: number, unit: 'C' | 'F' } | null {
  const greek = /[Ͱ-Ͽ]/.test(text)
  // Exclude food probe/readout temperatures from oven settings.
  const settings = fold(text).replace(probeReading, '')
  for (const match of settings.matchAll(setting)) {
    // A bare degree sign is only read as Celsius in Greek text; elsewhere it may be Fahrenheit.
    if (!match[2] && !match[0].includes('βαθμ') && !greek) continue
    if (untilClause.test(settings.slice(0, match.index))) continue
    return { temperature: Number(match[1]), unit: match[2] === 'f' || match[3] === 'φαρεναιτ' ? 'F' : 'C' }
  }
  return null
}
