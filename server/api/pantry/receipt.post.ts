import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { validate } from '../../utils/validation'
import { parseReceipt } from '../../../shared/culinary/pantry'
export default defineEventHandler(async event => {
  const body = validate(z.object({ text: z.string().trim().min(1).max(30000) }).strict(), await readBody(event))
  return { items: parseReceipt(body.text), notice: 'Review names, quantities and storage before saving. Receipt text may contain non-food lines; expiry dates are not inferred.' }
})
