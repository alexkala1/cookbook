import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { aiClient } from '../../utils/ai/client'
import { requestSignal } from '../../utils/abort'
import { validate } from '../../utils/validation'
import { rescueTriage } from '../../../shared/culinary/rescue'

const requestSchema = z.object({ issueDescription: z.string().trim().min(3).max(3000), recipeContext: z.string().max(10000).default(''), currentStep: z.number().int().min(1).max(500).optional() }).strict()
const responseSchema = z.object({ title: z.string().min(1).max(200), actions: z.array(z.string().min(1).max(1200)).min(1).max(6), science: z.string().min(1).max(2000), caution: z.string().min(1).max(1200) }).strict()
export default defineEventHandler(async event => {
  const signal = requestSignal(event)
  const input = validate(requestSchema, await readBody(event))
  const client = aiClient(event)
  const advice = await client.generate(responseSchema, 'Give immediate culinary rescue steps, a short science explanation, and limits. Do not claim spoiled, contaminated or improperly stored food can be rescued. Potato does not selectively remove salt. Never scrape a burned pot into the food. Do not suggest shaking hot liquids in sealed vessels.', JSON.stringify(input), () => rescueTriage(input.issueDescription), signal)
  return { ...advice, mode: client.mode }
})
