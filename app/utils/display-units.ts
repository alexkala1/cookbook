import { convertUnit } from './units'

/** Show a quantity in US (oz, lb, fl oz) or metric (g, ml) units; units with no counterpart pass through unchanged. */
export function inSystem(amount: number, unit: string, imperial: boolean, gramsEquivalent?: number | null) {
  if (!imperial && gramsEquivalent != null) return { amount: gramsEquivalent, unit: 'g' }
  const from = unit.trim().toLowerCase()
  const targets: Record<string, string> = imperial
    ? { g: 'oz', kg: 'lb', ml: 'fl oz', l: 'fl oz' }
    : { oz: 'g', lb: 'g', 'fl oz': 'ml' }
  const to = targets[from]
  return to ? { amount: convertUnit(amount, from, to), unit: to } : { amount, unit: from }
}

export function formatCulinaryAmount(amount: number, unit: string): string {
  if (['g', 'ml'].includes(unit.trim().toLowerCase())) return String(Math.abs(amount) >= 1 ? Math.round(amount) : Number(amount.toFixed(2)))
  const whole = Math.floor(amount), fraction = amount - whole
  const fractions: [number, string][] = [[1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'], [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞']]
  const match = fractions.find(([value]) => Math.abs(fraction - value) < 0.005)
  return match ? `${whole ? whole + ' ' : ''}${match[1]}` : String(Number(amount.toFixed(2)))
}

/** Parenthetical source volumes remain volumes; their original cup/spoon measure stays intact. */
export function ingredientInSystem(ingredient: { amount: number, unit: string, gramsEquivalent?: number | null, notes?: string | null }, imperial: boolean) {
  if (!imperial && ingredient.gramsEquivalent == null) {
    const source = ingredient.notes?.match(/Source volume: ([\d.e+-]+) ml for ([\d.e+-]+) ([^.]+)\./)
    if (source && source[3] === ingredient.unit && Number(source[2]) > 0) {
      return { amount: Number(source[1]) * ingredient.amount / Number(source[2]), unit: 'ml' }
    }
  }
  return inSystem(ingredient.amount, ingredient.unit, imperial, ingredient.gramsEquivalent)
}

export function formatIngredientNotes(notes: string | null | undefined): string | null {
  return notes?.replace(/Source volume: ([\d.e+-]+) ml for ([\d.e+-]+) ([^.]+)\./g,
    (_, ml: string, amount: string, unit: string) => `Source volume: ${formatCulinaryAmount(Number(ml), 'ml')} ml for ${formatCulinaryAmount(Number(amount), unit)} ${unit}.`) ?? null
}

/** A finite servings count within 1–1000 (fractions allowed), else null. Used for ?servings= query values. */
export function parseServings(value: unknown) {
  const number = Number(Array.isArray(value) ? value[0] : value)
  return value !== undefined && value !== '' && Number.isFinite(number) && number > 0 && number <= 1000 ? number : null
}
