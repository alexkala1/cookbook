import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { validate } from '../../utils/validation'
import { parseReceipt } from '../../../shared/culinary/pantry'
export default defineEventHandler(async event => {
  const body = validate(z.object({ text: z.string().trim().min(1).max(30000) }).strict(), await readBody(event))
  return { items: parseReceipt(body.text), notice: 'Review names, quantities, storage and estimated expiry dates before saving. Package dates take precedence; receipt text may contain non-food lines.' }
})
