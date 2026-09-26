import { convertUnit } from './units'

export const marketSections = ['laiki', 'chasapis', 'fournos', 'supermarket'] as const
export type MarketSection = typeof marketSections[number]
export const menuCourses = ['appetizer', 'main', 'side', 'dessert', 'beverage'] as const
export type MenuCourse = typeof menuCourses[number]
// storeType maps each market onto the persisted grocery_items.store_destination enum.
export const sectionInfo = {
  laiki: { name: 'Laiki market', localizedName: 'Λαϊκή Αγορά', storeType: 'manavis_produce', category: 'produce' },
  chasapis: { name: 'Butcher', localizedName: 'Χασάπης / Κρεοπωλείο', storeType: 'chasapis_butcher', category: 'meat' },
  fournos: { name: 'Bakery', localizedName: 'Φούρνος / Αρτοποιείο', storeType: 'fournos_bakery', category: 'bakery' },
  supermarket: { name: 'Supermarket', localizedName: 'Σούπερ μάρκετ', storeType: 'supermarket', category: 'pantry' }
} as const

export const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

type Animal = 'lamb' | 'beef' | 'pork' | 'goat' | 'chicken' | 'rooster' | 'rabbit' | 'sausage' | 'liver' | 'mince'
type Pack = { sizes: number[], unit: 'g' | 'ml' | 'piece', label: string }
type Entry = { id: string, section: MarketSection, terms: string[], group?: boolean, animal?: Animal, egg?: 'whole' | 'yolk' | 'white', pack?: Pack, surplus?: string }

