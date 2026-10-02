import { describe, expect, it, vi } from 'vitest'
import { createApp, createRouter, toWebHandler } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { eq } from 'drizzle-orm'
import { fileURLToPath } from 'node:url'
import { buildGroceryList, roundToPacks, type GroceryCourse, type GroceryRecipe, type MarketSection } from '../shared/culinary/grocery'
import { db } from '../server/db'
import * as schema from '../server/db/schema'
import generate from '../server/api/grocery/generate.post'
import csrf from '../server/middleware/csrf'
import { saveRecipe } from '../server/utils/recipes'

vi.mock('../server/db', async () => {
  vi.stubEnv('DATABASE_URL', ':memory:')
  return await vi.importActual('../server/db')
})

let recipeCount = 0
const recipe = (ingredients: [string, number, string, string?][], extra: Partial<GroceryRecipe> = {}): GroceryRecipe => ({
  id: 'r' + ++recipeCount, title: 'Recipe ' + recipeCount, servings: 4, steps: [],
  ingredients: ingredients.map(([name, amount, unit, notes]) => ({ name, amount, unit, notes })), ...extra
})
const course = (value: GroceryRecipe, name: GroceryCourse['course'] = 'main', servings?: number): GroceryCourse => ({ course: value, recipe: value, servings } as never)
const list = (...courses: GroceryCourse[]) => buildGroceryList(courses.map(row => ({ course: row.course ?? 'main', recipe: row.recipe, servings: row.servings })))
const items = (plan: ReturnType<typeof buildGroceryList>) => plan.sections.flatMap(section => section.items)
const find = (plan: ReturnType<typeof buildGroceryList>, name: string) => items(plan).find(item => item.name === name)!
const sectionOf = (name: string, unit = 'piece') => find(list({ course: 'main', recipe: recipe([[name, 1, unit]]) }), name).section

describe('regional market routing', () => {
  it.each<[string, MarketSection]>([
    ['Tomatoes', 'laiki'], ['ντομάτες', 'laiki'], ['beef tomato', 'laiki'], ['χόρτα', 'laiki'], ['βλίτα', 'laiki'], ['fresh dill', 'laiki'], ['μαϊντανός', 'laiki'],
    ['red peppers', 'laiki'], ['πιπεριές Φλωρίνης', 'laiki'], ['eggplant', 'laiki'], ['λεμόνια', 'laiki'], ['σύκα', 'laiki'],
    ['lamb shoulder', 'chasapis'], ['κιμάς', 'chasapis'], ['μοσχαρίσιος κιμάς', 'chasapis'], ['παϊδάκια γάλακτος', 'chasapis'], ['λουκάνικο χωριάτικο', 'chasapis'], ['συκώτι', 'chasapis'],
    ['ψωμί', 'fournos'], ['χωριάτικο', 'fournos'], ['φύλλο κρούστας', 'fournos'], ['phyllo pastry', 'fournos'], ['dried yeast', 'fournos'], ['μαγιά', 'fournos'],
    ['feta', 'supermarket'], ['olive oil', 'supermarket'], ['black pepper', 'supermarket'], ['pepper', 'supermarket'], ['πιπέρι', 'supermarket'], ['salt and pepper', 'supermarket'],
    ['canned tomatoes', 'supermarket'], ['chicken stock', 'supermarket'], ['garlic powder', 'supermarket'], ['frozen spinach', 'supermarket'], ['dried oregano', 'supermarket'],
    ['μοσχοκάρυδο', 'supermarket'], ['κρόκος Κοζάνης', 'supermarket'], ['breadcrumbs', 'supermarket'], ['buttermilk', 'supermarket'], ['salmon fillet', 'supermarket'], ['dragonfruit powder', 'supermarket']
  ])('%s → %s', (name, section) => expect(sectionOf(name)).toBe(section))
  it('pools whole eggs under the supermarket', () => expect(find(list({ course: 'main', recipe: recipe([['αυγά', 3, 'piece']]) }), 'Eggs').section).toBe('supermarket'))
})

