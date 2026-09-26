import { defineEventHandler } from 'h3'
import { pantryMatches } from '../../utils/pantry'
export default defineEventHandler(() => pantryMatches())
