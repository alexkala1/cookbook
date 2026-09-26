import { fold, processedForm } from './grocery'

export type SeasonStatus = 'peak' | 'in_season' | 'off_season' | 'greenhouse'
export type ProduceCategory = 'vegetable' | 'greens' | 'fruit' | 'herb'
type Profile = 'tomato' | 'berry' | 'stone' | 'herb' | 'basil' | 'watery' | 'nightshade' | 'greens' | 'citrus' | 'generic'
type Produce = { id: string, name: string, greekName: string, category: ProduceCategory, terms: string[], season: number[], peak: number[], greenhouse: boolean, profile: Profile }

// Inclusive month span that may wrap the year: span(11, 3) → Nov–Mar.
const span = (from: number, to: number) => Array.from({ length: ((to - from + 12) % 12) + 1 }, (_, i) => ((from - 1 + i) % 12) + 1)
const all = span(1, 12)
const produce = (id: string, name: string, greekName: string, category: ProduceCategory, terms: string[], season: number[], peak: number[], profile: Profile, greenhouse = false): Produce =>
  ({ id, name, greekName, category, terms: terms.map(fold), season, peak, greenhouse, profile })

// Greek field-grown calendar (mainland and Crete). Greenhouse items are sold year-round from Ierapetra and similar growers.
const calendar: Produce[] = [
  produce('tomato', 'Tomato', 'Ντομάτα', 'vegetable', ['tomato', 'cherry tomato', 'ντοματ', 'τοματ'], span(6, 10), span(7, 9), 'tomato', true),
  produce('cucumber', 'Cucumber', 'Αγγούρι', 'vegetable', ['cucumber', 'αγγουρ'], span(5, 9), span(6, 8), 'watery', true),
  produce('pepper', 'Bell pepper', 'Πιπεριά', 'vegetable', ['bell pepper', 'red pepper', 'green pepper', 'yellow pepper', 'peppers', 'πιπερια', 'πιπεριες', 'φλωριν'], span(6, 10), span(7, 9), 'nightshade', true),
  produce('eggplant', 'Eggplant', 'Μελιτζάνα', 'vegetable', ['eggplant', 'aubergine', 'μελιτζαν'], span(6, 10), span(7, 9), 'nightshade', true),
  produce('zucchini', 'Zucchini', 'Κολοκυθάκι', 'vegetable', ['zucchini', 'courgette', 'κολοκυθακ'], span(5, 9), span(6, 8), 'watery', true),
  produce('okra', 'Okra', 'Μπάμιες', 'vegetable', ['okra', 'μπαμι'], span(6, 9), span(7, 8), 'generic'),
  produce('green_beans', 'Green beans', 'Φασολάκια', 'vegetable', ['green bean', 'φασολακ'], span(5, 9), span(6, 8), 'generic', true),
  produce('artichoke', 'Artichoke', 'Αγκινάρα', 'vegetable', ['artichoke', 'αγκιναρ'], span(2, 5), span(3, 4), 'generic'),
  produce('broad_beans', 'Broad beans', 'Κουκιά', 'vegetable', ['broad bean', 'κουκι'], span(3, 5), [4], 'generic'),
  produce('peas', 'Peas', 'Αρακάς', 'vegetable', ['peas', 'green peas', 'αρακα', 'μπιζελ'], span(3, 6), span(4, 5), 'generic'),
  produce('potato', 'Potato', 'Πατάτα', 'vegetable', ['potato', 'πατατ'], all, span(4, 6), 'generic'),
  produce('onion', 'Onion', 'Κρεμμύδι', 'vegetable', ['onion', 'κρεμμυδ'], all, span(6, 8), 'generic'),
  produce('spring_onion', 'Spring onion', 'Φρέσκο κρεμμυδάκι', 'vegetable', ['spring onion', 'green onion', 'scallion', 'φρεσκο κρεμμυδ', 'κρεμμυδακ'], span(1, 5), span(3, 4), 'generic'),
  produce('leek', 'Leek', 'Πράσο', 'vegetable', ['leek', 'πρασο', 'πρασα'], span(10, 3), span(12, 2), 'generic'),
  produce('cabbage', 'Cabbage', 'Λάχανο', 'vegetable', ['cabbage', 'λαχανο'], span(10, 3), span(12, 2), 'generic'),
  produce('cauliflower', 'Cauliflower', 'Κουνουπίδι', 'vegetable', ['cauliflower', 'κουνουπιδ'], span(10, 3), span(11, 2), 'generic'),
  produce('broccoli', 'Broccoli', 'Μπρόκολο', 'vegetable', ['broccoli', 'μπροκολ'], span(10, 3), span(11, 2), 'generic'),
  produce('carrot', 'Carrot', 'Καρότο', 'vegetable', ['carrot', 'καροτ'], all, span(11, 4), 'generic'),
  produce('celery', 'Celery', 'Σέλινο', 'vegetable', ['celery', 'σελινο', 'σελινα'], span(10, 4), span(11, 2), 'generic'),
  produce('spinach', 'Spinach', 'Σπανάκι', 'vegetable', ['spinach', 'σπανακ'], span(10, 4), span(12, 3), 'greens'),
  produce('lettuce', 'Lettuce', 'Μαρούλι', 'vegetable', ['lettuce', 'μαρουλ'], span(10, 5), span(12, 4), 'watery', true),
  produce('pumpkin', 'Pumpkin', 'Κολοκύθα', 'vegetable', ['pumpkin', 'winter squash', 'κολοκυθα'], span(9, 12), span(10, 11), 'generic'),
  produce('beetroot', 'Beetroot', 'Παντζάρι', 'vegetable', ['beet', 'παντζαρ'], span(11, 5), span(2, 4), 'generic'),
  produce('fennel', 'Fennel', 'Μάραθο', 'vegetable', ['fennel', 'μαραθ'], span(11, 4), span(1, 3), 'generic'),
  produce('vlita', 'Amaranth greens', 'Βλίτα', 'greens', ['amaranth greens', 'βλιτ'], span(6, 9), span(7, 8), 'greens'),
  produce('purslane', 'Purslane', 'Γλιστρίδα', 'greens', ['purslane', 'γλιστριδ', 'αντρακλ'], span(5, 9), span(6, 8), 'greens'),
  produce('radikia', 'Dandelion greens', 'Ραδίκια', 'greens', ['dandelion', 'chicory', 'ραδικ'], span(11, 4), span(1, 3), 'greens'),
  produce('stamnagathi', 'Stamnagathi (spiny chicory)', 'Σταμναγκάθι', 'greens', ['stamnagathi', 'σταμναγκαθ'], span(12, 4), span(1, 3), 'greens'),
  produce('zochoi', 'Sow thistle', 'Ζοχοί', 'greens', ['sow thistle', 'ζοχ'], span(11, 4), span(1, 3), 'greens'),
  produce('antidia', 'Endive', 'Αντίδια', 'greens', ['endive', 'αντιδ'], span(11, 3), span(12, 2), 'greens'),
  produce('seskoula', 'Chard', 'Σέσκουλα', 'greens', ['chard', 'σεσκουλ'], span(10, 5), span(12, 3), 'greens'),
  produce('strawberry', 'Strawberry', 'Φράουλα', 'fruit', ['strawberr', 'φραουλ'], span(1, 5), span(3, 4), 'berry'),
  produce('cherry', 'Cherry', 'Κεράσι', 'fruit', ['cherry', 'cherries', 'κερασ'], span(5, 7), [6], 'berry'),
  produce('apricot', 'Apricot', 'Βερίκοκο', 'fruit', ['apricot', 'βερικοκ'], span(5, 7), [6], 'stone'),
  produce('peach', 'Peach', 'Ροδάκινο', 'fruit', ['peach', 'nectarine', 'ροδακιν', 'νεκταριν'], span(6, 9), span(7, 8), 'stone'),
  produce('watermelon', 'Watermelon', 'Καρπούζι', 'fruit', ['watermelon', 'καρπουζ'], span(6, 9), span(7, 8), 'generic'),
  produce('melon', 'Melon', 'Πεπόνι', 'fruit', ['melon', 'cantaloupe', 'πεπον'], span(6, 9), span(7, 8), 'generic'),
  produce('fig', 'Fig', 'Σύκο', 'fruit', ['fig', 'συκο', 'συκα'], span(7, 10), span(8, 9), 'stone'),
  produce('grape', 'Grapes', 'Σταφύλι', 'fruit', ['grape', 'σταφυλ'], span(7, 10), span(8, 9), 'stone'),
  produce('quince', 'Quince', 'Κυδώνι', 'fruit', ['quince', 'κυδων'], span(9, 12), span(10, 11), 'generic'),
  produce('pomegranate', 'Pomegranate', 'Ρόδι', 'fruit', ['pomegranate', 'ροδι'], span(9, 1), span(10, 11), 'generic'),
  produce('apple', 'Apple', 'Μήλο', 'fruit', ['apple', 'μηλο', 'μηλα'], span(9, 5), span(9, 11), 'generic'),
  produce('pear', 'Pear', 'Αχλάδι', 'fruit', ['pear', 'αχλαδ'], span(8, 12), span(9, 10), 'generic'),
  produce('orange', 'Orange', 'Πορτοκάλι', 'fruit', ['orange', 'πορτοκαλ'], span(11, 5), span(12, 3), 'citrus'),
  produce('mandarin', 'Mandarin', 'Μανταρίνι', 'fruit', ['mandarin', 'tangerine', 'clementine', 'μανταριν'], span(11, 2), span(12, 1), 'citrus'),
  produce('lemon', 'Lemon', 'Λεμόνι', 'fruit', ['lemon', 'λεμον'], all, span(11, 4), 'citrus'),
  produce('basil', 'Basil', 'Βασιλικός', 'herb', ['basil', 'βασιλικ'], span(5, 10), span(6, 8), 'basil', true),
  produce('dill', 'Dill', 'Άνηθος', 'herb', ['dill', 'ανηθ'], span(10, 5), span(1, 4), 'herb'),
  produce('parsley', 'Parsley', 'Μαϊντανός', 'herb', ['parsley', 'μαιντανο'], all, span(10, 5), 'herb'),
  produce('mint', 'Mint', 'Δυόσμος', 'herb', ['mint', 'δυοσμ'], span(4, 10), span(5, 8), 'herb'),
  produce('oregano', 'Fresh oregano', 'Φρέσκια ρίγανη', 'herb', ['fresh oregano', 'φρεσκια ριγαν'], span(4, 7), [6], 'herb'),
  produce('coriander', 'Fresh coriander', 'Φρέσκος κόλιανδρος', 'herb', ['coriander leaves', 'fresh coriander', 'cilantro', 'κολιανδρ'], span(10, 4), span(12, 3), 'herb')
]
// Preserved forms are made from peak produce (canned tomatoes are packed at peak), so they are never flagged.
const preserved = /πελτ|paste|juice|χυμ|sauce|σαλτσ|ketchup|κετσαπ|sun dried|λιαστ|jam|μαρμελαδ|γλυκο του κουταλιου|compote|κομποστ|pickl|τουρσ|split pea|φαβα|blossom|ανθονερ/

