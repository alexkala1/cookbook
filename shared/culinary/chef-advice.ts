import { ingredientKey, type MatchIngredient, type PantryItem, type PantryMatch } from './pantry'

export interface SwapOption { name: string, ratio: string, adjustment: string }
export interface ChefAdvice {
  ready: { id: string, title: string, note: string }[]
  swaps: { recipeId: string, title: string, missing: string, options: SwapOption[], stillNeeded: string[] }[]
  useItUp: { itemId: string, item: string, daysLeft: number, tip: string, recipeIds: string[] }[]
}
export type SwapLookup = (ingredient: string) => SwapOption[]

const DAY = 86400000
const SOON_DAYS = 3
const storageTip = { fridge: 'Cook it tonight, or freeze it in portions.', freezer: 'Thaw it in the fridge and make it the centrepiece.', pantry: 'Build a simple meal around it before it turns.' } as const

/** Deterministic, offline advice: ready matches, swaps for near-matches, and use-it-up tips for stock nearing its date. */
export function chefAdvice(matches: PantryMatch[], stock: PantryItem[], swapsFor: SwapLookup, now = Date.now()): ChefAdvice {
  const ready = matches.filter(match => match.completeness === 100 && !match.missing.length).slice(0, 5)
    .map(match => ({ id: match.id, title: match.title, note: 'Everything is in your pantry. Start whenever you’re ready.' }))

  const swaps: ChefAdvice['swaps'] = []
  for (const match of matches) {
    if (swaps.length === 5) break
    if (!match.missing.length || match.missing.length > 2 || match.in_stock.length < match.missing.length) continue
    const swappable = match.missing.find(item => item.reason.startsWith('Not in stock') && swapsFor(item.name).length)
    if (!swappable) continue
    swaps.push({
      recipeId: match.id, title: match.title, missing: swappable.name, options: swapsFor(swappable.name),
      stillNeeded: match.missing.filter(item => item !== swappable).map(item => item.name)
    })
  }

  const useItUp = stock
    .filter(item => item.quantity > 0 && item.expiresAt !== null && item.expiresAt > now && item.expiresAt - now <= SOON_DAYS * DAY)
    .sort((a, b) => a.expiresAt! - b.expiresAt!)
    .slice(0, 8)
    .map(item => {
      const daysLeft = Math.max(0, Math.ceil((item.expiresAt! - now) / DAY))
      const uses = matches.filter(match => [...match.in_stock, ...match.missing].some((line: MatchIngredient) => ingredientKey(line.name) === ingredientKey(item.name))).slice(0, 2)
      const when = daysLeft <= 1 ? 'by tomorrow' : `within ${daysLeft} days`
      const tip = uses.length
        ? `Use your ${item.name} ${when}: ${uses.map(use => `${use.title} (${use.completeness}% ready)`).join(' or ')}.`
        : `Your ${item.name} is best used ${when}. ${storageTip[item.storageLocation]}`
      return { itemId: item.id, item: item.name, daysLeft, tip, recipeIds: uses.map(use => use.id) }
    })
  return { ready, swaps, useItUp }
}
