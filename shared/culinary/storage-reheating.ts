/** Safety references and the distinction between safety and texture heuristics: docs/plans/storage-reheating.md. */
export type StorageReheatingCategory = 'crispy' | 'braise_stew' | 'pasta_starch' | 'rice_grains' | 'soup_broth' | 'vegetable_ladera' | 'general'
export interface StorageReheatingRecipe {
  title: string
  recipeType?: string
  description?: string | null
  cuisine?: string | null
  tags?: readonly string[]
  ingredients?: readonly unknown[]
  steps?: readonly unknown[]
}
export interface StorageReheatingAdvice {
  category: StorageReheatingCategory
  fridgeLifeDays: number
  freezerFriendly: boolean
  freezerLifeMonths: number | null
  storageTips: string[]
  reheating: {
    appliance: 'oven' | 'air_fryer' | 'stovetop' | 'skillet' | 'microwave'
    /** Appliance setting, not the food's safe internal temperature. */
    targetTempC?: number
    /** Starting estimate only; check the food's centre with a thermometer. */
    durationMinutes?: number
    instructions: string
    doNotMicrowave?: boolean
    chemistryNote?: string
  }
}
export const storageReheatingLabels: Record<StorageReheatingCategory, string> = {
  crispy: 'Crispy pastry & fried foods', braise_stew: 'Braises & stews', pasta_starch: 'Pasta & starch',
  rice_grains: 'Rice & grains', soup_broth: 'Soups & broths', vegetable_ladera: 'Vegetables & ladera', general: 'Cooked leftovers'
}
const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ς/g, 'σ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const has = (text: string, pattern: string) => new RegExp(`(?:^|\\s)(?:${pattern})(?=\\s|$)`, 'u').test(text)
function field(value: unknown, key: string): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  const text = (value as Record<string, unknown>)[key]
  return typeof text === 'string' ? text : ''
}
const ricePattern = 'rice|pilaf|pilafi|spanakorizo|ρυζι|ρυζιου|ρυζο|πιλαφι|σπανακορυζο|σπανακοριζο'
const meatPattern = 'meat|beef|lamb|pork|chicken|poultry|turkey|veal|mince|minced meat|κρεασ|μοσχαρι|μοσχαρισιο|αρνι|αρνακι|χοιρινο|κοτοπουλο|κοτοσουπα|γαλοπουλα|κιμασ|κιμα'
const seafoodPattern = 'seafood|fish|salmon|tuna|cod|sea bass|bream|anchovies|crab|lobster|shrimp|shrimps|prawns?|mussels?|squid|octopus|θαλασσινα|ψαρι|ψαρια|ψαροσουπα|σολομοσ|γαριδεσ|γαριδα|μυδια|καλαμαρι|χταποδι'
const eggLemonPattern = 'avgolemono|egg lemon|αυγολεμονο|αβγολεμονο'

/** Drinks and cold salads do not benefit from cooked-leftover reheating advice. */
export function isStorageReheatingApplicable(recipe: StorageReheatingRecipe): boolean {
  return !['drink', 'cocktail'].includes(recipe.recipeType ?? '') && !has(normalize(recipe.title), 'salads?|σαλατα|σαλατεσ|smoothies?|σμουθι')
}

