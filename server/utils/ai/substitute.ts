import { z } from 'zod'
import { createError } from 'h3'
export const substitutionRequest = z.object({ ingredientName: z.string().trim().min(1).max(200), recipeContext: z.string().max(10000).default('') }).strict()
export const substitutionResponse = z.object({ options: z.array(z.object({ name: z.string().min(1).max(200), ratio: z.string().min(1).max(500), science: z.string().min(1).max(1000), adjustment: z.string().min(1).max(1000) }).strict()).min(2).max(3) }).strict()
const normalize = (name: string) => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const matches = {
  butter: /\bbutter\b|(?:^|[\s\p{P}])βουτυρο(?=$|[\s\p{P}])/u,
  egg: /\beggs?\b|(?:^|[\s\p{P}])αυγ[οα](?=$|[\s\p{P}])/u,
  lemon: /\blemon\b|(?:^|[\s\p{P}])λεμον(?:ι|ια|ιου)(?=$|[\s\p{P}])/u,
  lime: /\blime\b|(?:^|[\s\p{P}])λαιμ(?=$|[\s\p{P}])/u,
  vinegar: /\bvinegar\b|(?:^|[\s\p{P}])ξιδι(?=$|[\s\p{P}])/u,
  milk: /\bmilk\b|(?:^|[\s\p{P}])γαλα(?=$|[\s\p{P}])/u
}
const compounds = /\b(?:buttermilk|peanut[\s-]+butter|butternut[\s-]+squash|eggplant|milk[\s-]+chocolate|coconut[\s-]+milk)\b|(?:^|[\s\p{P}])αυγοταραχο(?=$|[\s\p{P}])/u
export function filterSubstitutions(name: string, result: z.infer<typeof substitutionResponse>) {
  const query = normalize(name).trim()
  const phrase = (value: string) => ' ' + (value.match(/[\p{L}\p{N}]+/gu) || []).join(' ') + ' '
  const options = result.options.filter(option => {
    const candidate = normalize(option.name).trim()
    const samePhrase = phrase(candidate).includes(phrase(query)) || phrase(query).includes(phrase(candidate))
    return !samePhrase && !Object.values(matches).some(pattern => pattern.test(query) && pattern.test(candidate))
  })
  if (options.length < 2) throw createError({ statusCode: 422, statusMessage: 'Not enough distinct substitutions for this ingredient. Try a more specific ingredient or another model.' })
  return { options }
}
export function culinarySubstitutions(name: string): z.infer<typeof substitutionResponse> {
  return filterSubstitutions(name, offlineOptions(normalize(name)))
}
function offlineOptions(name: string): z.infer<typeof substitutionResponse> {
  if (compounds.test(name)) throw createError({ statusCode: 422, statusMessage: 'This compound ingredient needs a specific substitution. Select a live model for contextual advice.' })
  if (matches.butter.test(name)) return { options: [
    { name: 'Olive oil', ratio: '80 g oil per 100 g butter in a moist cake.', science: 'Butter contains water and milk solids; oil is nearly all fat.', adjustment: 'Add about 15–20 g water or milk. Oil cannot trap air through creaming; unsuitable for laminated pastry.' },
    { name: 'Baking margarine', ratio: '1:1 by weight for an approximately 80% fat block.', science: 'A similar fat and water balance gives closer structure.', adjustment: 'Check fat and salt content. Avoid reduced-fat tubs.' }
  ] }
  if (matches.egg.test(name)) return { options: [
    { name: 'Ground flaxseed gel', ratio: '1 tbsp ground flaxseed + 3 tbsp water per egg in dense bakes.', science: 'Hydrated mucilage binds moisture but cannot reproduce egg protein foams.', adjustment: 'Rest until gelled. Expect denser texture; unsuitable for meringues or custards.' },
    { name: 'Unsweetened apple puree', ratio: 'About 60 g per egg in a moist cake.', science: 'Pectin and water add binding without egg protein structure.', adjustment: 'Reduce other liquid if batter is loose. Expect a softer, denser crumb; not a universal egg replacement.' }
  ] }
  if (matches.lemon.test(name) || matches.lime.test(name) || matches.vinegar.test(name)) return { options: [
    { name: 'Lemon juice', ratio: 'Start 1:1 by volume for flavor.', science: 'Citric acid adds sourness, with acidity that varies between fruits.', adjustment: 'Taste gradually and adjust the liquid balance. Not for preservation or canning.' },
    { name: 'Lime juice', ratio: 'Start 1:1 by volume for flavor.', science: 'Citric acid supplies sourness, though acidity varies.', adjustment: 'Taste gradually; aroma changes. Not for preservation or canning.' },
    { name: 'Mild vinegar', ratio: 'Start with half the volume, then adjust to taste.', science: 'Acetic acid has a different aroma and sharpness.', adjustment: 'Replace remaining liquid with water if needed. Not a validated preservation acidification rule.' }
  ] }
  if (matches.milk.test(name)) return { options: [
    { name: 'Unsweetened soy beverage', ratio: '1:1 by volume in sauces or simple bakes.', science: 'Soy proteins offer more structure than many plant beverages.', adjustment: 'Choose unsweetened; flavor and browning may change. Verify allergen labels.' },
    { name: 'Unsweetened oat beverage', ratio: '1:1 by volume in a sauce.', science: 'Starches can thicken while lower protein changes setting.', adjustment: 'Adjust thickness gradually; unsuitable as a direct substitute in protein-set recipes.' }
  ] }
  throw createError({ statusCode: 422, statusMessage: 'No reliable offline substitution. Select a live model or try butter, egg, milk, or lemon.' })
}
