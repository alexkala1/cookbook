import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { db } from '../../../db'
import { ingest } from '../../../utils/ai/ingest'
import { getRecipe, saveRecipe } from '../../../utils/recipes'
import { validate } from '../../../utils/validation'
import { isPlaceholderIngredients } from '../../../../shared/culinary/structured-recipe'

const requestSchema = z.object({
  url: z.string().trim().url().max(2000).refine(value => /^https?:\/\//i.test(value), 'Use an HTTP or HTTPS URL').optional()
}).strict()

export default defineEventHandler(async event => {
  const id = getRouterParam(event, 'id')!
  const original = getRecipe(id)
  const input = validate(requestSchema, await readBody(event))
  const url = input.url ?? original.sourceUrl
  if (!url) throw createError({ statusCode: 400, statusMessage: 'This recipe has no source URL. Enter a source URL first.' })
  const result = await ingest(event, { kind: 'url', url }, AbortSignal.timeout(60000))
  const draft = result.recipe
  if (!draft.ingredients?.length || !draft.steps?.length || isPlaceholderIngredients(draft.ingredients)
    || draft.steps.some(step => step.instruction.startsWith('Follow video for cooking method.'))) {
    throw createError({ statusCode: 422, statusMessage: 'Could not extract ingredients and a complete method. Try the full written recipe URL. Your saved recipe is unchanged.' })
  }
  const { isFavorite: _favorite, rating: _rating, heirloomNotes: _notes, storageReheating: _storage,
    originalSaltType: _salt, recipeType: _type, cuisine: _cuisine, difficulty: _difficulty, equipment, ...fields } = draft
  const recipe = db.transaction(tx => {
    // Parsing is asynchronous: a refresh must never overwrite an edit made while it was fetching.
    if (JSON.stringify(getRecipe(id, tx)) !== JSON.stringify(original)) {
      throw createError({ statusCode: 409, statusMessage: 'This recipe changed while the source was loading. Reload it before re-importing.' })
    }
    return saveRecipe({ ...fields, ...(equipment?.length ? { equipment } : {}) }, id, tx)
  })
  return { recipe, warnings: result.warnings }
})