// Terms match at a word start (Greek stems cover inflections); "=" means the whole name.
// The longest matching term wins, so "eggplant" beats "egg" and "black pepper" beats "pepper".
const entry = (id: string, section: MarketSection, terms: string[], extra: Partial<Entry> = {}): Entry => ({ id, section, terms, ...extra })
const catalog: Entry[] = [
  entry('tomato', 'laiki', ['tomato', 'beef tomato', 'cherry tomato', 'ντοματ', 'τοματ']),
  entry('onion', 'laiki', ['onion', 'κρεμμυδ']), entry('spring_onion', 'laiki', ['spring onion', 'green onion', 'scallion', 'φρεσκο κρεμμυδ', 'κρεμμυδακ']),
  entry('garlic', 'laiki', ['garlic', 'σκορδ']), entry('potato', 'laiki', ['potato', 'πατατ']), entry('sweet_potato', 'laiki', ['sweet potato', 'γλυκοπατατ']),
  entry('zucchini', 'laiki', ['zucchini', 'courgette', 'κολοκυθακ']), entry('eggplant', 'laiki', ['eggplant', 'aubergine', 'μελιτζαν']),
  entry('bell_pepper', 'laiki', ['peppers', 'bell pepper', 'red pepper', 'green pepper', 'yellow pepper', 'πιπερια', 'πιπεριες', 'φλωριν']),
  entry('cucumber', 'laiki', ['cucumber', 'αγγουρ']), entry('carrot', 'laiki', ['carrot', 'καροτ']), entry('leek', 'laiki', ['leek', 'πρασο', 'πρασα']),
  entry('celery', 'laiki', ['celery', 'σελινο', 'σελινα']), entry('lettuce', 'laiki', ['lettuce', 'μαρουλ']), entry('cabbage', 'laiki', ['cabbage', 'λαχανο']),
  entry('spinach', 'laiki', ['spinach', 'σπανακ']), entry('chorta', 'laiki', ['horta', 'chorta', 'wild greens', 'greens', 'χορτα', 'βλιτ', 'ραδικ', 'σταμναγκαθ', 'σεσκουλ', 'αντιδ'], { group: true }),
  entry('dill', 'laiki', ['dill', 'ανηθ']), entry('parsley', 'laiki', ['parsley', 'μαιντανο']), entry('mint', 'laiki', ['mint', 'δυοσμ']), entry('basil', 'laiki', ['basil', 'βασιλικ']),
  entry('lemon', 'laiki', ['lemon', 'λεμον']), entry('lime', 'laiki', ['lime', 'λαιμ']), entry('orange', 'laiki', ['orange', 'πορτοκαλ']), entry('apple', 'laiki', ['apple', 'μηλο', 'μηλα']),
  entry('fruit', 'laiki', ['fig', 'συκο', 'συκα', 'grape', 'σταφυλ', 'watermelon', 'καρπουζ', 'melon', 'πεπον', 'peach', 'ροδακιν', 'strawberr', 'φραουλ', 'cherr', 'κερασ', 'pomegranate', 'ροδι', 'quince', 'κυδων', 'pear', 'αχλαδ', 'apricot', 'βερικοκ'], { group: true }),
  entry('vegetable', 'laiki', ['okra', 'μπαμι', 'green bean', 'φασολακ', 'artichoke', 'αγκιναρ', 'fennel', 'μαραθ', 'peas', 'μπιζελ', 'broad bean', 'κουκι', 'mushroom', 'μανιταρ', 'cauliflower', 'κουνουπιδ', 'broccoli', 'μπροκολ', 'beet', 'παντζαρ', 'pumpkin', 'κολοκυθ', 'fresh oregano', 'fresh thyme'], { group: true }),
  // Animals precede generic mince so "μοσχαρίσιος κιμάς" resolves to beef on equal-length terms.
  entry('lamb', 'chasapis', ['lamb', 'αρνι', 'αρνισ', 'αρνακ', 'παιδακ'], { animal: 'lamb' }), entry('beef', 'chasapis', ['beef', 'veal', 'μοσχ'], { animal: 'beef' }),
  entry('pork', 'chasapis', ['pork', 'χοιρ'], { animal: 'pork' }), entry('goat', 'chasapis', ['goat', 'κατσικ'], { animal: 'goat' }),
  entry('chicken', 'chasapis', ['chicken', 'κοτοπουλ', 'κοτα'], { animal: 'chicken' }), entry('rooster', 'chasapis', ['rooster', 'κοκορ'], { animal: 'rooster' }),
  entry('rabbit', 'chasapis', ['rabbit', 'κουνελ'], { animal: 'rabbit' }), entry('sausage', 'chasapis', ['sausage', 'λουκανικ'], { animal: 'sausage' }),
  entry('liver', 'chasapis', ['liver', 'συκωτ'], { animal: 'liver' }), entry('mince', 'chasapis', ['mince', 'minced meat', 'ground meat', 'κιμα'], { animal: 'mince' }),
  entry('bread', 'fournos', ['bread', 'loaf', 'baguette', 'sourdough', 'pita', 'ψωμ', 'χωριατικο ψωμ', '=χωριατικο', 'προζυμ', 'κουλουρ', 'λαγαν', 'πιτες'], { group: true }),
  entry('yeast', 'fournos', ['yeast', 'μαγια'], { pack: { sizes: [8], unit: 'g', label: 'sachet' } }),
  entry('phyllo', 'fournos', ['phyllo', 'filo', 'fillo', 'φυλλο κρουστας', 'φυλλα κρουστας', 'κρουστα', '=φυλλο', '=φυλλα'], { pack: { sizes: [450], unit: 'g', label: 'pack' }, surplus: 'wrap airtight and refrigerate for a few days, or freeze; thaw in the fridge before use.' }),
  entry('cream', 'supermarket', ['cream', 'heavy cream', 'double cream', 'whipping cream', 'cooking cream', 'κρεμα γαλακτος'], { pack: { sizes: [250, 500], unit: 'ml', label: 'carton' }, surplus: 'enrich a pan sauce or whip for dessert; use within 3 days of opening.' }),
  entry('milk', 'supermarket', ['milk', 'γαλα'], { pack: { sizes: [500, 1000], unit: 'ml', label: 'carton' }, surplus: 'use for béchamel, rizogalo, or coffee.' }),
  entry('butter', 'supermarket', ['butter', 'βουτυρ'], { pack: { sizes: [250], unit: 'g', label: 'block' }, surplus: 'wrap tightly; keeps for weeks refrigerated and freezes well.' }),
  entry('feta', 'supermarket', ['feta', 'φετα'], { pack: { sizes: [200, 400], unit: 'g', label: 'pack' }, surplus: 'keep submerged in its brine (or lightly salted water) in the fridge.' }),
  entry('yogurt', 'supermarket', ['yogurt', 'yoghurt', 'γιαουρτ'], { pack: { sizes: [170, 500, 1000], unit: 'g', label: 'tub' }, surplus: 'use for tzatziki or as a marinade.' }),
  entry('egg', 'supermarket', ['egg', 'αυγ'], { egg: 'whole', pack: { sizes: [6, 10], unit: 'piece', label: 'box' } }),
  entry('egg_yolk', 'supermarket', ['egg yolk', 'yolk', 'κροκ'], { egg: 'yolk' }), entry('egg_white', 'supermarket', ['egg white', 'ασπραδ'], { egg: 'white' }),
  entry('flour', 'supermarket', ['flour', 'αλευρ'], { pack: { sizes: [1000], unit: 'g', label: 'bag' } }),
  entry('sugar', 'supermarket', ['sugar', 'ζαχαρ'], { pack: { sizes: [1000], unit: 'g', label: 'bag' } }),
  entry('rice', 'supermarket', ['rice', 'ρυζ'], { pack: { sizes: [500, 1000], unit: 'g', label: 'bag' } }),
  entry('canned_tomato', 'supermarket', ['canned tomato', 'tinned tomato', 'ντοματα κονσερβα', 'passata', 'πασσατα', 'τοματοχυμ'], { pack: { sizes: [400], unit: 'g', label: 'can' }, surplus: 'freeze the rest in a sealed container.' }),
  entry('olive_oil', 'supermarket', ['olive oil', 'ελαιολαδ', 'λαδι']),
  // Section-only groups: distinct items inside them are never merged together.
  entry('pantry', 'supermarket', ['pepper', 'black pepper', 'white pepper', 'oil', 'cream of tartar', 'peppercorn', 'pepper flake', 'chili flake', 'chilli flake', 'paprika', 'cumin', 'cinnamon', 'nutmeg', 'clove', 'oregano', 'thyme', 'rosemary', 'bay lea', 'allspice', 'saffron', 'salt', 'sea salt', 'celery salt', 'garlic powder', 'onion powder', 'sumac', 'mastic', 'mahleb', 'vanilla', 'baking powder', 'baking soda', 'vinegar', 'apple cider vinegar', 'honey', 'πιπερι', 'ριγαν', 'θυμαρ', 'δενδρολιβαν', 'δαφν', 'μπαχαρ', 'κανελ', 'κυμιν', 'μοσχοκαρυδ', 'μοσχοκαρφ', 'γαρυφαλ', 'κροκος κοζανης', 'κοζαν', 'αλατ', 'σουμα', 'μαστιχ', 'μαχλεπ', 'βανιλ', 'μπεικιν', 'σοδα', 'ξυδ', 'μηλοξυδ', 'μελι', 'stock', 'broth', 'bouillon', 'ζωμ', 'κυβο', 'chickpea', 'ρεβιθ', 'lentil', 'φακες', 'φακη', 'dried bean', 'γιγαντ', 'φασολια', 'split pea', 'φαβα', 'olive', 'ελια', 'ελιες', 'caper', 'καππαρ', 'walnut', 'καρυδ', 'almond', 'αμυγδαλ', 'pine nut', 'κουκουναρ', 'raisin', 'σταφιδ', 'tahini', 'ταχιν', 'chocolate', 'milk chocolate', 'σοκολατ', 'cocoa', 'κακαο', 'peanut', 'peanut butter', 'coconut milk', 'buttermilk', 'sour cream', 'ξινη κρεμα', 'cream cheese', 'ice cream', 'παγωτ', 'breadcrumb', 'φρυγανι', 'puff pastry', 'σφολιατ', 'cornflour', 'semolina', 'σιμιγδαλ', 'bulgur', 'πλιγουρ', 'pasta', 'spaghetti', 'orzo', 'μακαρον', 'κριθαρακ', 'χυλοπιτ', 'τραχαν', 'wine', 'κρασ', 'ouzo', 'ουζ', 'brandy', 'κονιακ', 'bacon', 'μπεικον', 'ham', 'ζαμπον', 'vine lea', 'αμπελοφυλλ', 'mayonnaise', 'μαγιονεζ', 'mustard', 'μουσταρδ', 'tomato paste', 'πελτ', 'cheese', 'τυρι', 'κεφαλοτυρ', 'γραβιερ', 'κασερ', 'parmesan', 'παρμεζαν', 'halloumi', 'χαλουμ', 'μυζηθρ', 'ανθοτυρ', 'αυγοταραχ', 'fish', 'salmon', 'cod', 'shrimp', 'prawn', 'octopus', 'squid', 'sardine', 'anchov', 'ψαρι', 'σολομ', 'μπακαλιαρ', 'γαριδ', 'χταποδ', 'καλαμαρ', 'σουπι', 'σαρδελ', 'γαυρ'], { group: true })
].map(item => ({ ...item, terms: item.terms.map(term => term.startsWith('=') ? '=' + fold(term.slice(1)) : fold(term)) }))
// Processed forms are never bought at the laiki or butcher counter.
export const processedForm = /(?:^| )(?:canned|tinned|κονσερβ|frozen|κατεψυγμ|dried|αποξηραμ|powder|σκονη|stock|broth|bouillon|ζωμ|κυβο|paste|πελτ|smoked|καπνιστ|jar|βαζο|flake)/

