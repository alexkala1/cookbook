export const saltDensities = {
  diamond_crystal_kosher: 2.8,
  morton_kosher: 4.8,
  table_salt: 5.9,
  greek_sea_salt: 5.5
} as const
export type SaltType = keyof typeof saltDensities
export const saltLabels: Record<SaltType, string> = {
  diamond_crystal_kosher: 'Diamond Crystal Kosher',
  morton_kosher: 'Morton Kosher',
  table_salt: 'Fine Table Salt',
  greek_sea_salt: 'Greek Sea Salt'
}

// US customary volumes; grams and millilitres are the base units.
const units: Record<string, { dimension: 'mass' | 'volume' | 'count', factor: number }> = {
  g: { dimension: 'mass', factor: 1 }, kg: { dimension: 'mass', factor: 1000 },
  oz: { dimension: 'mass', factor: 28.349523125 }, lb: { dimension: 'mass', factor: 453.59237 },
  ml: { dimension: 'volume', factor: 1 }, l: { dimension: 'volume', factor: 1000 },
  tsp: { dimension: 'volume', factor: 4.92892159375 }, tbsp: { dimension: 'volume', factor: 14.78676478125 },
  cup: { dimension: 'volume', factor: 236.5882365 }, 'fl oz': { dimension: 'volume', factor: 29.5735295625 },
  piece: { dimension: 'count', factor: 1 }
}
function assertAmount(amount: number) {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Amount must be finite and nonnegative')
}
function getUnit(unit: string) {
  const key = unit.trim().toLowerCase()
  const result = Object.hasOwn(units, key) ? units[key] : undefined
  if (!result) throw new RangeError('Unsupported unit: ' + unit)
  return result
}
export function convertUnit(amount: number, fromUnit: string, toUnit: string): number {
  assertAmount(amount)
  const from = getUnit(fromUnit), to = getUnit(toUnit)
  if (from.dimension !== to.dimension) throw new RangeError('Cannot convert between mass, volume, and count without an ingredient density')
  return amount * from.factor / to.factor
}
export function convertSalt(amount: number, fromType: SaltType, toType: SaltType, unit: string): number {
  assertAmount(amount)
  if (!Object.hasOwn(saltDensities, fromType) || !Object.hasOwn(saltDensities, toType)) throw new RangeError('Unknown salt type')
  const measurement = getUnit(unit)
  if (measurement.dimension === 'count') throw new RangeError('Salt requires a mass or volume unit')
  return measurement.dimension === 'mass' ? amount : amount * saltDensities[fromType] / saltDensities[toType]
}
export function scaleIngredients<T extends { amount: number, gramsEquivalent?: number | null }>(ingredients: T[], targetServings: number, originalServings: number): T[] {
  if (![targetServings, originalServings].every(value => Number.isFinite(value) && value > 0)) throw new RangeError('Servings must be finite and positive')
  return ingredients.map(ingredient => {
    assertAmount(ingredient.amount)
    const ratio = targetServings / originalServings
    return { ...ingredient, amount: ingredient.amount * ratio, ...(ingredient.gramsEquivalent != null ? { gramsEquivalent: ingredient.gramsEquivalent * ratio } : {}) }
  })
}