function classify(text: string): StorageReheatingCategory | null {
  // Named dishes outrank generic ingredients: giouvetsi contains pasta, avgolemono can contain rice.
  if (has(text, 'spanakopita|tiropita|phyllo|filo|pastr(?:y|ies)|baklava|bougatsa|σπανακοπιτα|τυροπιτα|φυλλο|μπακλαβασ|μπουγατσα')) return 'crispy'
  if (has(text, 'kokkinisto|stifado|giouvetsi|youvetsi|braised|braise stew|bean stews?|fasolada|gigantes|κοκκινιστο|στιφαδο|γιουβετσι|φασολαδα|γιγαντεσ')) return 'braise_stew'
  if (has(text, 'soups?|broth|avgolemono|egg lemon|σουπα|σουπεσ|ψαροσουπα|κοτοσουπα|ζωμοσ|αυγολεμονο|αβγολεμονο')) return 'soup_broth'
  if (has(text, 'gemista filling|filling for gemista|γεμιση για γεμιστα|γεμιση γεμιστων')) return 'rice_grains'
  if (has(text, 'briam|fasolakia|gemista|ladera|stuffed vegetables|μπριαμ|φασολακια|γεμιστα|λαδερα')) return 'vegetable_ladera'
  if (has(text, 'pastitsio|pasta|orzo|kritharaki|spaghetti|macaroni|παστιτσιο|ζυμαρικα|μακαρονια|κριθαρακι|ορζο')) return 'pasta_starch'
  if (has(text, ricePattern + '|grains?|quinoa|bulgur|κινοα|πλιγουρι')) return 'rice_grains'
  if (has(text, 'crispy|fried|roast(?:ed)? potatoes|τηγανητα|τηγανητεσ|πατατεσ φουρνου|τραγανο|τραγανα')) return 'crispy'
  if (has(text, 'stews?|braises?|stifado|μαγειρευτο|μαγειρευτα')) return 'braise_stew'
  return null
}

const safeCentre = 'Check that the centre reaches 74°C with a food thermometer; elapsed time alone is not a safety check.'
function reheating(category: StorageReheatingCategory, eggLemon: boolean): StorageReheatingAdvice['reheating'] {
  switch (category) {
    case 'crispy': return {
      appliance: 'oven', targetTempC: 190, durationMinutes: 8, doNotMicrowave: true,
      instructions: `Reheat uncovered in a preheated oven or air fryer at 190°C. Start checking small portions after 5–8 minutes; thick pies need longer. Do not microwave: the crust becomes soggy and rubbery. ${safeCentre}`,
      chemistryNote: 'Dry heat lets surface moisture escape, restoring crisp layers; trapped steam softens the crust.'
    }
    case 'braise_stew': return {
      appliance: 'stovetop', instructions: `Warm gently over low-medium heat, adding 2–3 tbsp water or broth. Stir through the centre until evenly hot. ${safeCentre}`,
      chemistryNote: 'Gelatin in meat braises softens as it warms; added liquid loosens gelatin- or starch-thickened sauces without drying the food.'
    }
    case 'pasta_starch': return {
      appliance: 'skillet', instructions: `Warm in a skillet over medium heat with a splash of water and a dab of butter (or olive oil). Toss gently to bring the sauce back together. For baked pasta such as pastitsio, use a covered oven at 175°C. ${safeCentre}`,
      chemistryNote: 'Water rehydrates chilled starch; gentle mixing helps fat and water re-emulsify into a coating sauce.'
    }
    case 'rice_grains': return {
      appliance: 'microwave', instructions: `Add 1–2 tbsp water per portion in a microwave-safe dish. Cover with a vented microwave-safe lid or damp paper towel to trap steam; stir midway, let stand briefly, and check several spots. Never put foil in the microwave. Reheat rice only once and eat immediately. ${safeCentre}`,
      chemistryNote: 'Steam restores moisture to chilled starch. Reheating cannot reliably remove toxins formed when rice was cooled or stored incorrectly.'
    }
    case 'soup_broth': return {
      appliance: 'stovetop', instructions: eggLemon
        ? `Warm gently on the stovetop, stirring constantly. Avoid aggressive boiling so the egg-lemon emulsion stays smooth. ${safeCentre}`
        : `Bring to a gentle simmer on the stovetop, stirring so the centre heats evenly. ${safeCentre}`,
      chemistryNote: eggLemon ? 'Egg proteins can clump and the emulsion can split under abrupt high heat; slow warming protects texture.' : 'Gentle stirring distributes heat through the liquid and any solid pieces.'
    }
    case 'vegetable_ladera': return {
      appliance: 'oven', targetTempC: 160,
      instructions: `Ladera tastes good briefly at room temperature after taking it from the fridge; keep total time out under 2 hours (1 hour above 32°C). To reheat, warm gently in an oven at 160°C, then add a fresh drizzle of extra virgin olive oil. ${safeCentre}`,
      chemistryNote: 'Gentle heat limits further softening of the vegetables; fresh olive oil restores aroma and a glossy finish.'
    }
    default: return {
      appliance: 'oven', targetTempC: 175,
      instructions: `For cooked leftovers, reheat covered in an oven at 175°C; add a little water if drying out. ${safeCentre} This generic method is not intended for uncooked dishes.`,
      chemistryNote: 'A cover retains moisture. Use the recipe’s own method when its texture needs more specific care.'
    }
  }
}

