import { convertUnit } from './units'

/** Show a quantity in US (oz, lb, fl oz) or metric (g, ml) units; units with no counterpart pass through unchanged. */
export function inSystem(amount: number, unit: string, imperial: boolean) {
  const from = unit.trim().toLowerCase()
  const targets: Record<string, string> = imperial
    ? { g: 'oz', kg: 'lb', ml: 'fl oz', l: 'fl oz' }
    : { oz: 'g', lb: 'g', 'fl oz': 'ml', cup: 'ml' }
  const to = targets[from]
  return to ? { amount: convertUnit(amount, from, to), unit: to } : { amount, unit: from }
}

/** A finite servings count within 1–1000 (fractions allowed), else null. Used for ?servings= query values. */
export function parseServings(value: unknown) {
  const number = Number(Array.isArray(value) ? value[0] : value)
  return value !== undefined && value !== '' && Number.isFinite(number) && number > 0 && number <= 1000 ? number : null
}