describe('butcher counter phrasing', () => {
  it('orders mince passed twice through the grinder, rounded up to 50 g', () => {
    const plan = list({ course: 'main', recipe: recipe([['μοσχαρίσιος κιμάς', 730, 'g']], { title: 'Μουσακάς' }) })
    expect(find(plan, 'μοσχαρίσιος κιμάς').counterPhrase).toBe('750 γραμμάρια μοσχάρι, περασμένο δύο φορές από τη μηχανή για κιμά')
    expect(find(list({ course: 'main', recipe: recipe([['κιμάς', 500, 'g']]) }), 'κιμάς').counterPhrase).toBe('500 γραμμάρια κρέας, περασμένο δύο φορές από τη μηχανή για κιμά')
  })
  it('uses feminine agreement for a boneless shoulder cut for gastra', () => {
    const plan = list({ course: 'main', recipe: recipe([['boneless lamb shoulder', 1.4, 'kg']], { title: 'Αρνί στη γάστρα' }) })
    expect(find(plan, 'boneless lamb shoulder').counterPhrase).toBe('1,4 κιλά αρνίσια σπάλα χωρίς κόκκαλο, κομμένη σε μερίδες για γάστρα')
    expect(find(list({ course: 'main', recipe: recipe([['σπάλα αρνίσια', 1, 'kg', 'χωρίς κόκκαλο']]) }), 'σπάλα αρνίσια').counterPhrase).toBe('1 κιλό αρνίσια σπάλα χωρίς κόκκαλο')
  })
  it('portions stewing beef for kokkinisto and names the dish from the method', () => {
    expect(find(list({ course: 'main', recipe: recipe([['beef', 1000, 'g']], { title: 'Μοσχάρι κοκκινιστό' }) }), 'beef').counterPhrase).toBe('1 κιλό μοσχάρι, κομμένο σε μερίδες για κοκκινιστό')
    const stifado = recipe([['veal', 900, 'g']], { title: 'Sunday stew', steps: [{ instruction: 'Brown the veal for the στιφάδο.' }] })
    expect(find(list({ course: 'main', recipe: stifado }), 'veal').counterPhrase).toBe('900 γραμμάρια μοσχάρι, κομμένο σε μερίδες για στιφάδο')
  })
  it('orders milk-fed chops by count without inventing a milk-fed claim for ordinary chops', () => {
    expect(find(list({ course: 'main', recipe: recipe([['παϊδάκια γάλακτος', 12, 'piece']]) }), 'παϊδάκια γάλακτος').counterPhrase).toBe('12 παϊδάκια γάλακτος')
    expect(find(list({ course: 'main', recipe: recipe([['lamb chops', 8, 'piece']], { title: 'Lamb stew' }) }), 'lamb chops').counterPhrase).toBe('8 αρνίσια παϊδάκια')
    expect(find(list({ course: 'main', recipe: recipe([['pork chops', 4, 'piece']]) }), 'pork chops').counterPhrase).toBe('4 χοιρινές μπριζόλες')
  })
  it('omits the quantity for a to-taste meat line', () => {
    expect(find(list({ course: 'main', recipe: recipe([['κιμάς', 0, 'g']]) }), 'κιμάς').counterPhrase).toBe('κρέας, περασμένο δύο φορές από τη μηχανή για κιμά')
  })
  it('keeps separate butcher orders when two courses need different preparation', () => {
    const plan = list({ course: 'appetizer', recipe: recipe([['ground lamb', 300, 'g']]) }, { course: 'main', recipe: recipe([['lamb shoulder', 1200, 'g']], { title: 'Kleftiko' }) })
    expect(items(plan).filter(item => item.section === 'chasapis').map(item => item.counterPhrase)).toEqual([
      '300 γραμμάρια αρνί, περασμένο δύο φορές από τη μηχανή για κιμά', '1,2 κιλά αρνίσια σπάλα, κομμένη σε μερίδες για κλέφτικο'
    ])
    expect(items(plan).every(item => !item.note)).toBe(true)
  })
})

