import { createError, defineEventHandler, readBody } from 'h3'
import { importBackup } from '../../utils/backup'
export default defineEventHandler(async event => {
  const body = await readBody(event)
  if ((JSON.stringify(body)?.length ?? 0) > 30_000_000) throw createError({ statusCode: 413, statusMessage: 'Backup payload exceeds 30 MB limit' })
  return importBackup(body)
})
