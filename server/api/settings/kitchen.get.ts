import { defineEventHandler } from 'h3'
import { getKitchenProfile } from '../../utils/kitchen-profile'
export default defineEventHandler(() => getKitchenProfile())