describe('pack-size rounding and surplus tips', () => {
  it('rounds 200 ml cream to a 250 ml carton with a culinary tip for the remaining 50 ml', () => {
    const cream = find(list({ course: 'main', recipe: recipe([['heavy cream', 200, 'ml']]) }), 'heavy cream')
    expect(cream.packageSizeToBuy).toBe('1 × 250 ml carton')
    expect(cream.surplusLeftoverTip).toMatch(/^About 50 ml left over: enrich a pan sauce or whip for dessert/)
  })
  it('converts spoon measures and picks the smallest pack combination', () => {
    expect(find(list({ course: 'main', recipe: recipe([['κρέμα γάλακτος', 4, 'tbsp']]) }), 'κρέμα γάλακτος').packageSizeToBuy).toBe('1 × 250 ml carton')
    expect(find(list({ course: 'main', recipe: recipe([['cream', 600, 'ml']]) }), 'cream').packageSizeToBuy).toBe('1 × 500 ml carton + 1 × 250 ml carton')
    expect(roundToPacks(1100, [1000])).toEqual({ packs: [{ size: 1000, count: 2 }], total: 2000 })
    expect(roundToPacks(800, [170, 500, 1000])).toEqual({ packs: [{ size: 1000, count: 1 }], total: 1000 })
    expect(roundToPacks(1500, [500, 1000])).toEqual({ packs: [{ size: 1000, count: 1 }, { size: 500, count: 1 }], total: 1500 })
    expect(roundToPacks(12, [6, 10])).toEqual({ packs: [{ size: 6, count: 2 }], total: 12 })
    expect(roundToPacks(0, [250])).toBeNull()
  })
  it('gives no surplus tip when the pack is used exactly or the measure cannot be packed', () => {
    expect(find(list({ course: 'main', recipe: recipe([['butter', 250, 'g']]) }), 'butter')).toMatchObject({ packageSizeToBuy: '1 × 250 g block' })
    expect(find(list({ course: 'main', recipe: recipe([['butter', 250, 'g']]) }), 'butter').surplusLeftoverTip).toBeUndefined()
    expect(find(list({ course: 'main', recipe: recipe([['butter', 2, 'tbsp']]) }), 'butter').packageSizeToBuy).toBeUndefined()
  })
  it('pools separated eggs across courses and suggests uses for leftover whites', () => {
    const plan = list({ course: 'main', recipe: recipe([['egg yolks', 2, 'piece']]) }, { course: 'dessert', recipe: recipe([['eggs', 2, 'piece']]) })
    expect(find(plan, 'Eggs')).toMatchObject({ amount: 4, packageSizeToBuy: '1 × box of 6', note: '2 whole · 2 yolks' })
    expect(find(plan, 'Eggs').surplusLeftoverTip).toContain('2 leftover egg whites: make meringue or freeze')
    const shared = find(list({ course: 'main', recipe: recipe([['κρόκοι αυγών', 2, '']]) }, { course: 'dessert', recipe: recipe([['egg whites', 2, 'piece']]) }), 'Eggs')
    expect(shared.amount).toBe(2); expect(shared.surplusLeftoverTip).toBeUndefined()
    expect(find(list({ course: 'dessert', recipe: recipe([['egg whites', 3, 'piece']]) }), 'Eggs').surplusLeftoverTip).toContain('3 leftover egg yolks')
  })
})

