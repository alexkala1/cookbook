import { defineEventHandler } from 'h3'
import { listGuests } from '../../utils/guests'
export default defineEventHandler(() => listGuests())