function classify(name: string): Entry | undefined {
  const folded = fold(name), isProcessed = processedForm.test(folded)
  let best: Entry | undefined, length = 0
  for (const item of catalog) {
    if (isProcessed && (item.section === 'laiki' || item.section === 'chasapis')) continue
    for (const term of item.terms) {
      const hit = term.startsWith('=') ? folded === term.slice(1) : (' ' + folded).includes(' ' + term)
      if (hit && term.length > length) { best = item; length = term.length }
    }
  }
  return best
}

const unitAliases: Record<string, string[]> = {
  g: ['g', 'gr', 'γρ', 'γραμ', 'γραμμαρια', 'γραμμαριο', 'gram', 'grams'], kg: ['kg', 'κιλο', 'κιλα', 'kilo', 'kilos'],
  l: ['l', 'lt', 'λιτρο', 'λιτρα', 'liter', 'liters', 'litre', 'litres'], ml: ['ml'], tsp: ['tsp', 'κγ', 'κουταλακι', 'teaspoon', 'teaspoons'],
  tbsp: ['tbsp', 'κσ', 'κουταλια', 'tablespoon', 'tablespoons'], cup: ['cup', 'cups', 'φλιτζανι', 'φλιτζανια'], 'fl oz': ['floz'], oz: ['oz'], lb: ['lb', 'lbs'],
  piece: ['', 'piece', 'pieces', 'pc', 'pcs', 'whole', 'large', 'medium', 'small', 'τεμ', 'τεμαχιο', 'τεμαχια']
}
const unitLookup = new Map(Object.entries(unitAliases).flatMap(([unit, aliases]) => aliases.map(alias => [alias, unit] as const)))
type Measure = { dimension: string, amount: number, unit: string }
function measure(amount: number, rawUnit: string): Measure {
  const unit = unitLookup.get(fold(rawUnit).replace(/ /g, ''))
  for (const [dimension, base] of [['mass', 'g'], ['volume', 'ml'], ['count', 'piece']] as const) {
    try { if (unit) return { dimension, amount: convertUnit(amount, unit, base), unit: base } } catch { /* Other dimension. */ }
  }
  // Pinches, bunches, cans: summed only with the identical unit.
  return { dimension: 'unit:' + fold(rawUnit), amount, unit: rawUnit.trim() }
}

