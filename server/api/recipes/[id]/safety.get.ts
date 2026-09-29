import { defineEventHandler, getRouterParam } from 'h3'
import { auditDietary, ingredientAllergens } from '#shared/culinary/dietary'
import { getRecipe } from '../../../utils/recipes'
import { listGuests } from '../../../utils/guests'

export default defineEventHandler(event => {
  const recipe = getRecipe(getRouterParam(event, 'id')!)
  const ingredients = recipe.ingredients.map(({ name }) => ({ name }))
  const allergens = [...new Set(ingredients.flatMap(({ name }) => ingredientAllergens(name)))]
  // Reuse alias handling (milk -> dairy, wheat -> gluten) from the dietary engine.
  const audit = auditDietary([{ ...recipe, ingredients }], listGuests())
  const conflicts = audit.conflicts.filter(conflict => conflict.type === 'critical_allergen').map(conflict => ({
    guestId: conflict.guestId!, guestName: conflict.guestName,
    allergen: conflict.restriction, ingredient: conflict.ingredient
  }))
  return { allergens, conflicts }
})
