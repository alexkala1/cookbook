import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { saveMemory } from '../../../utils/memories'
export default defineEventHandler(async event => saveMemory(getRouterParam(event, 'id'), await readBody(event)))
