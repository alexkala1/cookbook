import { defineEventHandler, readBody } from 'h3'
import { importBackup } from '../../utils/backup'
export default defineEventHandler(async event => importBackup(await readBody(event)))
