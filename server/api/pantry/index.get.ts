import { defineEventHandler } from 'h3'
import { listPantry } from '../../utils/pantry'
export default defineEventHandler(() => listPantry())
