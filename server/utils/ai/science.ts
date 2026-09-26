import type { RecipeInput } from '../validation'

export function enrichScience(recipe: RecipeInput): RecipeInput {
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
    const poultry = /chicken|turkey|poultry|κοτόπουλ/i.test(recipe.title + ' ' + recipe.ingredients?.map(row => row.name).join(' '))
    if (poultry && /roast|bake|simmer|boil|stew/.test(text)) cues.internalTempTargetC = 74
    return { ...cues, ...Object.fromEntries(Object.entries(step).filter(([, value]) => value != null && value !== '')) } as typeof step
  }) }
}
