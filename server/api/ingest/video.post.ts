import { defineEventHandler, readBody } from 'h3'
import { ingest } from '../../utils/ai/ingest'
export default defineEventHandler(async event => {
  const result = await ingest(event, { ...await readBody(event), kind: 'video' })
  // Retain legacy recipe fields while exposing the full batch envelope.
  return { ...result.recipe, ...result }
})
