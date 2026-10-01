export const storageLocations = ['pantry', 'fridge', 'freezer', 'spices'] as const
export type StorageLocation = typeof storageLocations[number]
export interface PantryDraft { name: string, quantity: number, unit: string, storageLocation: StorageLocation, expiresAt?: number | null }
export interface PantryItem extends PantryDraft { id: string, normalizedName: string, expiresAt: number | null, createdAt: number, updatedAt: number }
export const PANTRY_STAPLES: readonly PantryDraft[] = [
  { name: 'Olive oil', quantity: 1, unit: 'l', storageLocation: 'pantry' },
  { name: 'Onions', quantity: 1, unit: 'kg', storageLocation: 'pantry' },
  { name: 'Garlic', quantity: 1, unit: 'item', storageLocation: 'pantry' },
  { name: 'Tomatoes', quantity: 1, unit: 'kg', storageLocation: 'fridge' },
  { name: 'Oregano', quantity: 50, unit: 'g', storageLocation: 'spices' },
  { name: 'Lemons', quantity: 4, unit: 'item', storageLocation: 'fridge' },
  { name: 'Feta', quantity: 200, unit: 'g', storageLocation: 'fridge' },
  { name: 'Eggs', quantity: 6, unit: 'item', storageLocation: 'fridge' }
] as const
export function pantryStepForUnit(unit: string): number {
  const normalized = unit.trim().toLowerCase()
  return (normalized === 'g' || normalized === 'ml') ? 50 : 1
}
export function normalizePantryName(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('el-GR').replace(/ς/g, 'σ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}
const aliases: Record<string, string> = { eggs: 'egg', tomatoes: 'tomato', onions: 'onion', potatoes: 'potato', lemons: 'lemon', carrots: 'carrot' }
export function ingredientKey(name: string) { const key = normalizePantryName(name); return Object.hasOwn(aliases, key) ? aliases[key]! : key }
const measures: Record<string, [string, number]> = {
  item: ['count', 1], items: ['count', 1], piece: ['count', 1], pieces: ['count', 1],
  g: ['mass', 1], kg: ['mass', 1000], oz: ['mass', 28.349523125], lb: ['mass', 453.59237],
  ml: ['volume', 1], l: ['volume', 1000], tsp: ['volume', 4.92892159375], tbsp: ['volume', 14.78676478125], cup: ['volume', 236.5882365]
}
export function pantryQuantity(amount: number, from: string, to: string): number | null {
  from = from.trim().toLowerCase(); to = to.trim().toLowerCase()
  if (from === to) return amount
  const a = Object.hasOwn(measures, from) ? measures[from] : undefined, b = Object.hasOwn(measures, to) ? measures[to] : undefined
  return a && b && a[0] === b[0] ? amount * a[1] / b[1] : null
}
/** Replenishment thresholds in base units, including empty stock. */
export function isLowStock(item: PantryItem): boolean {
  if (item.quantity <= 0) return true
  const unit = item.unit.trim().toLowerCase()
  const measure = Object.hasOwn(measures, unit) ? measures[unit] : undefined
  return measure ? item.quantity * measure[1] <= (measure[0] === 'count' ? 1 : 100) : item.quantity <= 1
}

const spiceWords = ['oregano', 'thyme', 'cumin', 'cinnamon', 'paprika', 'pepper', 'peppercorn', 'peppercorns', 'salt', 'rosemary', 'basil', 'turmeric', 'nutmeg', 'clove', 'cloves', 'cardamom', 'coriander', 'ριγανη', 'θυμαρι', 'κυμινο', 'κμινο', 'κανελα', 'παπρικα', 'πιπερι', 'αλατι', 'δεντρολιβανο', 'βασιλικοσ', 'κουρκουμασ', 'μοσχοκαρυδο', 'γαρυφαλλο', 'καρδαμο']
const freshWords = ['fresh', 'φρεσκο', 'φρεσκια', 'φρεσκα', 'φρεσκοσ']
const herbWords = ['parsley', 'mint', 'dill', 'sage', 'μαιντανοσ', 'δυοσμοσ', 'ανηθοσ', 'φασκομηλο']
function hasWords(name: string, words: string[]): boolean {
  return name.split(' ').some(word => words.includes(word))
}
function isSeasoning(name: string): boolean {
  if (hasWords(name, freshWords) || hasWords(name, ['garlic', 'σκορδο']) || (/(?:bell|sweet|red|green|yellow) peppers?\b/.test(name) && !hasWords(name, ['flakes', 'ground', 'powder']))) return false
  return hasWords(name, spiceWords) || /(?:dried herbs?|dry herbs?|αποξηραμενα βοτανα)/.test(name) || (hasWords(name, ['dried', 'dry', 'αποξηραμενο', 'αποξηραμενα', 'αποξηραμενη', 'αποξηραμενοσ']) && hasWords(name, herbWords))
}

/** Approximate planning defaults, in days; package dates take precedence. */
export function estimateShelfLifeDays(name: string, location: StorageLocation): number {
  const key = normalizePantryName(name)
  const has = (words: string[]) => hasWords(key, words)
  const meat = has(['chicken', 'poultry', 'turkey', 'beef', 'pork', 'lamb', 'meat', 'fish', 'salmon', 'tuna', 'cod', 'shrimp', 'κοτοπουλο', 'γαλοπουλα', 'μοσχαρι', 'μοσχαρισιο', 'χοιρινο', 'αρνι', 'κρεασ', 'ψαρι', 'σολομοσ'])
  const bread = has(['bread', 'loaf', 'baguette', 'sourdough', 'ψωμι'])
  if (location === 'spices') return has(['whole', 'peppercorn', 'peppercorns', 'ολοκληρο', 'ολοκληρα']) || /cinnamon sticks?|ξυλα κανελασ/.test(key) ? 730 : 365
  if (location === 'freezer') return meat ? 180 : bread ? 90 : 240
  if (location === 'fridge') {
    if (has(['egg', 'eggs', 'αυγο', 'αυγα', 'αβγο', 'αβγα'])) return 28
    if (meat) return has(['chicken', 'poultry', 'turkey', 'fish', 'salmon', 'κοτοπουλο', 'γαλοπουλα', 'ψαρι', 'σολομοσ']) ? 2 : 3
    if (has(['parmesan', 'pecorino', 'cheddar', 'gruyere', 'graviera', 'κεφαλοτυρι', 'γραβιερα', 'παρμεζανα']) || /hard cheese|σκληρο τυρι/.test(key)) return 25
    if (has(['milk', 'yogurt', 'yoghurt', 'cream', 'feta', 'ricotta', 'mozzarella', 'cheese', 'butter', 'γαλα', 'γιαουρτι', 'κρεμα', 'φετα', 'τυρι', 'βουτυρο'])) return 7
    if (has(['lemon', 'lemons', 'carrot', 'carrots', 'beet', 'beets', 'radish', 'radishes', 'λεμονι', 'λεμονια', 'καροτο', 'καροτα', 'παντζαρι', 'παντζαρια'])) return 21
    if (has(['root', 'roots', 'onion', 'onions', 'potato', 'potatoes', 'garlic', 'κρεμμυδι', 'κρεμμυδια', 'πατατα', 'πατατεσ', 'σκορδο'])) return 14
    if (has(['spinach', 'lettuce', 'kale', 'arugula', 'rocket', 'chard', 'herbs', 'σπανακι', 'μαρουλι', 'ροκα']) || /leafy greens|fresh herbs/.test(key)) return 5
    return 7
  }
  if (bread) return 5
  if (has(['onion', 'onions', 'potato', 'potatoes', 'κρεμμυδι', 'κρεμμυδια', 'πατατα', 'πατατεσ'])) return 30
  if (has(['garlic', 'σκορδο'])) return 60
  return 365
}
export interface MatchIngredient { name: string, amount: number, unit: string }
export interface MatchRecipe { id: string, title: string, ingredients: MatchIngredient[] }
export interface PantryMatch { id: string, title: string, completeness: number, in_stock: (MatchIngredient & { lowStock: boolean })[], missing: (MatchIngredient & { reason: string })[] }
export function matchPantry(recipes: MatchRecipe[], stock: PantryItem[], now = Date.now()): PantryMatch[] {
  return recipes.map(recipe => {
    const available = stock.filter(item => item.quantity > 0 && (item.expiresAt === null || item.expiresAt > now)).map(item => ({ ...item }))
    const in_stock: PantryMatch['in_stock'] = [], missing: PantryMatch['missing'] = []
    for (const ingredient of recipe.ingredients) {
      const candidates = available.filter(item => ingredientKey(item.name) === ingredientKey(ingredient.name))
      const compatibleStock = candidates.filter(item => item.quantity > 0 && (ingredient.amount === 0 || pantryQuantity(item.quantity, item.unit, ingredient.unit) !== null))
      const first = compatibleStock[0]
      const lowStock = first ? isLowStock({ ...first, quantity: compatibleStock.reduce((sum, item) => sum + (pantryQuantity(item.quantity, item.unit, first.unit) ?? 0), 0) }) : false
      let required = ingredient.amount, compatible = false
      for (const item of candidates) {
        const converted = pantryQuantity(item.quantity, item.unit, ingredient.unit)
        if (converted === null) continue
        compatible = true
        const used = Math.min(required, converted)
        required -= used
        item.quantity -= pantryQuantity(used, ingredient.unit, item.unit) ?? 0
      }
      if ((ingredient.amount > 0 && required <= 1e-8) || (ingredient.amount === 0 && candidates.some(item => item.quantity > 0))) in_stock.push({ ...ingredient, lowStock })
      else missing.push({ ...ingredient, reason: !candidates.length ? 'Not in stock (or expired)' : !compatible ? 'Check quantity: units differ' : 'Insufficient quantity' })
    }
    return { id: recipe.id, title: recipe.title, completeness: recipe.ingredients.length ? Math.round(in_stock.length / recipe.ingredients.length * 100) : 0, in_stock, missing }
  }).sort((a, b) => b.completeness - a.completeness || a.title.localeCompare(b.title))
}
export function inferStorage(name: string, section?: string): StorageLocation {
  if (section === 'chasapis') return 'fridge'
  const key = normalizePantryName(name), words = key.split(' ')
  if (words.some(word => ['frozen', 'κατεψυγμενο', 'κατεψυγμενα'].includes(word)) || /ice cream/i.test(name)) return 'freezer'
  if (isSeasoning(key)) return 'spices'
  if ((hasWords(key, freshWords) && hasWords(key, spiceWords)) || hasWords(key, herbWords)) return 'fridge'
  if (hasWords(key, ['parmesan', 'pecorino', 'cheddar', 'gruyere', 'graviera', 'ricotta', 'mozzarella', 'κεφαλοτυρι', 'γραβιερα', 'παρμεζανα'])) return 'fridge'
  if (words.some(word => ['milk', 'yogurt', 'yoghurt', 'cheese', 'feta', 'cream', 'butter', 'chicken', 'beef', 'pork', 'turkey', 'lamb', 'fish', 'salmon', 'eggs', 'egg', 'spinach', 'lettuce', 'kale', 'arugula', 'lemons', 'lemon', 'carrots', 'carrot', 'γαλα', 'τυρι', 'φετα', 'γιαουρτι', 'κοτοπουλο', 'βουτυρο', 'αυγα', 'αυγο', 'μαρουλι', 'σπανακι', 'λεμονι', 'λεμονια', 'καροτο', 'καροτα', 'κρεασ', 'ψαρι', 'χοιρινο', 'αρνι'].includes(word))) return 'fridge'
  return 'pantry'
}
/** OCR text is untrusted. Prices never become quantities; storage suggestions need review. */
export function parseReceipt(text: string, now = Date.now()): PantryDraft[] {
  const result: PantryDraft[] = []
  for (const raw of text.split(/\r?\n/).slice(0, 500)) {
    let line = raw.trim()
    if (!line || /^(?:total|subtotal|tax|vat|cash|change|card|visa|receipt|date|thank|συνολο|φπα|μετρητα|ρεστα|αποδειξη)(?:\s|:|$)/i.test(normalizePantryName(line)) || /^\d+[/.:-]\d+/.test(line)) continue
    line = line.replace(/\s+(?:[€$£]\s*)?\d+[.,]\d{2}\s*(?:[€$£]|[A-Z])?\s*$/, '').trim()
    let quantity = 1, unit = 'item'
    const count = line.match(/^(\d+)\s*[x×]\s*/i)
    if (count) { quantity = Number(count[1]); line = line.slice(count[0].length) }
    const weight = line.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i)
    if (weight) { quantity *= Number(weight[1]!.replace(',', '.')); unit = weight[2]!.toLowerCase(); line = line.replace(weight[0], ' ').trim() }
    line = line.replace(/\s+/g, ' ')
    if (!/\p{L}/u.test(line) || line.length > 200 || quantity <= 0 || quantity > 1000000) continue
    const storageLocation = inferStorage(line)
    result.push({ name: line, quantity, unit, storageLocation, expiresAt: now + estimateShelfLifeDays(line, storageLocation) * 86400000 })
    if (result.length === 100) break
  }
  return result
}