/** Deterministic advice for correctly cooked, rapidly chilled leftovers; never a guarantee for mishandled food. */
export function inferStorageReheating(recipe: StorageReheatingRecipe): StorageReheatingAdvice {
  const title = normalize(recipe.title)
  const tags = (recipe.tags ?? []).map(normalize)
  const description = normalize(recipe.description ?? '')
  const ingredientNames = (recipe.ingredients ?? []).map(value => normalize(field(value, 'name')))
  const ingredients = ingredientNames.join(' ')
  const method = normalize((recipe.steps ?? []).map(value => field(value, 'instruction')).join(' '))
  const titleCategory = classify(title)
  const descriptionCategory = classify(description)
  const category = titleCategory ?? tags.map(classify).find(value => value !== null) ?? descriptionCategory ?? classify(method) ?? 'general'
  // Ingredient names are actual recipe evidence; descriptions/methods can contain unrelated serving suggestions.
  const foodTags = tags.filter(tag => !['crispy', 'braise stew', 'pasta starch', 'rice grains', 'soup broth', 'vegetable ladera'].includes(tag))
  const food = `${title} ${foodTags.join(' ')} ${!titleCategory && descriptionCategory ? description : ''} ${ingredients}`
  // Preserve ingredient boundaries: separate Rice + Flour entries are not "rice flour".
  const riceSources = [title, ...foodTags, ...(!titleCategory && descriptionCategory ? [description] : []), ...ingredientNames]
  const rice = riceSources.some(source => has(source.replace(/rice (?:flour|vinegar|wine|paper|noodles)/g, '').replace(/(?:αλευρι|ξυδι) ρυζιου/g, ''), ricePattern)) || has(title, 'gemista filling|filling for gemista|γεμιση για γεμιστα|γεμιση γεμιστων')
  const seafood = has(food, seafoodPattern)
  const meat = has(food, meatPattern) || has(title, 'kokkinisto|stifado|κοκκινιστο|στιφαδο')
  const eggLemon = has(`${title} ${description} ${method}`, eggLemonPattern) || (has(ingredients, 'eggs?|αυγα|αυγο') && has(ingredients, 'lemons?|λεμονι|λεμονια') && category === 'soup_broth')
  const custard = has(`${title} ${ingredients}`, 'custard|κρεμα ζαχαροπλαστικησ') || has(title, 'bougatsa|μπουγατσα')
  const freezerFriendly = !eggLemon && !custard
  const storageTips = [
    'Divide into shallow portions and refrigerate promptly; do not wait for food to reach room temperature. Cover once chilled and use airtight containers.',
    'Keep the fridge at 4°C or colder. Refrigerate within 2 hours of cooking, or within 1 hour when the room is above 32°C.',
    'Label with the cooking date. Discard food left out beyond these limits; reheating cannot make improperly stored food safe.',
    'Reheat only the portion you will eat, once. Thaw frozen portions in the fridge and use within 24 hours.'
  ]
  if (rice) storageTips.push('Rice: cool in shallow portions and refrigerate or freeze within 1 hour. Use refrigerated rice within 24 hours and reheat only once.')
  if (category === 'crispy') storageTips.push('Keep pastry separate from wet sauces; reheat uncovered so steam can escape.')
  if (!freezerFriendly) storageTips.push('Freezing is not recommended for texture: egg-lemon emulsions or custard fillings can split or become watery.')
  else storageTips.push('Freeze in sealed portions at -18°C or colder. The suggested freezer time is for best texture, not a safety expiry.')
  return {
    category, fridgeLifeDays: rice ? 1 : seafood ? 2 : meat ? 3 : 4,
    freezerFriendly, freezerLifeMonths: freezerFriendly ? (rice || category === 'crispy' ? 1 : seafood ? 2 : 3) : null,
    storageTips, reheating: reheating(category, eggLemon)
  }
}