describe('multi-course aggregation', () => {
  it('sums English and Greek names across courses with unit conversion and keeps course traceability', () => {
    const plan = list(
      { course: 'appetizer', recipe: recipe([['onion', 1, 'piece'], ['flour', 200, 'g']], { title: 'Keftedes' }) },
      { course: 'main', recipe: recipe([['κρεμμύδια', 2, 'τεμ.'], ['αλεύρι', 0.5, 'κιλό']], { title: 'Stifado' }) },
      { course: 'dessert', recipe: recipe([['flour', 2, 'cup']], { title: 'Karydopita' }) }
    )
    expect(find(plan, 'onion')).toMatchObject({ amount: 3, unit: 'piece', section: 'laiki' })
    expect(find(plan, 'onion').usedIn.map(use => [use.course, use.name, use.amount])).toEqual([['appetizer', 'onion', 1], ['main', 'κρεμμύδια', 2]])
    const flour = items(plan).filter(item => item.usedIn.some(use => /flour|αλεύρι/.test(use.name)))
    expect(flour.map(item => [item.amount, item.unit])).toEqual([[700, 'g'], [473.18, 'ml']])
    expect(flour.every(item => item.note?.includes('another measure'))).toBe(true)
    expect(flour[0]!.packageSizeToBuy).toBe('1 × 1000 g bag')
  })
  it('scales each course to its requested servings before summing', () => {
    const soup = recipe([['lemon', 2, 'piece']], { servings: 4 })
    expect(find(list({ course: 'main', recipe: soup, servings: 8 }), 'lemon').amount).toBe(4)
    expect(find(list({ course: 'main', recipe: soup, servings: 2 }, { course: 'dessert', recipe: recipe([['λεμόνι', 1, '']]) }), 'lemon').amount).toBe(2)
  })
  it('never merges distinct items that only share a section group', () => {
    const plan = list({ course: 'main', recipe: recipe([['cumin', 1, 'tsp'], ['cinnamon', 1, 'tsp'], ['salt', 1, 'pinch'], ['salt', 2, 'pinch']]) })
    expect(items(plan).map(item => [item.name, item.amount, item.unit]).sort()).toEqual([['cinnamon', 4.93, 'ml'], ['cumin', 4.93, 'ml'], ['salt', 3, 'pinch']])
  })
  it('orders sections as laiki, chasapis, fournos, supermarket and omits empty ones', () => {
    const plan = list({ course: 'main', recipe: recipe([['feta', 200, 'g'], ['tomato', 3, 'piece'], ['ψωμί', 1, 'piece']]) })
    expect(plan.sections.map(section => [section.section, section.localizedName, section.storeType])).toEqual([
      ['laiki', 'Λαϊκή Αγορά', 'manavis_produce'], ['fournos', 'Φούρνος / Αρτοποιείο', 'fournos_bakery'], ['supermarket', 'Σούπερ μάρκετ', 'supermarket']
    ])
  })
  it('highlights advance preparation from steps and ingredient notes, and keeps item notes', () => {
    const plan = list(
      { course: 'appetizer', recipe: recipe([['chickpeas', 250, 'g', 'soaked overnight']], { title: 'Revithada' }) },
      { course: 'main', recipe: recipe([['γίγαντες', 500, 'g']], { title: 'Gigantes', steps: [{ instruction: 'Μουλιάστε τους γίγαντες από το βράδυ.' }, { instruction: 'Bake.' }] }) }
    )
    expect(plan.prepAlerts.map(alert => [alert.course, alert.recipeTitle, alert.text])).toEqual([
      ['appetizer', 'Revithada', 'chickpeas: soaked overnight'], ['main', 'Gigantes', 'Μουλιάστε τους γίγαντες από το βράδυ.']
    ])
    expect(find(plan, 'chickpeas').prepNotes).toEqual(['soaked overnight'])
  })
})