export function findProduce(name: string): Produce | undefined {
  const folded = fold(name)
  if (processedForm.test(folded) || preserved.test(folded)) return undefined
  let best: Produce | undefined, length = 0
  for (const item of calendar) for (const term of item.terms) {
    if ((' ' + folded).includes(' ' + term) && term.length > length) { best = item; length = term.length }
  }
  return best
}

function assertMonth(month: number) {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError('Month must be an integer from 1 to 12')
}
const statusOf = (item: Produce, month: number): SeasonStatus => item.peak.includes(month) ? 'peak' : item.season.includes(month) ? 'in_season' : item.greenhouse ? 'greenhouse' : 'off_season'
const describe = (item: Produce, month: number) => ({ id: item.id, name: item.name, greekName: item.greekName, category: item.category, status: statusOf(item, month), seasonMonths: item.season, peakMonths: item.peak })
export type SeasonInfo = ReturnType<typeof describe>

export function seasonalityOf(name: string, month: number): SeasonInfo | null {
  assertMonth(month)
  const item = findProduce(name)
  return item ? describe(item, month) : null
}

export function peakProduce(month: number, category?: ProduceCategory) {
  assertMonth(month)
  return calendar.filter(item => item.peak.includes(month) && (!category || item.category === category)).map(item => describe(item, month))
}

