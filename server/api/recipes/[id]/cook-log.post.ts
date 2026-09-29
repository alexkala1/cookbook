import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { createCookLog } from '../../../utils/cook-logs'

export default defineEventHandler(async event => {
  const body = await readBody(event)
  const log = createCookLog(getRouterParam(event, 'id')!, body === undefined ? {} : body)
  setResponseStatus(event, 201)
  return log
})