describe('POST /api/grocery/generate', () => {
  migrate(db, { migrationsFolder: fileURLToPath(new URL('../server/db/migrations', import.meta.url)) })
  const router = createRouter().post('/api/grocery/generate', generate)
  const handle = toWebHandler(createApp().use(csrf).use(router))
  const post = (body: unknown, origin = 'http://localhost') => handle(new Request('http://localhost/api/grocery/generate', { method: 'POST', headers: { Host: 'localhost', Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
  const meze = saveRecipe({ title: 'Tzatziki', description: '', servings: 4, ingredients: [{ name: 'Greek yogurt', amount: 400, unit: 'g' }, { name: 'cucumber', amount: 1, unit: 'piece' }, { name: 'garlic', amount: 2, unit: 'piece' }] })
  const main = saveRecipe({ title: 'Αρνί στη γάστρα', description: '', servings: 4, ingredients: [{ name: 'lamb shoulder', amount: 1400, unit: 'g' }, { name: 'garlic', amount: 4, unit: 'piece' }, { name: 'potatoes', amount: 1, unit: 'kg' }] })
  const sweet = saveRecipe({ title: 'Galaktoboureko', description: '', servings: 8, ingredients: [{ name: 'φύλλο κρούστας', amount: 300, unit: 'g' }, { name: 'milk', amount: 1, unit: 'l' }, { name: 'egg yolks', amount: 4, unit: 'piece' }] })
  it('rejects control characters in added drink names', async () => {
    expect((await post({ recipeIds: [meze.id], drinks: [{ name: 'wine\0' }] })).status).toBe(400)
  })

  it('persists thousands of distinct ingredients without exceeding SQLite parameter limits', async () => {
    const recipes = Array.from({ length: 8 }, (_, group) => saveRecipe({ title: `Large course ${group}`, description: '', ingredients: Array.from({ length: 500 }, (_, i) => ({ name: `Ingredient ${group * 500 + i}`, amount: 1, unit: 'g' })) }))
    const response = await post({ recipeIds: recipes.map(recipe => recipe.id) })
    expect(response.status).toBe(201)
    const body = await response.json()
    const stored = db.select().from(schema.groceryItems).where(eq(schema.groceryItems.listId, body.listId)).all()
    expect(stored).toHaveLength(4000)
    expect(new Set(stored.map(row => row.name)).size).toBe(4000)
    expect(body.destinations.flatMap((section: { items: unknown[] }) => section.items)).toHaveLength(4000)
  })

  it('aggregates a three-course menu into Greek market sections and persists the list', async () => {
    const response = await post({ courses: [{ recipeId: meze.id, course: 'appetizer' }, { recipeId: main.id, course: 'main', servings: 6 }, { recipeId: sweet.id, course: 'dessert' }], title: 'Sunday lunch' })
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.destinations.map((section: { section: string }) => section.section)).toEqual(['laiki', 'chasapis', 'fournos', 'supermarket'])
    const all = body.destinations.flatMap((section: { items: object[] }) => section.items)
    expect(all.find((item: { name: string }) => item.name === 'garlic')).toMatchObject({ amount: 8, usedIn: [{ course: 'appetizer', amount: 2 }, { course: 'main', amount: 6 }] })
    expect(all.find((item: { name: string }) => item.name === 'lamb shoulder').counterPhrase).toBe('2,1 κιλά αρνίσια σπάλα, κομμένη σε μερίδες για γάστρα')
    expect(all.find((item: { name: string }) => item.name === 'Eggs')).toMatchObject({ amount: 4, surplusLeftoverTip: expect.stringContaining('4 leftover egg whites') })
    const rows = db.select().from(schema.groceryItems).where(eq(schema.groceryItems.listId, body.listId)).all()
    expect(db.select().from(schema.groceryLists).where(eq(schema.groceryLists.id, body.listId)).get()?.title).toBe('Sunday lunch')
    expect(rows).toHaveLength(all.length)
    expect(rows.find(row => row.name === 'lamb shoulder')).toMatchObject({ storeDestination: 'chasapis_butcher', category: 'chasapis', recipeOriginId: main.id })
    expect(rows.find(row => row.name === 'garlic')).toMatchObject({ storeDestination: 'manavis_produce', recipeOriginId: null, courseBreakdown: JSON.stringify({ appetizer: 2, main: 6 }) })
    expect(rows.find(row => row.name === 'milk')).toMatchObject({ packageSizeToBuy: '1 × 1000 ml carton', surplusLeftoverTip: null })
  })
  it('accepts the documented menu shape and plain recipe ID lists', async () => {
    const menu = await (await post({ menu: { appetizerId: meze.id, dessertId: sweet.id }, servings: 8 })).json()
    expect(menu.title).toBe('Tzatziki · Galaktoboureko')
    expect(menu.destinations.flatMap((section: { items: { name: string, usedIn: { course: string }[] }[] }) => section.items).find((item: { name: string }) => item.name === 'Greek yogurt')).toMatchObject({ amount: 800, packageSizeToBuy: '1 × 1000 g tub' })
    expect((await post({ recipeIds: [main.id] })).status).toBe(201)
  })
  it('rejects invalid, unsupported, missing, and cross-origin requests without writing', async () => {
    const before = db.select().from(schema.groceryLists).all().length
    for (const body of [{}, { recipeIds: [] }, { menu: {} }, { recipeIds: [main.id], courses: [{ recipeId: main.id }] }, { recipeIds: [main.id], deductPantry: true }, { recipeIds: [main.id], region: 'us_standard' }, { courses: [{ recipeId: main.id, course: 'brunch' }] }, { recipeIds: [main.id], servings: 0 }]) {
      expect((await post(body)).status, JSON.stringify(body)).toBe(400)
    }
    expect((await post({ recipeIds: [main.id, 'missing'] })).status).toBe(404)
    expect((await post({ recipeIds: [main.id] }, 'https://evil.example')).status).toBe(403)
    expect(db.select().from(schema.groceryLists).all()).toHaveLength(before)
  })
})