const advice: Record<Profile, string[]> = {
  tomato: [
    'Cooked dishes: per ~500 g tomatoes add 1 tsp tomato paste (πελτές), a pinch of sugar, and ½ tsp red wine vinegar. Off-season tomatoes are low in sugar (brix), acidity, and glutamates.',
    'Raw salads: salt the cut tomatoes 15 minutes ahead and use their juices in the dressing; cherry tomatoes usually carry more flavor out of season.',
    'Sauces: good canned whole tomatoes, packed at peak, beat winter fresh ones. Or roast halved tomatoes at 200 °C for 30–40 minutes to concentrate their sugars.'
  ],
  berry: [
    'Macerate 250 g fruit with 1 tbsp sugar and 1 tsp balsamic vinegar (or orange juice and honey) for 30 minutes: sugar draws out juice and balsamic adds depth to tart, underripe fruit.',
    'Or roast at 200 °C for 10–15 minutes with a little honey to concentrate flavor before using in desserts.'
  ],
  stone: [
    'Roast or poach with honey and lemon zest: heat softens underripe fruit and concentrates its sugars.',
    'For raw desserts, macerate with a little sugar and lemon juice for 20–30 minutes.'
  ],
  herb: [
    'Use dried herbs at one third of the fresh amount, bloomed in warm olive oil for 5 minutes before adding, so their aromatic oils rehydrate.',
    'Add dried herbs early in cooking; finish with a little grated lemon zest for freshness.'
  ],
  basil: [
    'Dried basil loses most of its aroma: use a spoonful of pesto or frozen basil cubes instead.',
    'For Greek dishes, dried oregano bloomed in warm olive oil (one third of the fresh amount) is a better stand-in.'
  ],
  watery: ['Off-season produce is watery: salt slices for 10–15 minutes and pat dry before dressing so it does not dilute the dish.'],
  nightshade: ['Roast or char to concentrate sugars and add smoky depth.', 'Salt sliced eggplant for 30 minutes and pat dry so it absorbs less oil.'],
  greens: ['Swap to the greens in season now; out-of-season greens are tougher and more bitter.'],
  citrus: ['Off-season citrus is less juicy: add grated zest for aroma and adjust acidity to taste.'],
  generic: ['Cook rather than serve raw: roasting or braising concentrates flavor in off-season produce.']
}

export function compensate(name: string, month: number) {
  const info = seasonalityOf(name, month)
  if (!info || info.status === 'peak' || info.status === 'in_season') return null
  const item = calendar.find(row => row.id === info.id)!
  const alternatives = peakProduce(month, item.category).filter(row => row.id !== item.id).slice(0, 4)
  const lead = info.status === 'greenhouse' ? `${info.name} is greenhouse-grown this month: available, but lower in flavor than field-grown.` : `${info.name} is out of season in Greece this month.`
  return { ...info, advice: [lead, ...advice[item.profile], ...(alternatives.length ? [`In season now: ${alternatives.map(row => `${row.name} (${row.greekName})`).join(', ')}.`] : [])] }
}

export function assessIngredients(ingredients: { name: string }[], month: number) {
  assertMonth(month)
  return ingredients.flatMap(ingredient => {
    const info = seasonalityOf(ingredient.name, month)
    return info ? [{ ingredient: ingredient.name, ...info, advice: compensate(ingredient.name, month)?.advice ?? [] }] : []
  })
}
