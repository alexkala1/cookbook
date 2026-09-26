import { defineEventHandler, getRouterParam } from 'h3'
import { listMemories } from '../../../utils/memories'
export default defineEventHandler(event => listMemories(getRouterParam(event, 'id')))
