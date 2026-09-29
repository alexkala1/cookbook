import { defineEventHandler, setHeader } from 'h3'
import { exportBackup } from '../../utils/backup'

export default defineEventHandler(event => {
  const backup = exportBackup()
  setHeader(event, 'Content-Type', 'application/json')
  setHeader(event, 'Content-Disposition', `attachment; filename="heirloom-backup-${backup.exportedAt.slice(0, 10)}.json"`)
  setHeader(event, 'Cache-Control', 'no-store')
  return JSON.stringify(backup, null, 2)
})
