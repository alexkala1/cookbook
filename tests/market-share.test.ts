import { expect, it } from 'vitest'
import { decodeMarketPayload, encodeMarketPayload, formatWhatsAppMarketList, generateMarketQrSvg } from '../app/utils/market-share'
import type { MarketShoppingList } from '../app/utils/shopping-list'

const list: MarketShoppingList = {
  listId: 'market-1', title: 'Sunday 🥘',
  prepAlerts: [{ course: 'main', recipeId: 'r1', recipeTitle: 'Lamb', text: 'Marinate overnight.' }],
  destinations: [{ section: 'chasapis', name: 'Butcher', localizedName: 'Χασάπης', items: [
    { id: 'lamb', key: 'lamb', section: 'chasapis', name: 'Lamb', amount: 1.5, unit: 'kg', counterPhrase: 'Ενάμισι κιλό, παρακαλώ', packageSizeToBuy: '2 kg', usedIn: [], prepNotes: [] },
    { id: 'tomato', key: 'tomato', section: 'chasapis', name: 'Ντομάτες', amount: 2, unit: 'piece', usedIn: [], prepNotes: [] }
  ] }]
}

it('formats a WhatsApp list with preparation, checkmarks and counter details', () => {
  expect(formatWhatsAppMarketList(list, ['lamb'])).toBe([
    '🛒 *Sunday 🥘*', '', '⏱️ *Prepare Ahead*', '- *Lamb*: Marinate overnight.',
    '', '📍 *Butcher* (Χασάπης)', '[✓] 1.5 kg Lamb', '  💬 "Ενάμισι κιλό, παρακαλώ"',
    '  📦 Buy: 2 kg', '[ ] 2 piece Ντομάτες', '', '_Shared from Heirloom Cookbook_'
  ].join('\n'))
})

it('roundtrips the minimal Unicode payload and restores required list defaults', () => {
  const encoded = encodeMarketPayload(list)
  expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
  const restored = decodeMarketPayload(encoded)!
  expect(restored.title).toBe(list.title)
  expect(restored.listId).toBeTruthy()
  expect(restored.prepAlerts).toEqual([])
  expect(restored.destinations).toEqual(list.destinations)
  expect(encodeMarketPayload(restored)).toBe(encoded)
  expect(decodeMarketPayload(encoded)).toEqual(restored)
})

it('generates SVG QR markup with an SVG namespace and viewBox', () => {
  const svg = generateMarketQrSvg('https://example.com/market#' + encodeMarketPayload(list))
  expect(svg).toContain('<svg')
  expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
  expect(svg).toMatch(/viewBox="0 0 \d+ \d+"/)
  expect(svg).toContain('</svg>')
})

it('uses a fallback title and omits absent optional details', () => {
  expect(formatWhatsAppMarketList({ ...list, title: '', prepAlerts: [], destinations: [] }))
    .toBe('🛒 *Market Shopping List*\n\n_Shared from Heirloom Cookbook_')
  expect(formatWhatsAppMarketList(list)).toContain('[ ] 1.5 kg Lamb')
})

it('supports empty lists and multiple market destinations', () => {
  const empty = { ...list, title: '', prepAlerts: [], destinations: [] }
  expect(decodeMarketPayload(encodeMarketPayload(empty))).toMatchObject({ title: '', destinations: [] })
  const multiple: MarketShoppingList = { ...list, destinations: [...list.destinations, { section: 'laiki', name: 'Produce', localizedName: 'Λαϊκή', items: [] }] }
  expect(decodeMarketPayload(encodeMarketPayload(multiple))!.destinations).toEqual(multiple.destinations)
})

it.each(['', ' ', '!!!', 'a', 'abcd=', 'e30', '_w', 'bnVsbA', 'W10', 'bm90IGpzb24'])('rejects corrupt or incomplete payload %j safely', encoded => {
  expect(decodeMarketPayload(encoded)).toBeNull()
})

it.each([
  {}, { t: 1, d: [] }, { t: 'Market', d: {} },
  { t: 'Market', d: [{ s: 'invalid', n: 'Shop', l: 'Shop', i: [] }] },
  ...[{ id: 'x', n: 'Eggs', a: '2', u: 'item' }, { id: 'x', n: 'Eggs', a: -1, u: 'item' },
    { n: 'Eggs', a: 2, u: 'item' }, { id: 'x', n: 'Eggs', a: 2, u: 'item', c: 7 }, null]
    .map(item => ({ t: 'Market', d: [{ s: 'laiki', n: 'Shop', l: 'Shop', i: [item] }] }))
])('rejects malformed nested structures %j', payload => {
  expect(decodeMarketPayload(Buffer.from(JSON.stringify(payload)).toString('base64url'))).toBeNull()
})

it('preserves zero quantities and punctuation without mutating the source', () => {
  const copy = structuredClone(list)
  copy.destinations[0]!.items[0]!.amount = 0
  copy.title = 'Ντομάτες & "φέτα" 🛒'
  const before = structuredClone(copy)
  const restored = decodeMarketPayload(encodeMarketPayload(copy))!
  expect(restored.title).toBe(copy.title)
  expect(restored.destinations[0]!.items[0]!.amount).toBe(0)
  expect(copy).toEqual(before)
})
