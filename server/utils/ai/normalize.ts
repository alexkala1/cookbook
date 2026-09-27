import { load } from 'cheerio'
import { recipeCreateSchema, saltTypes, type RecipeInput } from '../validation'
import { parseIngredientLine, type IngredientDraft } from '../../../shared/culinary/ingredient-line'
import { parseStructuredRecipe, stripPromotional } from '../../../shared/culinary/structured-recipe'

const clean = (value: unknown): string => typeof value === 'string' ? load(value).text().trim() : ''
export function parseIngredient(line: string, servings = 4): IngredientDraft {
  return parseIngredientLine(clean(line), servings)
}

export function duration(value: unknown) {
  const match = typeof value === 'string' && value.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  return match ? Math.ceil(Number(match[1] || 0) * 1440 + Number(match[2] || 0) * 60 + Number(match[3] || 0) + Number(match[4] || 0) / 60) : 0
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

const isDrink = (text: string) => /cocktail|martini|margarita|negroni/i.test(text)
const isDessert = (text: string) => /\b(?:donut|doughnut|cake|caramel|creme|dessert|baking|pastry|cookie|tart|pie)\b/i.test(text)

/** Offline draft from source text that already has its own ingredients and method sections. */
export function structuredDraft(source: string, title?: string): RecipeInput | null {
  const parsed = parseStructuredRecipe(source)
  if (!parsed) return null
  const text = (source + ' ' + (title || '')).toLowerCase()
  const prepTimeMinutes = 15
  const cookTimeMinutes = Math.min(100000, parsed.cookTimeMinutes || 30)
  return {
    title: (title || parsed.description?.split(/[.!?]/)[0] || 'Imported recipe').trim().slice(0, 200),
    description: parsed.description ?? 'Parsed from the source’s own ingredient and method sections without AI. Review before cooking.',
    servings: parsed.servings ?? 4,
    recipeType: isDrink(text) ? 'cocktail' : isDessert(text) ? 'dessert' : 'food',
    originalSaltType: null,
    heirloomNotes: parsed.notes,
    prepTimeMinutes,
    cookTimeMinutes,
    totalTimeMinutes: Math.min(100000, prepTimeMinutes + cookTimeMinutes),
    ingredients: parsed.ingredients,
    steps: parsed.steps,
    equipment: []
  }
}

export function fallbackRecipe(source: string, title?: string): RecipeInput {
  const text = (source + ' ' + (title || '')).toLowerCase()
  const chicken = /chicken|κοτόπουλ/i.test(text)
  const meat = /beef|short rib|ribs|lamb|pork|steak|stew|braise|boulud|bourguignon|μοσχαρ|αρνι|χοιριν/i.test(text)
  const drink = isDrink(text)
  const dessert = isDessert(text)
  const ingredients = chicken
    ? ['600 g chicken', '60 ml lemon juice', '30 ml olive oil', 'salt']
    : meat
      ? ['800 g beef short ribs', '250 ml red wine', '2 carrots', '1 onion', '30 ml olive oil', 'salt']
      : drink
        ? ['60 ml gin', '30 ml vermouth']
        : dessert
          ? ['300 g flour', '150 g sugar', '120 ml milk', '50 g butter', '2 eggs']
          : ['400 g vegetables', '30 ml olive oil', 'salt']
  return {
    title: title || (chicken ? 'Lemon chicken — memory draft' : meat ? 'Braised beef — starting draft' : drink ? 'Cocktail — starting draft' : dessert ? 'Dessert / Pastry — starting draft' : 'Vegetable skillet — starting draft'),
    description: 'Deterministic culinary starting point, not a reconstruction of the source. Review every ingredient and step before saving.',
    servings: drink ? 1 : 4,
    recipeType: drink ? 'cocktail' : dessert ? 'dessert' : 'food',
    originalSaltType: null,
    heirloomNotes: stripPromotional(source).slice(0, 9000),
    prepTimeMinutes: meat ? 20 : dessert ? 25 : 15,
    cookTimeMinutes: drink ? 0 : meat ? 120 : dessert ? 20 : 30,
    totalTimeMinutes: drink ? 15 : meat ? 140 : 45,
    ingredients: ingredients.map(line => ({
      ...parseIngredient(line, drink ? 1 : 4),
      notes: '[Inferred by AI] Deterministic baseline, not a source measurement. ' + (drink ? '2:1 spirit to vermouth starting ratio.' : chicken ? '150 g chicken, 15 ml lemon and 7.5 ml oil per serving.' : meat ? '200 g meat, 60 ml wine and vegetables per serving.' : dessert ? 'Standard baking ratio; adjust for filling and glaze.' : '100 g vegetables and 7.5 ml oil per serving.')
    })),
    steps: [{
      stepNumber: 1,
      instruction: drink
        ? 'Stir ingredients with ice until cold, then strain into a chilled glass.'
        : chicken
          ? 'Roast chicken with lemon and oil. Use a food thermometer and verify an appropriate safe internal temperature; timing depends on cut and size.'
          : meat
            ? 'Season and sear the beef short ribs in oil until deeply browned. Add aromatics, pour in red wine and broth, cover tightly and braise slowly at low heat until meltingly tender.'
            : dessert
              ? 'Prepare the dough and filling. Fry or bake until golden, fill with crème, and coat with caramel glaze before serving.'
              : 'Sauté vegetables in oil until tender. Season gradually and taste.',
      failurePrevention: 'This is a suggested method. Confirm quantities and cooking requirements before use.'
    }],
    equipment: [{ name: drink ? 'Mixing glass' : chicken ? 'Roasting dish and food thermometer' : meat ? 'Heavy Dutch oven or roasting gastra' : dessert ? 'Mixing bowl, frying pan or oven' : 'Skillet' }]
  }
}
