import { defineEventHandler, getRouterParam } from 'h3'
import { listCookLogs } from '../../../utils/cook-logs'

export default defineEventHandler(event => listCookLogs(getRouterParam(event, 'id')!))
