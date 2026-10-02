import { z } from 'zod'
import { createError } from 'h3'
import { photoMimeType } from './image'

export const clean = (schema: z.ZodString) => z.string().refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), 'Control characters are not allowed').pipe(schema)
export const visibleText = (schema: z.ZodString) => clean(schema).refine(value => /[\p{L}\p{N}]/u.test(value), 'Must contain a letter or digit')
const shortText = clean(z.string().trim().min(1).max(200))
const optionalText = clean(z.string().trim().max(10000)).nullable().optional()
const number = z.number().finite().nonnegative().max(1000000)
const minutes = number.int().max(100000)
const webUrl = clean(z.string().max(2000).url()).refine(value => /^https?:\/\//i.test(value), 'Use an HTTP or HTTPS URL').nullable().optional()
// A photographed recipe card is kept inline as a small JPEG/PNG/WebP data URL (the importer downsizes it first).
const cardPhoto = z.string().max(1_500_000).regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/).refine(value => {
  const [prefix, data] = value.split(',')
  return !!data && prefix === `data:${photoMimeType(data)};base64`
}, 'Use a JPEG, PNG or WebP photo')
const imageSource = z.union([webUrl, cardPhoto])
export const recipeTypes = ['food', 'drink', 'cocktail', 'baking', 'dessert'] as const
export const difficulties = ['easy', 'intermediate', 'advanced', 'master'] as const
export const saltTypes = ['table_salt', 'morton_kosher', 'diamond_crystal_kosher', 'greek_fine_sea_salt'] as const

const ingredient = z.object({
  name: shortText, amount: number, unit: clean(z.string().trim().min(1).max(40)),
  gramsEquivalent: number.nullable().optional(), category: shortText.optional(),
  notes: optionalText, sortOrder: number.int().optional()
}).strict()
const step = z.object({
  stepNumber: z.number().int().min(1).max(500), instruction: clean(z.string().trim().min(1).max(10000)),
  durationMinutes: minutes.nullable().optional(), timerRequired: z.boolean().optional(),
  heatLevel: z.enum(['none', 'low', 'medium-low', 'medium', 'medium-high', 'high']).nullable().optional(),
  scienceWhy: optionalText, failurePrevention: optionalText,
  sensoryVisual: optionalText, sensoryAudio: optionalText, sensoryAroma: optionalText, sensoryTexture: optionalText,
  internalTempTargetC: z.number().finite().min(-273.15).max(500).nullable().optional(),
  sortOrder: number.int().optional()
}).strict()
const equipment = z.object({ name: shortText, isEssential: z.boolean().optional(), substituteTool: optionalText }).strict()
const orderedSteps = z.array(step).max(500).refine(items => new Set(items.map(item => item.stepNumber)).size === items.length, 'Step numbers must be unique')

export const recipeCreateSchema = z.object({
  title: visibleText(z.string().trim().min(1).max(200)), description: clean(z.string().trim().max(10000)),
  recipeType: z.enum(recipeTypes).optional(),
  originalSaltType: z.enum(saltTypes).nullable().optional(),
  sourceUrl: webUrl, sourceType: z.enum(['url', 'video', 'prompt', 'handwritten_ocr', 'manual']).optional(),
  servings: z.number().int().min(1).max(1000).optional(),
  prepTimeMinutes: minutes.optional(), cookTimeMinutes: minutes.optional(), totalTimeMinutes: minutes.optional(),
  difficulty: z.enum(difficulties).optional(), cuisine: shortText.nullable().optional(),
  imageUrl: imageSource, heirloomNotes: optionalText, storageReheating: optionalText,
  isFavorite: z.boolean().optional(), rating: z.number().finite().min(1).max(5).nullable().optional(),
  ingredients: z.array(ingredient).max(500).optional(),
  steps: orderedSteps.optional(), equipment: z.array(equipment).max(100).optional()
}).strict()
export const recipeUpdateSchema = recipeCreateSchema.partial().refine(value => Object.keys(value).length > 0, 'Provide at least one field')
export const recipeQuerySchema = z.object({
  collection: z.enum(['quick', 'feast', 'easy']).optional(),
  search: z.string().trim().max(200).optional(),
  type: z.enum([...recipeTypes, 'drinks']).optional(),
  difficulty: z.enum(difficulties).optional(),
  cuisine: z.string().trim().max(200).optional(),
  isFavorite: z.enum(['true', 'false']).transform(value => value === 'true').optional()
}).strict()
export const kitchenProfileSchema = z.object({
  stoveType: z.enum(['gas', 'induction', 'electric_radiant']).optional(),
  ovenType: z.enum(['convection_fan', 'static_conventional']).optional(),
  hasMicrowave: z.boolean().optional(), hasAirFryer: z.boolean().optional(),
  hasInstantPot: z.boolean().optional(), hasCastIron: z.boolean().optional(), hasClayGastra: z.boolean().optional(),
  preferredSaltType: z.enum(saltTypes).optional()
}).strict().refine(value => Object.keys(value).length > 0, 'Provide at least one field')

export function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw createError({ statusCode: 400, statusMessage: 'Invalid request', data: { issues: result.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })) } })
  return result.data
}
export type RecipeInput = z.infer<typeof recipeCreateSchema>
