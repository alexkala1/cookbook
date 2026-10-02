import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { z } from 'zod'
import { createCookLog, cookLogInputSchema } from '../../../utils/cook-logs'
import { validate } from '../../../utils/validation'
import { idempotent } from '../../../utils/idempotency'

const inputSchema = cookLogInputSchema.extend({ requestId: z.string().uuid().optional() })

export default defineEventHandler(async event => {
  const body = await readBody(event)
  const { requestId, ...input } = validate(inputSchema, body === undefined ? {} : body)
  const recipeId = getRouterParam(event, 'id')!
  const log = idempotent(`cook-log:${recipeId}`, requestId, () => createCookLog(recipeId, input))
  setResponseStatus(event, 201)
  return log
})
