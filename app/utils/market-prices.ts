import type { PriceProduct } from '../../server/utils/market-prices'

export type PriceBadge = { text: string, label: string, retailer: string, price: number }

// Lowest single-retailer package price across the matched products; ties keep the first.
export function formatPriceBadge(products: readonly PriceProduct[]): PriceBadge | null {
  let best: { product: PriceProduct, retailer: PriceProduct['retailers'][number] } | null = null
  for (const product of products) for (const retailer of product.retailers) if (!best || retailer.price < best.retailer.price) best = { product, retailer }
  if (!best) return null
  const amount = best.retailer.price.toFixed(2)
  return {
    text: `${best.retailer.displayName} ${amount} €`,
    label: `Lowest price found: ${best.product.name} at ${best.retailer.displayName}, ${amount} euros (posokanei.gov.gr)`,
    retailer: best.retailer.retailer, price: best.retailer.price
  }
}
