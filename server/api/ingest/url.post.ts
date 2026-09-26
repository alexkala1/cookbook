import { defineEventHandler, readBody } from 'h3'
import { ingest } from '../../utils/ai/ingest'
export default defineEventHandler(async event => (await ingest(event, { ...await readBody(event), kind: 'url' })).recipe)