export function roundToPacks(need: number, sizes: number[]) {
  if (!(need > 0) || !sizes.length) return null
  const sorted = [...sizes].sort((a, b) => b - a)
  if (need / sorted.at(-1)! > 60) { const count = Math.ceil(need / sorted[0]!); return { packs: [{ size: sorted[0]!, count }], total: count * sorted[0]! } }
  // Each extra pack costs one smallest pack of waste: 1 × 1 kg tub beats 500 g + 2 × 170 g for 800 g.
  let best: { packs: { size: number, count: number }[], total: number, count: number, score: number } | undefined
  const search = (index: number, remaining: number, packs: { size: number, count: number }[]) => {
    if (index === sorted.length) {
      if (remaining > 0) return
      const total = packs.reduce((sum, pack) => sum + pack.size * pack.count, 0), count = packs.reduce((sum, pack) => sum + pack.count, 0)
      const score = total - need + (count - 1) * sorted.at(-1)!
      if (!best || score < best.score || (score === best.score && count < best.count)) best = { packs: packs.filter(pack => pack.count), total, count, score }
      return
    }
    const size = sorted[index]!
    for (let count = 0; count <= Math.ceil(Math.max(remaining, 0) / size); count++) search(index + 1, remaining - count * size, [...packs, { size, count }])
  }
  search(0, need, [])
  return best && { packs: best.packs, total: best.total }
}

