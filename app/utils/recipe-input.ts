import type { RecipeDetail } from '../../shared/types/recipe'
import type { RecipeInput } from '../../server/utils/validation'

function pick<T, K extends keyof T>(value: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.map(key => [key, value[key]])) as Pick<T, K>
}

export function toRecipeInput(detail: RecipeDetail): RecipeInput {
  return {
    ...pick(detail, ['title', 'description', 'recipeType', 'originalSaltType', 'sourceUrl', 'sourceType', 'servings', 'prepTimeMinutes', 'cookTimeMinutes', 'totalTimeMinutes', 'difficulty', 'cuisine', 'imageUrl', 'heirloomNotes', 'storageReheating', 'isFavorite', 'rating']),
    ingredients: detail.ingredients.map(item => pick(item, ['name', 'amount', 'unit', 'gramsEquivalent', 'category', 'notes', 'sortOrder'])),
    steps: detail.steps.map(item => pick(item, ['stepNumber', 'instruction', 'durationMinutes', 'timerRequired', 'heatLevel', 'scienceWhy', 'failurePrevention', 'sensoryVisual', 'sensoryAudio', 'sensoryAroma', 'sensoryTexture', 'internalTempTargetC', 'sortOrder'])),
    equipment: detail.equipment.map(item => pick(item, ['name', 'isEssential', 'substituteTool']))
  }
}
