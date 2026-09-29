import { renderSVG } from 'uqr'
import { z } from 'zod'
import { marketSections } from '#shared/culinary/grocery'
import type { MarketShoppingList } from './shopping-list'

const payloadSchema = z.object({
  t: z.string(),
  d: z.array(z.object({
    s: z.enum(marketSections), n: z.string(), l: z.string(),
    i: z.array(z.object({
      id: z.string().min(1), n: z.string(), a: z.number().finite().nonnegative(), u: z.string(),
      c: z.string().optional(), p: z.string().optional()
    }))
  }))
})

function base64Url(binary: string): string {
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function generateMarketQrSvg(transferUrl: string): string {
  return renderSVG(transferUrl)
}

export function encodeMarketPayload(list: MarketShoppingList): string {
  const payload = { t: list.title, d: list.destinations.map(d => ({
    s: d.section, n: d.name, l: d.localizedName,
    i: d.items.map(i => ({ id: i.id, n: i.name, a: i.amount, u: i.unit, c: i.counterPhrase, p: i.packageSizeToBuy }))
  })) }
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  return base64Url(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
}

export function decodeMarketPayload(encoded: string): MarketShoppingList | null {
  try {
    if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))
    if (base64Url(binary) !== encoded) return null
    const json = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, char => char.charCodeAt(0)))
    const parsed = payloadSchema.safeParse(JSON.parse(json))
    if (!parsed.success) return null
    return {
      listId: `shared:${encoded}`, title: parsed.data.t, prepAlerts: [],
      destinations: parsed.data.d.map(d => ({
        section: d.s, name: d.n, localizedName: d.l,
        items: d.i.map(i => ({
          id: i.id, key: i.id, section: d.s, name: i.n, amount: i.a, unit: i.u,
          counterPhrase: i.c, packageSizeToBuy: i.p, usedIn: [], prepNotes: []
        }))
      }))
    }
  } catch { return null }
}

export function formatWhatsAppMarketList(list: MarketShoppingList, checked: readonly string[] = []): string {
  const lines = [`🛒 *${list.title || 'Market Shopping List'}*`]
  if (list.prepAlerts.length) {
    lines.push('', '⏱️ *Prepare Ahead*')
    for (const alert of list.prepAlerts) lines.push(`- *${alert.recipeTitle}*: ${alert.text}`)
  }
  for (const destination of list.destinations) {
    lines.push('', `📍 *${destination.name}* (${destination.localizedName})`)
    for (const item of destination.items) {
      lines.push(`[${checked.includes(item.id) ? '✓' : ' '}] ${item.amount} ${item.unit} ${item.name}`)
      if (item.counterPhrase) lines.push(`  💬 "${item.counterPhrase}"`)
      if (item.packageSizeToBuy) lines.push(`  📦 Buy: ${item.packageSizeToBuy}`)
    }
  }
  lines.push('', '_Shared from Heirloom Cookbook_')
  return lines.join('\n')
}