const animals: Record<Animal, { noun: string, gender: Gender, adjective?: Record<'f' | 'n' | 'npl' | 'fpl', string> }> = {
  lamb: { noun: 'αρνί', gender: 'n', adjective: { f: 'αρνίσια', n: 'αρνίσιο', npl: 'αρνίσια', fpl: 'αρνίσιες' } },
  beef: { noun: 'μοσχάρι', gender: 'n', adjective: { f: 'μοσχαρίσια', n: 'μοσχαρίσιο', npl: 'μοσχαρίσια', fpl: 'μοσχαρίσιες' } },
  pork: { noun: 'χοιρινό', gender: 'n', adjective: { f: 'χοιρινή', n: 'χοιρινό', npl: 'χοιρινά', fpl: 'χοιρινές' } },
  goat: { noun: 'κατσικάκι', gender: 'n', adjective: { f: 'κατσικίσια', n: 'κατσικίσιο', npl: 'κατσικίσια', fpl: 'κατσικίσιες' } },
  chicken: { noun: 'κοτόπουλο', gender: 'n' }, rooster: { noun: 'κόκορας', gender: 'm' }, rabbit: { noun: 'κουνέλι', gender: 'n' },
  sausage: { noun: 'λουκάνικα', gender: 'npl' }, liver: { noun: 'συκώτι', gender: 'n' }, mince: { noun: 'κρέας', gender: 'n' }
}
type Gender = 'm' | 'f' | 'n' | 'npl' | 'fpl'
const participle = (stem: string, gender: Gender) => stem + { m: 'ος', f: 'η', n: 'ο', npl: 'α', fpl: 'ες' }[gender]
const dishes: [RegExp, string][] = [[/στιφαδ|stifado/, 'στιφάδο'], [/γιουβετσ|giouvetsi|youvetsi/, 'γιουβέτσι'], [/κλεφτικ|kleftiko/, 'κλέφτικο'], [/γαστρ|gastra/, 'γάστρα'], [/κοκκινιστ|kokkinisto|stew|braise|γιαχν/, 'κοκκινιστό'], [/σουπ|soup/, 'σούπα']]
type Cut = 'mince' | 'shoulder' | 'leg' | 'chops' | 'breast' | 'whole'
function cutOf(text: string): Cut {
  return /(?:^| )(?:mince|minced|ground|κιμα)/.test(text) ? 'mince' : /(?:^| )(?:shoulder|σπαλα)/.test(text) ? 'shoulder'
    : /(?:^| )(?:chop|cutlet|rack|παιδακ|μπριζολ)/.test(text) ? 'chops' : /(?:^| )(?:leg|thigh|drumstick|μπουτ)/.test(text) ? 'leg'
      : /(?:^| )(?:breast|στηθ)/.test(text) ? 'breast' : 'whole'
}
function butcherOrder(animal: Animal, detail: string, context: string) {
  const info = animals[animal], cut = cutOf(detail), adjective = info.adjective
  let product = info.noun, gender = info.gender
  if (cut === 'shoulder' && adjective) { product = adjective.f + ' σπάλα'; gender = 'f' }
  else if (cut === 'leg') [product, gender] = adjective ? [adjective.n + ' μπούτι', 'n'] : animal === 'chicken' ? ['μπούτια κοτόπουλου', 'npl'] : [product, gender]
  else if (cut === 'breast' && animal === 'chicken') product = 'στήθος κοτόπουλου'
  else if (cut === 'chops' && (animal === 'lamb' || animal === 'goat')) [product, gender] = [/milk fed|γαλακτ|baby/.test(detail) ? 'παϊδάκια γάλακτος' : adjective!.npl + ' παϊδάκια', 'npl']
  else if (cut === 'chops' && adjective) [product, gender] = [adjective.fpl + ' μπριζόλες', 'fpl']
  if (/boneless|χωρις κοκκαλο|ξεκοκαλ/.test(detail)) product += ' χωρίς κόκκαλο'
  const dish = dishes.find(([pattern]) => pattern.test(context))?.[1]
  const portioned = cut !== 'chops' && animal !== 'sausage' && animal !== 'liver'
  const prep = cut === 'mince' ? participle('περασμέν', gender) + ' δύο φορές από τη μηχανή για κιμά'
    : dish && portioned ? participle('κομμέν', gender) + ' σε μερίδες για ' + dish : ''
  return { key: `${cut}|${product}|${prep}`, product, prep }
}
function orderQuantity(item: { amount: number, unit: string }) {
  if (item.unit === 'g') {
    const grams = Math.ceil(item.amount / 50) * 50 // Butchers cut to order; round up to the nearest 50 g.
    return grams >= 1000 ? `${(grams / 1000).toLocaleString('el-GR', { maximumFractionDigits: 2 })} ${grams === 1000 ? 'κιλό' : 'κιλά'}` : `${grams} γραμμάρια`
  }
  return item.unit === 'piece' ? String(round(item.amount)) : `${round(item.amount)} ${item.unit}`
}

