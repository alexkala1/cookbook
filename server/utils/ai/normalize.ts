import { load } from 'cheerio'
import { recipeCreateSchema, saltTypes, type RecipeInput } from '../validation'

const clean = (value: unknown): string => typeof value === 'string' ? load(value).text().trim() : ''
const quantityPattern = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)`
const quantity = (value: string) => value.split(/\s+/).reduce((sum, part) => {
  const [a, b] = part.split('/').map(Number)
  return sum + a! / (b ?? 1)
}, 0)
export function duration(value: unknown) {
  const match = typeof value === 'string' && value.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  return match ? Math.ceil(Number(match[1] || 0) * 1440 + Number(match[2] || 0) * 60 + Number(match[3] || 0) + Number(match[4] || 0) / 60) : 0
}
export function parseIngredient(line: string, servings = 4): NonNullable<RecipeInput['ingredients']>[number] {
  const text = clean(line).replace(/[½¼¾⅓⅔⅛]/g, value => ({ '½': ' 1/2', '¼': ' 1/4', '¾': ' 3/4', '⅓': ' 1/3', '⅔': ' 2/3', '⅛': ' 1/8' })[value]!).replace(/(\d),(?=\d)/g, '$1.').trim()
  const range = text.match(new RegExp(`^(${quantityPattern})\\s*[-–]\\s*(${quantityPattern})\\s+(.+)$`))
  if (range) return { ...parseIngredient(Math.min(quantity(range[1]!), quantity(range[2]!)) + ' ' + range[3], servings), notes: '[Inferred by AI] Source range: ' + range[1] + '–' + range[2] + '. Using the lower bound; adjust within the original range.' }
  const match = text.match(new RegExp(`^(${quantityPattern})\\s*(.*)$`))
  if (match) {
    const amount = quantity(match[1]!)
    const unitMatch = match[2]!.match(/^(kg|g|grams?|ml|l|liters?|tsp|teaspoons?|tbsp|tablespoons?|cups?|oz|ounces?|lb|pounds?|pinch(?:es)?|dash(?:es)?|cloves?|cans?|slices?|bunch(?:es)?|κ\.?\s*σ\.?|κ\.?\s*γ\.?|γρ\.?|γραμμ[άα]ρι[αο]|κιλ[άαόο]|λ[ίι]τρ[αο]|φλιτζ[άα]νι[α]?)(?=$|\s)\s*(.*)$/i)
    const rawUnit = unitMatch?.[1]?.normalize('NFD').replace(/\p{M}|[.\s]/gu, '').toLowerCase() || 'piece'
    const aliases: Record<string, string> = { grams: 'g', gram: 'g', liters: 'l', liter: 'l', teaspoons: 'tsp', teaspoon: 'tsp', tablespoons: 'tbsp', tablespoon: 'tbsp', cups: 'cup', ounces: 'oz', ounce: 'oz', pounds: 'lb', pound: 'lb', κσ: 'tbsp', κγ: 'tsp', γρ: 'g', γραμμαρια: 'g', γραμμαριο: 'g', κιλα: 'kg', κιλο: 'kg', λιτρο: 'l', λιτρα: 'l', φλιτζανι: 'cup', φλιτζανια: 'cup' }
    return { name: (unitMatch?.[2] || match[2] || 'ingredient').slice(0, 200), amount, unit: aliases[rawUnit] || rawUnit }
  }
  const salt = /salt|αλάτι|αλατι/i.test(text)
  const oil = /oil|λάδι/i.test(text)
  return { name: text.slice(0, 200) || 'Ingredient to identify', amount: salt ? servings * 0.25 : oil ? servings * 7.5 : 0, unit: salt ? 'tsp' : oil ? 'ml' : 'g', notes: '[Inferred by AI] ' + (salt ? 'Starting estimate: ¼ tsp per serving; adjust to taste and salt type.' : oil ? 'Starting estimate: 7.5 ml per serving.' : 'No reliable offline ratio. Quantity is unset (0); determine the measure before cooking.') }
}

export function extractJsonLd(html: string): RecipeInput | null {
  const $ = load(html)
  let found: Record<string, unknown> | undefined
  function visit(value: unknown, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 20 || found) return
    if (Array.isArray(value)) { value.forEach(item => visit(item, depth + 1)); return }
    const record = value as Record<string, unknown>
    if ([record['@type']].flat().some(type => type === 'Recipe' || type === 'https://schema.org/Recipe')) { found = record; return }
    Object.values(record).forEach(item => visit(item, depth + 1))
  }
  $('script[type="application/ld+json"]').each((_index, element) => { try { visit(JSON.parse($(element).text())) } catch { /* Try other metadata blocks. */ } })
  if (!found) return null
  const data = found as Record<string, unknown>
  const instructions: string[] = []
  function steps(value: unknown, depth = 0) {
    if (depth > 20 || instructions.length >= 500) return
    if (typeof value === 'string') { instructions.push(...clean(value).split(/\n+/).filter(Boolean)); return }
    if (Array.isArray(value)) { value.forEach(item => steps(item, depth + 1)); return }
    if (value && typeof value === 'object') { const item = value as Record<string, unknown>; if (item.itemListElement) steps(item.itemListElement, depth + 1); else steps(item.text || item.name, depth + 1) }
  }
  steps(data.recipeInstructions)
  const servings = Math.min(1000, Math.max(1, parseInt(String([data.recipeYield].flat()[0] || '4').match(/\d+/)?.[0] || '4')))
  const image = [data.image].flat()[0]
  const imageUrl = typeof image === 'string' ? image : image && typeof image === 'object' ? (image as Record<string, unknown>).url : undefined
  const category = [data.recipeCategory, data.name].flat().join(' ').toLowerCase()
  const input = {
    title: clean(data.name), description: clean(data.description), servings,
    originalSaltType: saltTypes.find(type => type === data.originalSaltType) ?? null,
    recipeType: /cocktail|martini|margarita|negroni/.test(category) ? 'cocktail' : /drink|beverage/.test(category) ? 'drink' : /dessert/.test(category) ? 'dessert' : /baking|bread|cake/.test(category) ? 'baking' : 'food',
    prepTimeMinutes: duration(data.prepTime), cookTimeMinutes: duration(data.cookTime),
    totalTimeMinutes: duration(data.totalTime) || duration(data.prepTime) + duration(data.cookTime),
    ...(typeof imageUrl === 'string' && /^https?:\/\//.test(imageUrl) ? { imageUrl } : {}),
    ingredients: Array.isArray(data.recipeIngredient) ? data.recipeIngredient.filter(item => typeof item === 'string').map(item => parseIngredient(item, servings)) : [],
    steps: instructions.map((instruction, index) => ({ stepNumber: index + 1, instruction })), equipment: []
  }
  const result = recipeCreateSchema.safeParse(input)
  return result.success ? result.data : null
}

export function extractHtml(html: string) {
  const $ = load(html)
  const title = $('h1').first().text() || $('title').text()
  $('script, style, nav, aside, footer, header, form, noscript').remove()
  return { title: title.trim().slice(0, 200), text: ($('main, article').first().text() || $('body').text()).replace(/\s+/g, ' ').trim().slice(0, 30000) }
}

export function fallbackRecipe(source: string, title?: string): RecipeInput {
  const text = (source + ' ' + (title || '')).toLowerCase()
  const chicken = /chicken|κοτόπουλ/i.test(text)
  const drink = /cocktail|martini|margarita|negroni/i.test(text)
  const dessert = /donut|doughnut|cake|caramel|creme|dessert|baking|sweet|pastry|cookie/i.test(text)
  const ingredients = chicken
    ? ['600 g chicken', '60 ml lemon juice', '30 ml olive oil', 'salt']
    : drink
      ? ['60 ml gin', '30 ml vermouth']
      : dessert
        ? ['300 g flour', '150 g sugar', '120 ml milk', '50 g butter', '2 eggs']
        : ['400 g vegetables', '30 ml olive oil', 'salt']
  return {
    title: title || (chicken ? 'Lemon chicken — memory draft' : drink ? 'Cocktail — starting draft' : dessert ? 'Dessert / Pastry — starting draft' : 'Vegetable skillet — starting draft'),
    description: 'Deterministic culinary starting point, not a reconstruction of the source. Review every ingredient and step before saving.',
    servings: drink ? 1 : 4,
    recipeType: drink ? 'cocktail' : dessert ? 'dessert' : 'food',
    originalSaltType: null,
    heirloomNotes: source.slice(0, 9000),
    prepTimeMinutes: dessert ? 25 : 15,
    cookTimeMinutes: drink ? 0 : dessert ? 20 : 30,
    totalTimeMinutes: drink ? 15 : 45,
    ingredients: ingredients.map(line => ({
      ...parseIngredient(line, drink ? 1 : 4),
      notes: '[Inferred by AI] Deterministic baseline, not a source measurement. ' + (drink ? '2:1 spirit to vermouth starting ratio.' : chicken ? '150 g chicken, 15 ml lemon and 7.5 ml oil per serving.' : dessert ? 'Standard baking ratio; adjust for filling and glaze.' : '100 g vegetables and 7.5 ml oil per serving.')
    })),
    steps: [{
      stepNumber: 1,
      instruction: drink
        ? 'Stir ingredients with ice until cold, then strain into a chilled glass.'
        : chicken
          ? 'Roast chicken with lemon and oil. Use a food thermometer and verify an appropriate safe internal temperature; timing depends on cut and size.'
          : dessert
            ? 'Prepare the dough and filling. Fry or bake until golden, fill with crème, and coat with caramel glaze before serving.'
            : 'Sauté vegetables in oil until tender. Season gradually and taste.',
      failurePrevention: 'This is a suggested method. Confirm quantities and cooking requirements before use.'
    }],
    equipment: [{ name: drink ? 'Mixing glass' : chicken ? 'Roasting dish and food thermometer' : dessert ? 'Mixing bowl, frying pan or oven' : 'Skillet' }]
  }
}
