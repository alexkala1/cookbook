import type { RecipeInput } from '../../server/utils/validation'

export type IngredientDraft = NonNullable<RecipeInput['ingredients']>[number]

/** Parse one plain-text ingredient line ("1 1/2 cups flour", "2 κ.σ. ζάχαρη"). No HTML handling here. */
const quantityPattern = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)`
const quantity = (value: string) => value.split(/\s+/).reduce((sum, part) => {
  const [a, b] = part.split('/').map(Number)
  return sum + a! / (b ?? 1)
}, 0)
export function parseIngredientLine(line: string, servings = 4): IngredientDraft {
  const metric = line.match(/\(\s*(?:[\d.,]+\s*oz\s*\/\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g)\s*\)/i)
  if (metric) {
    const originalMeasure = line.slice(0, metric.index).trim()
    if (originalMeasure.includes('+')) {
      // The source's exact metric total is safer than treating "+ 2 tsp" as part of the ingredient name.
      const grams = Number(metric[1]!.replace(',', '.')) * (metric[2]!.toLowerCase() === 'kg' ? 1000 : 1)
      const name = line.slice(metric.index! + metric[0].length).trim().replace(/^,\s*/, '')
      return { name: name.slice(0, 200) || 'Ingredient to identify', amount: grams, unit: 'g', gramsEquivalent: grams, notes: `Source measure: ${originalMeasure}.` }
    }
    const parsed = parseIngredientLine(line.replace(metric[0], '').replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim(), servings)
    return { ...parsed, gramsEquivalent: Number(metric[1]!.replace(',', '.')) * (metric[2]!.toLowerCase() === 'kg' ? 1000 : 1) }
  }
  const volume = line.match(/\(\s*(\d+(?:[.,]\d+)?)\s*(ml|l)\s*\)/i)
  if (volume) {
    const parsed = parseIngredientLine(line.replace(volume[0], '').replace(/\s+/g, ' ').trim(), servings)
    const ml = Number(volume[1]!.replace(',', '.')) * (volume[2]!.toLowerCase() === 'l' ? 1000 : 1)
    return { ...parsed, notes: [parsed.notes, `Source volume: ${ml} ml for ${parsed.amount} ${parsed.unit}.`].filter(Boolean).join(' · ') }
  }
  const text = line.replace(/[½¼¾⅓⅔⅛]/g, value => ({ '½': ' 1/2', '¼': ' 1/4', '¾': ' 3/4', '⅓': ' 1/3', '⅔': ' 2/3', '⅛': ' 1/8' })[value]!).replace(/(\d),(?=\d)/g, '$1.').trim()
  const range = text.match(new RegExp(`^(${quantityPattern})\\s*[-–]\\s*(${quantityPattern})\\s+(.+)$`))
  if (range) return { ...parseIngredientLine(Math.min(quantity(range[1]!), quantity(range[2]!)) + ' ' + range[3], servings), notes: '[Inferred by AI] Source range: ' + range[1] + '–' + range[2] + '. Using the lower bound; adjust within the original range.' }
  const match = text.match(new RegExp(`^(${quantityPattern})\\s*(.*)$`))
  if (match) {
    const amount = quantity(match[1]!)
    const unitMatch = match[2]!.match(/^(kg|g|grams?|ml|l|liters?|tsp|teaspoons?|tbsp|tablespoons?|cups?|oz|ounces?|lbs?|pounds?|pinch(?:es)?|dash(?:es)?|cloves?|cans?|slices?|bunch(?:es)?|bottles?|sprigs?|stalks?|sticks?|heads?|handfuls?|knobs?|κ\.?\s*σ\.?|κ\.?\s*γ\.?|γρ\.?|γραμμ[άα]ρι[αο]|κιλ[άαόο]|λ[ίι]τρ[αο]|φλιτζ[άα]νι[α]?)(?=$|\s)\s*(.*)$/i)
    const rawUnit = unitMatch?.[1]?.normalize('NFD').replace(/\p{M}|[.\s]/gu, '').toLowerCase() || 'piece'
    const aliases: Record<string, string> = { grams: 'g', gram: 'g', liters: 'l', liter: 'l', teaspoons: 'tsp', teaspoon: 'tsp', tablespoons: 'tbsp', tablespoon: 'tbsp', cups: 'cup', ounces: 'oz', ounce: 'oz', pounds: 'lb', pound: 'lb', bottles: 'bottle', sprigs: 'sprig', stalks: 'stalk', sticks: 'stick', heads: 'head', handfuls: 'handful', knobs: 'knob', κσ: 'tbsp', κγ: 'tsp', γρ: 'g', γραμμαρια: 'g', γραμμαριο: 'g', κιλα: 'kg', κιλο: 'kg', λιτρο: 'l', λιτρα: 'l', φλιτζανι: 'cup', φλιτζανια: 'cup' }
    return { name: (unitMatch?.[2] || match[2] || 'ingredient').slice(0, 200), amount, unit: rawUnit === 'lbs' ? 'lb' : aliases[rawUnit] || rawUnit }
  }
  const salt = /salt|αλάτι|αλατι/i.test(text)
  const oil = /oil|λάδι/i.test(text)
  return { name: text.slice(0, 200) || 'Ingredient to identify', amount: salt ? servings * 0.25 : oil ? servings * 7.5 : 0, unit: salt ? 'tsp' : oil ? 'ml' : 'g', notes: '[Inferred by AI] ' + (salt ? 'Starting estimate: ¼ tsp per serving; adjust to taste and salt type.' : oil ? 'Starting estimate: 7.5 ml per serving.' : 'No reliable offline ratio. Quantity is unset (0); determine the measure before cooking.') }
}
