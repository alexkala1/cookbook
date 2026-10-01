import { ingredientKey, pantryQuantity, type PantryItem } from '#shared/culinary/pantry'
import type { MarketShoppingList } from './shopping-list'

export type CoveredItem = { id: string, name: string, amount: number, unit: string, have: string }

const round = (value: number) => Math.round(value * 1000) / 1000

/** Subtract in-date pantry stock from a shopping list. Never guesses across incompatible units; inputs are not mutated. */
export function applyPantryStock(list: MarketShoppingList, stock: readonly PantryItem[], now = Date.now()): { list: MarketShoppingList, covered: CoveredItem[] } {
  const pool = stock.filter(row => row.quantity > 0 && (row.expiresAt === null || row.expiresAt > now)).map(row => ({ ...row }))
  const covered: CoveredItem[] = []
  const destinations = list.destinations.map(destination => ({ ...destination, items: destination.items.flatMap(item => {
    const rows = pool.filter(row => row.quantity > 0 && ingredientKey(row.name) === ingredientKey(item.name))
    if (!(item.amount > 0)) {
      if (!rows.length) return [item]
      covered.push({ id: item.id, name: item.name, amount: item.amount, unit: item.unit, have: 'in stock' })
      return []
    }
    const usable = rows.flatMap(row => { const quantity = pantryQuantity(row.quantity, row.unit, item.unit); return quantity !== null && quantity > 0 ? [{ row, quantity }] : [] })
    const available = usable.reduce((sum, entry) => sum + entry.quantity, 0)
    if (!available) return [item]
    const used = Math.min(item.amount, available)
    let left = used
    for (const { row, quantity } of usable) {
      if (left <= 1e-8) break
      const take = Math.min(left, quantity)
      left -= take
      row.quantity = Math.max(0, row.quantity - (pantryQuantity(take, item.unit, row.unit) ?? 0))
    }
    if (item.amount - used <= 1e-8) {
      covered.push({ id: item.id, name: item.name, amount: item.amount, unit: item.unit, have: `${round(available)} ${item.unit}` })
      return []
    }
    // The counter phrase and package advice were written for the full amount, so they would now be wrong.
    const { counterPhrase: _phrase, packageSizeToBuy: _package, surplusLeftoverTip: _surplus, ...rest } = item
    return [{ ...rest, amount: round(item.amount - used), pantryNote: `Have ${round(used)} ${item.unit}` }]
  }) })).filter(destination => destination.items.length)
  return { list: { ...list, destinations }, covered }
}
