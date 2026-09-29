import { marketSections, sectionInfo, type GroceryItem, type MarketSection, type PrepAlert } from '#shared/culinary/grocery'

export type ShoppingMode = 'market' | 'supermarket'

export type MarketShoppingList = {
  listId: string
  title: string
  prepAlerts: PrepAlert[]
  destinations: {
    section: MarketSection
    name: string
    localizedName: string
    items: (GroceryItem & { id: string; aisle?: string })[]
  }[]
}

export function routeShoppingList(list: MarketShoppingList, overrides: Readonly<Record<string, MarketSection>> = {}, mode: ShoppingMode = 'market', order: readonly MarketSection[] = marketSections): MarketShoppingList {
  const aisles: Record<MarketSection, string> = { laiki: 'Produce', chasapis: 'Meat counter', fournos: 'Bakery', supermarket: 'Dairy, pantry & other' }
  const items = list.destinations.flatMap(destination => destination.items.map(item => ({ ...item, source: destination.section })))
  if (mode === 'supermarket') items.sort((a, b) => marketSections.indexOf(a.source) - marketSections.indexOf(b.source))
  return { ...list, destinations: order.map(section => ({
    section, name: sectionInfo[section].name, localizedName: sectionInfo[section].localizedName,
    items: items.filter(item => (mode === 'supermarket' ? 'supermarket' : overrides[item.id] ?? item.source) === section)
      .map(({ source, ...item }) => ({ ...item, section, aisle: mode === 'supermarket' ? aisles[source] : undefined }))
  })).filter(destination => destination.items.length) }
}

export function shoppingListText(list: MarketShoppingList, checked: readonly string[] = []) {
  const lines = [list.title]
  if (list.prepAlerts.length) {
    lines.push('', 'Prepare ahead')
    for (const alert of list.prepAlerts) lines.push(`- ${alert.recipeTitle}: ${alert.text}`)
  }
  for (const destination of list.destinations) {
    lines.push('', `${destination.name} · ${destination.localizedName}`)
    let aisle: string | undefined
    for (const item of destination.items) {
      if (item.aisle && item.aisle !== aisle) { lines.push(`  ${item.aisle}`); aisle = item.aisle }
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
