import { defineEventHandler, readBody } from 'h3'
import { savePantry } from '../../utils/pantry'
export default defineEventHandler(async event => savePantry(await readBody(event)))
