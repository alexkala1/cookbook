import { defineEventHandler, readBody } from 'h3'
import { saveGuest } from '../../utils/guests'
export default defineEventHandler(async event => saveGuest(await readBody(event)))
