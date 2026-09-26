import { defineEventHandler, readBody } from 'h3'
import { dietaryAudit } from '../../utils/guests'
export default defineEventHandler(async event => dietaryAudit(await readBody(event)))
