import { defineEventHandler, getQuery } from 'h3'
import { lookupPrices } from '../../utils/market-prices'

// Progressive enhancement: always HTTP 200, so a price hiccup can never break the shopping list.
export default defineEventHandler(async event => lookupPrices(getQuery(event).q))