const round = (value: number) => Math.round(value * 100) / 100
const advancePrep = /soak|overnight|marinat|thaw|defrost|room temperature|day before|night before|μουλια|απο το βραδυ|την προηγουμενη|μαριναρ|ξεπαγ|θερμοκρασια δωματιου/

export type GroceryRecipe = { id: string, title: string, servings: number, ingredients: { name: string, amount: number, unit: string, notes?: string | null }[], steps?: { instruction: string }[] }
export type GroceryCourse = { course: MenuCourse, recipe: GroceryRecipe, servings?: number }
export type GroceryUse = { course: MenuCourse, recipeId: string, recipeTitle: string, name: string, amount: number, unit: string }
export type GroceryItem = {
  key: string, name: string, section: MarketSection, amount: number, unit: string, usedIn: GroceryUse[], prepNotes: string[],
  counterPhrase?: string, packageSizeToBuy?: string, surplusLeftoverTip?: string, note?: string
}
export type PrepAlert = { course: MenuCourse, recipeId: string, recipeTitle: string, text: string }

export function buildGroceryList(menu: GroceryCourse[]) {
  const buckets = new Map<string, GroceryItem & { entry?: Entry, mergeKey: string }>()
  const eggs = { whole: 0, yolk: 0, white: 0, usedIn: [] as GroceryUse[], notes: new Set<string>() }
  const alerts: PrepAlert[] = []
  for (const { course, recipe, servings } of menu) {
    const ratio = (servings ?? recipe.servings) / recipe.servings
    const context = fold([recipe.title, ...(recipe.steps ?? []).map(step => step.instruction)].join(' '))
    const alert = (text: string) => { if (!alerts.some(row => row.recipeId === recipe.id && row.text === text)) alerts.push({ course, recipeId: recipe.id, recipeTitle: recipe.title, text }) }
    for (const step of recipe.steps ?? []) if (advancePrep.test(fold(step.instruction))) alert(step.instruction)
    for (const ingredient of recipe.ingredients) {
      const notes = ingredient.notes?.trim() || ''
      if (notes && advancePrep.test(fold(notes))) alert(`${ingredient.name}: ${notes}`)
      const found = classify(ingredient.name), amount = measure(ingredient.amount * ratio, ingredient.unit)
      const use = { course, recipeId: recipe.id, recipeTitle: recipe.title, name: ingredient.name, amount: round(amount.amount), unit: amount.unit }
      if (found?.egg && amount.dimension === 'count') {
        eggs[found.egg] += amount.amount; eggs.usedIn.push(use); if (notes) eggs.notes.add(notes)
        continue
      }
      const section = found?.section ?? 'supermarket'
      const baseKey = found && !found.group ? found.id : fold(ingredient.name)
      const order = found?.animal ? butcherOrder(found.animal, fold(ingredient.name + ' ' + notes), context + ' ' + fold(notes)) : undefined
      const mergeKey = [baseKey, order?.key].filter(Boolean).join('|'), key = mergeKey + '|' + amount.dimension
      const bucket = buckets.get(key) ?? { key, mergeKey, entry: found, name: ingredient.name.trim(), section, amount: 0, unit: amount.unit, usedIn: [], prepNotes: [], ...(order && { counterPhrase: `${order.product}${order.prep ? ', ' + order.prep : ''}` }) }
      bucket.amount += amount.amount; bucket.usedIn.push(use)
      if (notes && !bucket.prepNotes.includes(notes) && bucket.prepNotes.length < 5) bucket.prepNotes.push(notes)
      buckets.set(key, bucket)
    }
  }
  const items: GroceryItem[] = []
  for (const { entry: found, mergeKey, ...item } of buckets.values()) {
    item.amount = round(item.amount)
    if (item.counterPhrase && item.amount > 0) item.counterPhrase = orderQuantity(item) + ' ' + item.counterPhrase
    if (found?.pack && item.unit === found.pack.unit) Object.assign(item, packAdvice(item.amount, found.pack, found.surplus))
    if ([...buckets.values()].some(other => other.mergeKey === mergeKey && other.key !== item.key)) item.note = 'Also listed in another measure; not combined without a density.'
    items.push(item)
  }
  if (eggs.whole + eggs.yolk + eggs.white > 0) items.push(eggItem(eggs))
  const sections = marketSections.map(section => ({ section, ...sectionInfo[section], items: items.filter(item => item.section === section).sort((a, b) => a.name.localeCompare(b.name, 'el')) }))
    .filter(group => group.items.length)
  return { sections, prepAlerts: alerts.slice(0, 30) }
}

