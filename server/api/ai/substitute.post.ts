import { defineEventHandler, readBody } from 'h3'
import { aiClient } from '../../utils/ai/client'
import { requestSignal } from '../../utils/abort'
import { culinarySubstitutions, filterSubstitutions, substitutionRequest, substitutionResponse } from '../../utils/ai/substitute'
import { validate } from '../../utils/validation'
export default defineEventHandler(async event => {
  const signal = requestSignal(event)
  const input = validate(substitutionRequest, await readBody(event))
  const client = aiClient(event)
  const result = await client.generate(substitutionResponse, 'Suggest 2–3 distinct culinary substitutions excluding the queried ingredient, with ratios, scientific limitations, moisture and texture adjustments. Never guarantee allergen safety.', JSON.stringify(input), () => culinarySubstitutions(input.ingredientName), signal)
  return { ...filterSubstitutions(input.ingredientName, result), mode: client.mode }
})
