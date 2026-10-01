export type BeverageCategory = 'wine' | 'spirit' | 'beer' | 'non-alcoholic'
export type Beverage = {
  id: string
  name: string
  greekName: string
  category: BeverageCategory
  region: string
  /** Short noun phrase for sentences, e.g. "a crisp Santorini Assyrtiko". */
  phrase: string
  tastingNotes: string
  servingTempC: number
}
export type PairingRecipe = { title: string, ingredients?: any[], tags?: string[], course?: string }
export type Pairing = { beverage: Beverage, alternatives: Beverage[], nonAlcoholic: Beverage, reason: string }

const b = (id: string, name: string, greekName: string, category: BeverageCategory, region: string, phrase: string, tastingNotes: string, servingTempC: number): Beverage =>
  ({ id, name, greekName, category, region, phrase, tastingNotes, servingTempC })

export const beverages = {
  assyrtiko: b('assyrtiko', 'Assyrtiko', 'Ασύρτικο', 'wine', 'Santorini / Drama', 'a crisp Santorini Assyrtiko', 'Crisp, mineral, citrus, high acidity.', 9),
  moschofilero: b('moschofilero', 'Moschofilero', 'Μοσχοφίλερο', 'wine', 'Mantineia', 'an aromatic Mantineia Moschofilero', 'Aromatic, floral, light.', 8),
  malagousia: b('malagousia', 'Malagousia', 'Μαλαγουζιά', 'wine', 'Macedonia', 'a round Malagousia', 'Round, stone fruit, herbal.', 9),
  xinomavro: b('xinomavro', 'Xinomavro', 'Ξινόμαυρο', 'wine', 'Naoussa', 'a bold Naoussa Xinomavro', 'Bold, high acid and tannin; tomato, olive and dried fruit notes.', 16),
  agiorgitiko: b('agiorgitiko', 'Agiorgitiko', 'Αγιωργίτικο', 'wine', 'Nemea', 'a velvety Nemea Agiorgitiko', 'Velvety red; plum and cherry.', 16),
  vinsanto: b('vinsanto', 'Vinsanto / Muscat of Samos', 'Βινσάντο / Μοσχάτο Σάμου', 'wine', 'Santorini / Samos', 'a glass of Vinsanto or Muscat of Samos', 'Sweet dessert wine; dried apricot, honey and raisin.', 12),
  tsipouro: b('tsipouro', 'Tsipouro / Tsikoudia', 'Τσίπουρο / Τσικουδιά', 'spirit', 'Thessaly / Epirus / Crete', 'a small glass of ice-cold Tsipouro', 'Un-aged grape pomace spirit, with or without anise; clean and fiery.', 6),
  ouzo: b('ouzo', 'Ouzo', 'Ούζο', 'spirit', 'Lesvos / Plomari', 'an ouzo with a splash of water', 'Anise spirit; turns cloudy with water or ice.', 8),
  beer: b('beer', 'Greek craft beer', 'Ελληνική μπίρα', 'beer', 'Aegean (Nissos, Septem, Chios, Fix, Mythos)', 'a Greek craft pilsner or pale ale', 'Crisp pilsner or pale ale; light bitterness cuts fat and char.', 5),
  mountainTea: b('mountain-tea', 'Greek mountain tea', 'Τσάι του βουνού', 'non-alcoholic', 'Greek mountains', 'Greek mountain tea with lemon and thyme honey', 'Herbal, gently floral; served with lemon and thyme honey.', 70),
  soumada: b('soumada', 'Soumada', 'Σουμάδα', 'non-alcoholic', 'Crete', 'chilled soumada, the almond drink', 'Sweet, creamy almond drink; warm or iced.', 6),
  souroti: b('souroti', 'Souroti with lemon peel', 'Σουρωτή με λεμόνι', 'non-alcoholic', 'Greece', 'Greek sparkling water (souroti) with lemon peel', 'Lightly mineral and sparkling; lemon peel keeps it clean.', 6)
} as const

type Rule = { match: RegExp, primary: keyof typeof beverages, alternatives: (keyof typeof beverages)[], nonAlcoholic: keyof typeof beverages, reason: string }