function packAdvice(need: number, pack: Pack, surplus?: string) {
  const rounded = roundToPacks(need, pack.sizes)
  if (!rounded) return {}
  const label = rounded.packs.map(({ size, count }) => pack.unit === 'piece' ? `${count} × ${pack.label} of ${size}` : `${count} × ${size} ${pack.unit} ${pack.label}`).join(' + ')
  const left = round(rounded.total - need)
  return { packageSizeToBuy: label, ...(left > 0 && surplus ? { surplusLeftoverTip: `About ${left} ${pack.unit} left over: ${surplus}` } : {}) }
}

function eggItem(eggs: { whole: number, yolk: number, white: number, usedIn: GroceryUse[], notes: Set<string> }): GroceryItem {
  // Separated recipes share eggs: 2 yolks for a sauce and 2 whites for meringue need only 2 eggs.
  const amount = Math.ceil(eggs.whole + Math.max(eggs.yolk, eggs.white))
  const whites = Math.round(eggs.yolk - eggs.white), tips: string[] = []
  if (whites > 0) tips.push(`${whites} leftover egg white${whites > 1 ? 's' : ''}: make meringue or freeze them (up to 12 months).`)
  if (whites < 0) tips.push(`${-whites} leftover egg yolk${whites < -1 ? 's' : ''}: use in custard, avgolemono, or mayonnaise; cover and refrigerate, use within 2 days.`)
  const parts = [eggs.whole && `${round(eggs.whole)} whole`, eggs.yolk && `${round(eggs.yolk)} yolks`, eggs.white && `${round(eggs.white)} whites`].filter(Boolean).join(' · ')
  const packs = packAdvice(amount, catalog.find(item => item.id === 'egg')!.pack!)
  return { key: 'egg|count', name: 'Eggs', section: 'supermarket', amount, unit: 'piece', usedIn: eggs.usedIn, prepNotes: [...eggs.notes].slice(0, 5), note: parts, ...packs, ...(tips.length && { surplusLeftoverTip: tips.join(' ') }) }
}
