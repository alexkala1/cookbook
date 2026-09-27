import type { GroceryItem, MarketSection, PrepAlert } from '../../shared/culinary/grocery'

export type MarketShoppingList = {
  listId: string
  title: string
  prepAlerts: PrepAlert[]
  destinations: {
    section: MarketSection
    name: string
    localizedName: string
    items: (GroceryItem & { id: string })[]
  }[]
}

export function shoppingListText(list: MarketShoppingList, checked: readonly string[] = []) {
  const lines = [list.title]
  if (list.prepAlerts.length) {
    lines.push('', 'Prepare ahead')
    for (const alert of list.prepAlerts) lines.push(`- ${alert.recipeTitle}: ${alert.text}`)
  }
  for (const destination of list.destinations) {
    lines.push('', `${destination.name} · ${destination.localizedName}`)
    for (const item of destination.items) {
      lines.push(`[${checked.includes(item.id) ? 'x' : ' '}] ${item.amount} ${item.unit} ${item.name}`)
      if (item.counterPhrase) lines.push(`  At the counter: ${item.counterPhrase}`)
      if (item.packageSizeToBuy) lines.push(`  Buy: ${item.packageSizeToBuy}`)
      if (item.surplusLeftoverTip) lines.push(`  Surplus: ${item.surplusLeftoverTip}`)
      if (item.note) lines.push(`  Note: ${item.note}`)
      for (const note of item.prepNotes) lines.push(`  Prep: ${note}`)
    }
  }
  return lines.join('\n')
}
