import { defineEventHandler } from 'h3'
import { importBackup } from '../../utils/backup'
import { readJsonLimited } from '../../utils/body-limit'
export default defineEventHandler(async event => {
  const body = await readJsonLimited(event, 30_000_000)
  return importBackup(body)
})
