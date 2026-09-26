export const allergyOptions = ['gluten', 'dairy', 'nuts', 'shellfish', 'eggs', 'soy', 'fish', 'sesame'] as const
export const dietaryOptions = ['vegan', 'vegetarian', 'halal', 'kosher', 'pregnant'] as const
export interface GuestProfile { id?: string, name: string, allergies: string[], dietaryRestrictions: string[], dislikes: string[], notes?: string | null, profileWarnings?: string[] }
export interface Guest extends GuestProfile { id: string, createdAt: number, updatedAt: number }
export interface AuditRecipe { id: string, title: string, ingredients: { name: string, notes?: string | null }[] }
export interface DietaryConflict {
  type: 'critical_allergen' | 'dietary_conflict' | 'dislike_warning'
  guestId: string | null, guestName: string, recipeId: string, recipeTitle: string
  ingredient: string, restriction: string, message: string, crossContaminationWarning: string | null, substitutions: string[]
}
export interface DietaryAudit { conflicts: DietaryConflict[], reviewWarnings: string[], notice: string }
function normalize(value: string) { return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('el-GR').replace(/ς/g, 'σ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim() }
function has(text: string, terms: readonly string[]) { const value = ' ' + normalize(text) + ' '; return terms.some(term => value.includes(' ' + normalize(term) + ' ')) }
const terms: Record<string, string[]> = {
  gluten: ['wheat', 'flour', 'bread', 'breadcrumbs', 'pasta', 'couscous', 'semolina', 'bulgur', 'barley', 'rye', 'malt', 'beer', 'soy sauce', 'seitan', 'oats', 'σιταρι', 'αλευρι', 'ψωμι', 'φρυγανια', 'ζυμαρικα', 'κριθαρι', 'σιμιγδαλι', 'πλιγουρι'],
  dairy: ['milk', 'cream', 'butter', 'buttermilk', 'cheese', 'yogurt', 'yoghurt', 'feta', 'parmesan', 'whey', 'casein', 'ghee', 'pesto', 'γαλα', 'κρεμα', 'βουτυρο', 'τυρι', 'φετα', 'γιαουρτι', 'κεφαλοτυρι'],
  nuts: ['nuts', 'nut', 'peanut', 'peanuts', 'almond', 'almonds', 'walnut', 'walnuts', 'cashew', 'cashews', 'pistachio', 'pistachios', 'hazelnut', 'hazelnuts', 'pecan', 'pecans', 'macadamia', 'brazil nut', 'pine nuts', 'pesto', 'marzipan', 'φιστικια', 'φυστικια', 'αμυγδαλα', 'καρυδια', 'φουντουκια', 'κουκουναρι'],
  shellfish: ['shrimp', 'prawn', 'prawns', 'crab', 'lobster', 'crayfish', 'mussel', 'mussels', 'clam', 'clams', 'oyster', 'oysters', 'scallop', 'scallops', 'squid', 'octopus', 'γαριδα', 'γαριδες', 'καβουρι', 'αστακοσ', 'μυδια', 'καλαμαρι', 'χταποδι'],
  eggs: ['egg', 'eggs', 'eggwhite', 'albumen', 'mayonnaise', 'mayo', 'meringue', 'hollandaise', 'αυγο', 'αυγα', 'αβγο', 'αβγα', 'μαγιονεζα'],
  soy: ['soy', 'soya', 'soybean', 'soybeans', 'tofu', 'tempeh', 'miso', 'edamame', 'tamari', 'σόγια', 'τοφου'],
  fish: ['fish', 'salmon', 'tuna', 'cod', 'anchovy', 'anchovies', 'sardine', 'sardines', 'trout', 'worcestershire', 'ψαρι', 'σολομοσ', 'τονοσ', 'γαυροσ', 'σαρδελεσ'],
  sesame: ['sesame', 'tahini', 'halva', 'σουσαμι', 'ταχινι', 'χαλβασ']
}
const meat = ['meat', 'beef', 'pork', 'bacon', 'ham', 'pancetta', 'prosciutto', 'lard', 'chicken', 'turkey', 'lamb', 'veal', 'sausage', 'gelatin', 'gelatine', 'κρεασ', 'μοσχαρι', 'χοιρινο', 'κοτοπουλο', 'αρνι', 'μπεικον', 'ζελατινη', 'λουκανικο']
const pork = ['pork', 'bacon', 'ham', 'pancetta', 'prosciutto', 'lard', 'χοιρινο', 'μπεικον']
terms.gluten!.push('spelt', 'farro', 'orzo', 'rusk', 'rusks', 'παξιμαδι', 'παξιμαδια')
terms.dairy!.push('ricotta', 'brie', 'camembert', 'mozzarella', 'butterfat', 'caseinate', 'milk powder', 'βουτυρου', 'γαλακτοσ')
terms.nuts!.push('groundnut', 'groundnuts', 'αμυγδαλο', 'καρυδι', 'φιστικι', 'φυστικι', 'φουντουκι', 'κασιουσ')
terms.shellfish!.push('shrimps', 'γαριδων', 'καραβιδα', 'καραβιδεσ')
terms.eggs!.push('yolk', 'yolks', 'αυγων', 'αβγων')
terms.soy!.push('soymilk')
const alcohol = ['alcohol', 'wine', 'beer', 'vodka', 'rum', 'gin', 'whisky', 'whiskey', 'brandy', 'liqueur', 'bourbon', 'vermouth', 'κρασι', 'μπυρα', 'ουζο', 'τσιπουρο']
const aliases: Record<string, string> = { milk: 'dairy', lactose: 'dairy', peanuts: 'nuts', peanut: 'nuts', 'tree nuts': 'nuts', wheat: 'gluten', egg: 'eggs', soya: 'soy' }
function allergyKey(value: string) { const key = normalize(value); return Object.hasOwn(aliases, key) ? aliases[key]! : key }
export function ingredientAllergens(name: string): string[] {
  let dairyText = name
  // Exclude plant compounds without suppressing an additional real dairy ingredient.
  for (const phrase of ['coconut milk', 'almond milk', 'soy milk', 'soya milk', 'oat milk', 'rice milk', 'coconut cream', 'peanut butter', 'almond butter', 'cashew butter', 'cocoa butter']) dairyText = normalize(dairyText).replaceAll(normalize(phrase), '')
  const glutenText = normalize(name).replace(/\b(?:rice|corn|chickpea|almond|coconut|buckwheat) flour\b/g, '')
  return Object.entries(terms).filter(([key, words]) => has(key === 'dairy' ? dairyText : key === 'gluten' ? glutenText : name, words)).map(([key]) => key)
}
function dietaryReason(text: string, restriction: string, allergens: string[]): string | null {
  const animal = has(text, meat) || allergens.includes('fish') || allergens.includes('shellfish')
  if (restriction === 'vegan' && (animal || allergens.includes('dairy') || allergens.includes('eggs') || has(text, ['honey', 'μελι']))) return 'Contains an animal-derived ingredient; choose a plant-based alternative.'
  if (restriction === 'vegetarian' && animal) return 'Contains meat, seafood or animal gelatin.'
  if (restriction === 'halal' && (has(text, pork) || has(text, alcohol))) return 'Contains pork or alcohol; replace it and verify the guest’s requirements.'
  if (restriction === 'halal' && has(text, meat)) return 'Verify halal certification and preparation; the ingredient name cannot establish suitability.'
  if (restriction === 'kosher' && (has(text, pork) || allergens.includes('shellfish'))) return 'Pork or shellfish conflicts with kosher requirements.'
  if (restriction === 'kosher' && (animal || allergens.includes('dairy'))) return 'Verify kosher certification, meat/dairy separation and preparation with the guest.'
  if (restriction === 'pregnant') {
    if (has(text, alcohol)) return 'Contains alcohol; use an alcohol-free alternative rather than assuming cooking removes it.'
    if (has(text, ['unpasteurized', 'unpasteurised', 'raw milk', 'μη παστεριωμενο', 'ωμο γαλα'])) return 'Use a pasteurized alternative and check the product label.'
    if (allergens.includes('eggs')) return 'Verify safe cooking of eggs; for uncooked dishes use pasteurized eggs. Raw or undercooked eggs need replacement or thorough cooking.'
    if (allergens.includes('dairy') && has(text, ['cheese', 'feta', 'brie', 'camembert', 'τυρι', 'φετα'])) return 'Verify pasteurization and handling of cheese; follow current pregnancy food-safety guidance.'
    if (animal && has(text, ['raw', 'rare', 'sushi', 'tartare', 'smoked', 'deli', 'ωμο', 'ωμη', 'καπνιστο'])) return 'Raw, undercooked or refrigerated ready-to-eat animal foods require pregnancy-specific food-safety review.'
  }
  return null
}
const alternatives: Record<string, string[]> = {
  gluten: ['rice flour', 'corn flour'], dairy: ['olive oil', 'rice drink'], nuts: ['sunflower seeds'], shellfish: ['cooked chickpeas'], eggs: ['applesauce', 'ground flaxseed'], soy: ['cooked lentils'], fish: ['cooked chickpeas'], sesame: ['sunflower seeds']
}
function suggestions(restriction: string, people: GuestProfile[]): string[] {
  const candidates = Object.hasOwn(alternatives, restriction) ? alternatives[restriction]! : ['cooked lentils', 'olive oil', 'water']
  return candidates.filter(candidate => people.every(guest => {
    const allergens = ingredientAllergens(candidate)
    return !guest.allergies.some(item => allergens.includes(allergyKey(item)) || has(candidate, [item]))
      && !guest.dislikes.some(item => has(candidate, [item]))
      && !guest.dietaryRestrictions.some(item => dietaryReason(candidate, normalize(item), allergens))
  })).slice(0, 2).map(candidate => `Consider ${candidate} if appropriate for this recipe; verify its label and cross-contact risk with every guest. Adjust texture and quantities before serving.`)
}
export function auditDietary(recipes: AuditRecipe[], people: GuestProfile[]): DietaryAudit {
  const conflicts: DietaryConflict[] = [], reviewWarnings = new Set<string>()
  const substitutionCache = new Map<string, string[]>()
  const alternativesFor = (restriction: string) => {
    if (!substitutionCache.has(restriction)) substitutionCache.set(restriction, suggestions(restriction, people))
    return substitutionCache.get(restriction)!
  }
  for (const guest of people) {
    for (const warning of guest.profileWarnings ?? []) reviewWarnings.add(`${guest.name}: ${warning}`)
    for (const allergy of guest.allergies) if (!Object.hasOwn(terms, allergyKey(allergy))) reviewWarnings.add(`${guest.name}: ${allergy} is not in the ingredient dictionary; manually check every ingredient and label.`)
    for (const restriction of guest.dietaryRestrictions) if (!(dietaryOptions as readonly string[]).includes(normalize(restriction))) reviewWarnings.add(`${guest.name}: manually review ${restriction}.`)
  }
  for (const recipe of recipes) {
    if (!recipe.ingredients.length) reviewWarnings.add(`${recipe.title}: no ingredients recorded; cannot audit this recipe.`)
    for (const ingredient of recipe.ingredients) {
      const text = ingredient.name + ' ' + (ingredient.notes ?? ''), allergens = ingredientAllergens(text)
      for (const guest of people) {
        const add = (type: DietaryConflict['type'], restriction: string, message: string) => conflicts.push({ type, guestId: guest.id ?? null, guestName: guest.name, recipeId: recipe.id, recipeTitle: recipe.title, ingredient: ingredient.name, restriction, message,
          crossContaminationWarning: type === 'critical_allergen' ? 'Avoid shared utensils, boards, oils and preparation surfaces. Clean equipment, check package allergen statements and prepare the guest’s portion separately; removing visible pieces is insufficient.' : null,
          substitutions: type === 'dislike_warning' ? ['Omit only if the recipe still works, and confirm the replacement with the guest.'] : alternativesFor(restriction) })
        for (const allergy of new Set(guest.allergies.map(allergyKey))) if (allergens.includes(allergy) || (!Object.hasOwn(terms, allergy) && has(text, [allergy]))) add('critical_allergen', allergy, `Contains or may contain ${allergy}; confirm all components and do not serve until resolved.`)
        for (const restriction of new Set(guest.dietaryRestrictions.map(normalize))) { const reason = dietaryReason(text, restriction, allergens); if (reason) add('dietary_conflict', restriction, reason) }
        for (const dislike of new Set(guest.dislikes)) if (has(text, [dislike])) add('dislike_warning', dislike, `Guest prefers to avoid ${dislike}.`)
      }
    }
  }
  const priority = { critical_allergen: 0, dietary_conflict: 1, dislike_warning: 2 }
  return { conflicts: conflicts.sort((a, b) => priority[a.type] - priority[b.type]), reviewWarnings: [...reviewWarnings], notice: 'Ingredient-name screening is not a safety clearance. Check full labels, compound ingredients, cross-contact and each guest’s requirements. No detected conflict does not mean allergen-free. Substitutions are conditional suggestions, not guarantees.' }
}
