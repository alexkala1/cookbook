import type { RecipeInput } from '../validation'

const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const poultryMeat = (value: string) => {
  // Remove the byproduct phrase rather than rejecting the entire name: a cut
  // described as "duck breast, fat trimmed" still needs poultry guidance.
  const text = normalize(value)
    .replace(/\b(?:chicken|turkey|poultry|duck|goose|geese|quail)\s+(?:stock|broth|bouillon|eggs?|fat)\b/g, '')
    .replace(/(?:ζωμ\p{L}*|αυγ\p{L}*|αβγ\p{L}*|λιπο\p{L}*)\s+(?:κοτοπουλ\p{L}*|κοτ(?:α|ας|ες|ων)|γαλοπουλ\p{L}*|παπι\p{L}*|χην\p{L}*|ορτυκ\p{L}*)/gu, '')
  return /(?:^|[^\p{L}])(?:chicken|turkey|poultry|duck|goose|geese|quail|κοτοπουλ\p{L}*|κοτ(?:α|ας|ες|ων)|γαλοπουλ\p{L}*|παπι\p{L}*|χην\p{L}*|ορτυκ\p{L}*)(?=$|[^\p{L}])/u.test(text)
}

export function enrichScience(recipe: RecipeInput): RecipeInput {
  // Draft ingredient lists may be incomplete, so the title remains a safety
  // signal. Both sources exclude recognizable stock/egg-only phrases.
  const poultry = poultryMeat(recipe.title) || recipe.ingredients?.some(row => poultryMeat(row.name))
  return { ...recipe, steps: recipe.steps?.map(step => {
    const text = step.instruction.toLowerCase()
    let cues: Partial<typeof step> = {}
    if (/sear|brown|roast|sauté|saute|fry/.test(text)) cues = {
      scienceWhy: 'Maillard reactions between amino acids and reducing sugars develop browned aromas on a relatively dry, hot surface.',
      sensoryVisual: 'Look for even browning rather than blackened edges.', sensoryAudio: /roast/.test(text) ? 'Listen for gentle sizzling around the edges.' : 'A steady sizzle, not violent spattering.', sensoryAroma: 'Toasted and savory, without an acrid smell.', sensoryTexture: 'A browned exterior; check the interior separately.',
      failurePrevention: 'Avoid crowding the pan. Color alone does not establish a safe internal temperature.'
    }
    else if (/whisk|emuls|shake/.test(text)) cues = {
      scienceWhy: 'Mechanical agitation disperses droplets and can incorporate air. Emulsifiers help oil and water remain dispersed.',
      sensoryVisual: 'An evenly mixed appearance.', sensoryTexture: 'Uniform rather than visibly separated.'
    }
    else if (/simmer|boil|stew/.test(text)) cues = {
      scienceWhy: 'Water transfers heat through convection; gentle simmering limits mechanical damage while ingredients soften.',
      sensoryVisual: 'Small bubbles breaking the surface for a simmer.', sensoryAudio: 'Gentle bubbling.', sensoryTexture: 'Check tenderness with a fork; cooking time varies with size.'
    }
    else if (/salt|brine/.test(text)) cues = { scienceWhy: 'Salt diffuses through available water; concentration gradients redistribute moisture over time. Taste before adding more.' }
    else if (/stir/.test(text)) cues = { scienceWhy: 'Stirring redistributes heat and dissolved ingredients. With ice, melting absorbs heat while adding dilution.', sensoryVisual: 'An evenly mixed liquid.' }
    // Poultry target: foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures.
    const enriched = { ...cues, ...Object.fromEntries(Object.entries(step).filter(([, value]) => value != null && value !== '')) } as typeof step
    if (poultry && /(?:^|[^\p{L}])(?:roast|bake|baking|simmer|boil|stew|sear|brown|saute|fry|fried|grill|poach|steam|cook|ψησ|ψην|βρασ|βραζ|σιγοβρα|τηγαν|σοταρ|μαγειρ|ροδισ|αχνισ)/u.test(normalize(text))) enriched.internalTempTargetC = Math.max(step.internalTempTargetC ?? 0, 74)
    return enriched
  }) }
}
