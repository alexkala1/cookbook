import { isPlainSalt, saltDensities, type SaltType } from './units'

// Practical kitchen estimates: a rounded 240 ml cup, 15 ml tablespoon, 5 ml teaspoon.
// Salt values deliberately reuse the existing engine (table salt ≈ 6 g/tsp).
export const culinaryDensities = {
  flour: 120, granulatedSugar: 200, brownSugar: 220, powderedSugar: 120,
  butter: 227, oil: 215, honey: 340, rolledOats: 90, rice: 185
} as const

export const flourBasis = 'Approx. 120 g per spooned cup (spoon lightly into cup; dipped/scooped cups can weigh 140g+)'

export type MetricIngredient = { name: string; amount: number; unit: string; gramsEquivalent?: number | null; notes?: string | null }
export type MetricSuggestion = { amount: number; unit: 'g' | 'ml'; gramsEquivalent: number; basis: string; originalMeasure: string }
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()
const round = (value: number) => Number(value.toFixed(2))
const volumeUnits: Record<string, number> = { cup: 240, cups: 240, tbsp: 15, tablespoon: 15, tablespoons: 15, tsp: 5, teaspoon: 5, teaspoons: 5, 'fl oz': 29.5735295625, 'fluid ounce': 29.5735295625, 'fluid ounces': 29.5735295625 }

function density(name: string, saltType?: SaltType | null): { gramsPerCup: number; liquid?: boolean; butter?: boolean; basis: string } | null {
  if (isPlainSalt(name) && !/\b(and|blend|mix|with)\b/.test(name)) {
    const type = saltType ?? (name.includes('diamond crystal') ? 'diamond_crystal_kosher'
      : name.includes('morton') ? 'morton_kosher' : /^(fine )?table salt$/.test(name) ? 'table_salt'
        : /^(greek fine sea salt|ελληνικο ψιλο θαλασσινο αλατι)$/.test(name) ? 'greek_fine_sea_salt' : null)
    return type ? { gramsPerCup: saltDensities[type] * 48, basis: `${saltDensities[type]} g per tsp of ${type.replaceAll('_', ' ')}` } : null
  }
  const entry = (gramsPerCup: number, extra = {}) => ({ gramsPerCup, basis: `Approx. ${gramsPerCup} g per 240 ml cup`, ...extra })
  if (/^(all purpose flour|plain flour|bread flour|pastry flour|wheat flour|flour)$/.test(name)) return { ...entry(culinaryDensities.flour), basis: flourBasis }
  if (/^(sugar|granulated sugar|white sugar|white granulated sugar)$/.test(name)) return entry(culinaryDensities.granulatedSugar)
  if (/^(packed )?((light|dark) )?brown sugar$/.test(name)) return { ...entry(culinaryDensities.brownSugar), basis: 'Approx. 220 g per packed cup' }
  if (/^(powdered sugar|icing sugar|confectioners.? sugar)$/.test(name)) return entry(culinaryDensities.powderedSugar)
  if (/^(butter|unsalted butter|salted butter)$/.test(name)) return entry(culinaryDensities.butter, { butter: true })
  if (/^(olive oil|extra virgin olive oil|vegetable oil)$/.test(name)) return entry(culinaryDensities.oil, { liquid: true })
  if (/^(honey|raw honey)$/.test(name)) return entry(culinaryDensities.honey)
  if (/^(rolled oats|old fashioned oats)$/.test(name)) return entry(culinaryDensities.rolledOats)
  if (/^(rice|white rice|long grain rice|basmati rice|uncooked rice|dry rice)$/.test(name)) return entry(culinaryDensities.rice)
  if (name === 'water') return entry(240, { liquid: true })
  return null
}

export function suggestMetric(ingredient: MetricIngredient, saltType?: SaltType | null): MetricSuggestion | null {
  if (!Number.isFinite(ingredient.amount) || ingredient.amount <= 0) return null
  const unit = fold(ingredient.unit).replace(/\.$/, '')
  const originalMeasure = `Original measure: ${ingredient.amount} ${ingredient.unit}`
  if (((ingredient.notes || '') + '\n' + originalMeasure).length > 10000) return null
  const result = (amount: number, target: 'g' | 'ml', grams: number, basis: string): MetricSuggestion | null =>
    [amount, grams].every(value => Number.isFinite(value) && round(value) > 0 && value <= 1000000)
      ? { amount: round(amount), unit: target, gramsEquivalent: round(grams), basis, originalMeasure } : null
  const mass = /^(oz|ounce|ounces)$/.test(unit) ? 28.349523125 : /^(lb|lbs|pound|pounds)$/.test(unit) ? 453.59237 : null
  if (mass) return result(ingredient.amount * mass, 'g', ingredient.amount * mass, 'Weight conversion; oz means ounces by weight, not fluid ounces')
  const volume = Object.hasOwn(volumeUnits, unit) ? volumeUnits[unit]! : undefined
  const stick = /^(stick|sticks)$/.test(unit)
  if (!volume && !stick) return null
  const known = density(fold(ingredient.name), saltType)
  if (stick && !known?.butter) return null
  if (ingredient.gramsEquivalent != null) return result(ingredient.gramsEquivalent, 'g', ingredient.gramsEquivalent, 'Using the recorded gram equivalent')
  if (!known) return null
  const grams = ingredient.amount * (stick ? 113 : known.butter && volume === 15 ? 113 / 8 : known.gramsPerCup * (volume! / 240))
  return result(known.liquid ? ingredient.amount * volume! : grams, known.liquid ? 'ml' : 'g', grams,
    stick ? 'Approx. 113 g per US butter stick (8 tbsp)' : known.basis)
}

export function applyMetric<T extends MetricIngredient>(ingredient: T, saltType?: SaltType | null): T {
  const suggestion = suggestMetric(ingredient, saltType)
  if (!suggestion) return { ...ingredient }
  const notes = ingredient.notes || ''
  return { ...ingredient, amount: suggestion.amount, unit: suggestion.unit, gramsEquivalent: suggestion.gramsEquivalent,
    notes: notes.split('\n').includes(suggestion.originalMeasure) ? notes : [notes, suggestion.originalMeasure].filter(Boolean).join('\n') }
}
