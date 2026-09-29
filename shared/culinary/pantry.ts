export const storageLocations = ['pantry', 'fridge', 'freezer'] as const
export type StorageLocation = typeof storageLocations[number]
export interface PantryDraft { name: string, quantity: number, unit: string, storageLocation: StorageLocation, expiresAt?: number | null }
export interface PantryItem extends PantryDraft { id: string, normalizedName: string, expiresAt: number | null, createdAt: number, updatedAt: number }
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
export interface MatchIngredient { name: string, amount: number, unit: string }
export interface MatchRecipe { id: string, title: string, ingredients: MatchIngredient[] }
export interface PantryMatch { id: string, title: string, completeness: number, in_stock: MatchIngredient[], missing: (MatchIngredient & { reason: string })[] }
export function matchPantry(recipes: MatchRecipe[], stock: PantryItem[], now = Date.now()): PantryMatch[] {
  return recipes.map(recipe => {
    const available = stock.filter(item => item.quantity > 0 && (item.expiresAt === null || item.expiresAt > now)).map(item => ({ ...item }))
    const in_stock: MatchIngredient[] = [], missing: PantryMatch['missing'] = []
    for (const ingredient of recipe.ingredients) {
      const candidates = available.filter(item => ingredientKey(item.name) === ingredientKey(ingredient.name))
      let required = ingredient.amount, compatible = false
      for (const item of candidates) {
        const converted = pantryQuantity(item.quantity, item.unit, ingredient.unit)
        if (converted === null) continue
        compatible = true
        const used = Math.min(required, converted)
        required -= used
        item.quantity -= pantryQuantity(used, ingredient.unit, item.unit) ?? 0
      }
      if ((ingredient.amount > 0 && required <= 1e-8) || (ingredient.amount === 0 && candidates.some(item => item.quantity > 0))) in_stock.push(ingredient)
      else missing.push({ ...ingredient, reason: !candidates.length ? 'Not in stock (or expired)' : !compatible ? 'Check quantity: units differ' : 'Insufficient quantity' })
    }
    return { id: recipe.id, title: recipe.title, completeness: recipe.ingredients.length ? Math.round(in_stock.length / recipe.ingredients.length * 100) : 0, in_stock, missing }
  }).sort((a, b) => b.completeness - a.completeness || a.title.localeCompare(b.title))
}
export function inferStorage(name: string, section?: string): StorageLocation {
  if (section === 'chasapis') return 'fridge'
  const words = normalizePantryName(name).split(' ')
  if (words.some(word => ['frozen', 'κατεψυγμενο', 'κατεψυγμενα'].includes(word)) || /ice cream/i.test(name)) return 'freezer'
  if (words.some(word => ['milk', 'yogurt', 'yoghurt', 'cheese', 'butter', 'chicken', 'beef', 'fish', 'salmon', 'γαλα', 'τυρι', 'γιαουρτι', 'κοτοπουλο', 'βουτυρο'].includes(word))) return 'fridge'
  return 'pantry'
}
/** OCR text is untrusted. Prices never become quantities; storage suggestions need review. */
export function parseReceipt(text: string): PantryDraft[] {
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
    result.push({ name: line, quantity, unit, storageLocation: inferStorage(line), expiresAt: null })
    if (result.length === 100) break
  }
  return result
}
