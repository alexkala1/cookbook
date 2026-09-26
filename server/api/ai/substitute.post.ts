import { defineEventHandler, readBody } from 'h3'
import { aiClient } from '../../utils/ai/client'
import { culinarySubstitutions, substitutionRequest, substitutionResponse } from '../../utils/ai/substitute'
import { validate } from '../../utils/validation'
export default defineEventHandler(async event => {
  const input = validate(substitutionRequest, await readBody(event))
  const client = aiClient(event)
  return { ...await client.generate(substitutionResponse, 'Suggest 2–3 culinary substitutions with ratios, scientific limitations, moisture and texture adjustments. Never guarantee allergen safety.', JSON.stringify(input), () => culinarySubstitutions(input.ingredientName)), mode: client.mode }
})
