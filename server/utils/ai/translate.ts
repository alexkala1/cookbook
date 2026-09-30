import { z } from 'zod'
import { createError } from 'h3'
import { recipeCreateSchema, type RecipeInput } from '../validation'

export const translationLanguages = [
  { code: 'el', label: 'Ελληνικά', name: 'Greek' },
  { code: 'en', label: 'English', name: 'English' },
  { code: 'es', label: 'Español', name: 'Spanish' },
  { code: 'fr', label: 'Français', name: 'French' },
  { code: 'it', label: 'Italiano', name: 'Italian' },
  { code: 'de', label: 'Deutsch', name: 'German' },
  { code: 'pt', label: 'Português', name: 'Portuguese' },
  { code: 'tr', label: 'Türkçe', name: 'Turkish' }
] as const
export type TranslationLanguage = typeof translationLanguages[number]['code']
export const translateRequest = z.object({
  recipe: recipeCreateSchema,
  targetLanguage: z.enum(translationLanguages.map(language => language.code)).default('el')
}).strict()

function textFields<T extends object>(source: T, translated: T, keys: readonly (keyof T)[]): T {
  const result = { ...source }
  for (const key of keys) {
    const original = source[key], replacement = translated[key]
    if (typeof original === 'string' && original.trim() && typeof replacement === 'string' && replacement.trim()) result[key] = replacement
  }
  return result
}
const numbers = (text: string) => JSON.stringify((text.match(/\d+(?:[.,]\d+)?/g) || []).sort())

export function enforceInvariants(source: RecipeInput, translated: RecipeInput): { recipe: RecipeInput, warnings: string[] } {
  for (const key of ['ingredients', 'steps', 'equipment'] as const) {
    if ((source[key]?.length || 0) !== (translated[key]?.length || 0)) throw createError({ statusCode: 502, statusMessage: 'Translation changed the recipe structure. Try again.' })
  }
  const result = textFields(source, translated, ['title', 'description', 'cuisine', 'heirloomNotes', 'storageReheating'])
  const warnings: string[] = []
  if (source.ingredients) result.ingredients = source.ingredients.map((item, index) => textFields(item, translated.ingredients![index]!, ['name', 'unit', 'notes', 'category']))
  if (source.steps) result.steps = source.steps.map((item, index) => {
    const step = textFields(item, translated.steps![index]!, ['instruction', 'scienceWhy', 'failurePrevention', 'sensoryVisual', 'sensoryAudio', 'sensoryAroma', 'sensoryTexture'])
    if (numbers(item.instruction) !== numbers(step.instruction)) warnings.push(`Step ${item.stepNumber}: numbers in the translated text differ from the original — please check.`)
    return step
  })
  if (source.equipment) result.equipment = source.equipment.map((item, index) => textFields(item, translated.equipment![index]!, ['name', 'substituteTool']))
  return { recipe: recipeCreateSchema.parse(result), warnings }
}