// Order matters: the first rule that matches wins.
const rules: Rule[] = [
  { match: /baklava|galaktobour|loukoum|honey|μπακλαβ|γαλακτομπ|dessert|syrup|portokalopita|ravani|kataifi/i, primary: 'vinsanto', alternatives: ['soumada'], nonAlcoholic: 'soumada', reason: 'Sweet honeyed pastries want a sweet wine with matching acidity.' },
  { match: /octopus|kalamari|calamari|htapodi|χταπόδι|καλαμάρι|meze|mezes|mezedes|μεζ/i, primary: 'ouzo', alternatives: ['tsipouro', 'assyrtiko'], nonAlcoholic: 'souroti', reason: 'Anise spirit is the classic partner for grilled and fried seafood mezedes.' },
  { match: /loukaniko|pickled|salted|sardine|anchovy|gavros|λουκάνικο|παστό|τουρσί/i, primary: 'tsipouro', alternatives: ['ouzo', 'beer'], nonAlcoholic: 'souroti', reason: 'A clean pomace spirit cuts through salt, cure and spice.' },
  { match: /moussaka|μουσακά|souvlaki|σουβλάκι|pastitsio|kleftiko|casserole|roast|ψητ/i, primary: 'agiorgitiko', alternatives: ['xinomavro', 'beer'], nonAlcoholic: 'mountainTea', reason: 'Velvety plum-and-cherry red softens roasted meats and baked casseroles.' },
  { match: /gyro|γύρο|street food|bifteki|pita bread|grilled meat/i, primary: 'beer', alternatives: ['agiorgitiko'], nonAlcoholic: 'souroti', reason: 'A crisp Greek lager or pale ale suits street food and grilled meats.' },
  { match: /lamb|arni|arnaki|αρνί|beef|moschari|μοσχάρι|stifado|στιφάδο|kokkinisto|κοκκινιστ|tomato stew|braise|braised|giouvetsi|γιουβέτσι|osso/i, primary: 'xinomavro', alternatives: ['agiorgitiko'], nonAlcoholic: 'mountainTea', reason: 'High acid and tannin match rich tomato braises and lamb.' },
  { match: /fish|seafood|shrimp|prawn|garides|bream|tsipoura|sea bass|lavraki|salmon|mussel|feta|salad|horiatiki|σαλάτα|ψάρι|γαρίδες|fried|tzatziki|dolma|saganaki/i, primary: 'assyrtiko', alternatives: ['malagousia', 'tsipouro'], nonAlcoholic: 'souroti', reason: 'Mineral, high-acid white lifts seafood, feta, salads and fried starters.' },
  { match: /chicken|kotopoulo|κοτόπουλο|turkey|vegetarian|vegetable|vegan|gemista|γεμιστά|fasolakia|light cheese|halloumi|mizithra|manouri/i, primary: 'moschofilero', alternatives: ['malagousia'], nonAlcoholic: 'mountainTea', reason: 'Aromatic, light white flatters poultry, vegetables and gentle cheeses.' },
  { match: /pie|pita|spanakopita|tiropita|hortopita|filo|phyllo|pasta|herb|μακαρόν|πίτα|orzo|giouvarlakia|spinach/i, primary: 'malagousia', alternatives: ['moschofilero', 'assyrtiko'], nonAlcoholic: 'mountainTea', reason: 'Herbal, round white follows herb-forward pies and cheesy pasta.' }
]

const courseFallback: Record<string, keyof typeof beverages> = { appetizer: 'assyrtiko', starter: 'assyrtiko', main: 'agiorgitiko', side: 'malagousia', dessert: 'vinsanto' }

function ingredientNames(ingredients: any[] = []) {
  return ingredients.map(row => typeof row === 'string' ? row : row?.name ?? '').filter(Boolean).join(' ')
}

function build(rule: Rule): Pairing {
  return { beverage: beverages[rule.primary], alternatives: rule.alternatives.map(id => beverages[id]), nonAlcoholic: beverages[rule.nonAlcoholic], reason: rule.reason }
}

export function recommendPairingForRecipe(recipe: PairingRecipe): Pairing {
  const headline = `${recipe.title} ${(recipe.tags ?? []).join(' ')}`
  // Title and tags describe the dish; ingredients only break ties (a feta garnish must not turn lamb into a salad).
  const rule = rules.find(r => r.match.test(headline)) ?? rules.find(r => r.match.test(ingredientNames(recipe.ingredients)))
  if (rule) return build(rule)
  const id = courseFallback[recipe.course ?? ''] ?? 'moschofilero'
  const fallback = rules.find(r => r.primary === id) ?? rules.find(r => r.primary === 'moschofilero')!
  return build(fallback)
}

/** Shopping-list names for a menu's alcoholic pairings, one per distinct drink, in menu order. */
export function menuShoppingDrinks(menu: MenuPairing[]): string[] {
  const seen = new Map<string, string>()
  for (const item of menu) {
    const drink = item.pairing.beverage
    if (drink.category !== 'non-alcoholic' && !seen.has(drink.id)) seen.set(drink.id, drink.name)
  }
  return [...seen.values()]
}

export type MenuPairing = { title: string, course?: string, pairing: Pairing }

export function recommendPairingForMenu(recipes: { title: string, course?: string }[]): MenuPairing[] {
  return recipes.map(recipe => ({
    title: recipe.title, course: recipe.course,
    // A dessert course always gets the sweet pairing, whatever the title says.
    pairing: recommendPairingForRecipe(recipe.course === 'dessert' ? { ...recipe, tags: ['dessert'] } : recipe)
  }))
}
