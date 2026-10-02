import { expect, it, vi } from 'vitest'
import { recipeCreateSchema } from '../server/utils/validation'
import { pantryInput } from '../server/utils/pantry'
import { guestProfileSchema } from '../server/utils/guests'
import { photoMimeType } from '../server/utils/image'
import { extractVideoChapters, parseTranscriptCues } from '../server/utils/ai/ingest'
import { normalizeGreekText } from '../server/utils/search'
vi.mock('../server/db', () => ({ db: {} }))

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX2kAAAAASUVORK5CYII='
it.each(['Nul\0Byte', 'text\u000b', '\u000cstart', 'text\u007f'])('rejects control characters before trimming: %s', value => {
  expect(recipeCreateSchema.safeParse({ title: value, description: '' }).success).toBe(false)
  expect(recipeCreateSchema.safeParse({ title: 'Soup', description: value }).success).toBe(false)
  expect(pantryInput.safeParse({ name: value }).success).toBe(false)
  expect(pantryInput.safeParse({ name: 'Rice', unit: value }).success).toBe(false)
  expect(guestProfileSchema.safeParse({ name: 'Guest', allergies: [value] }).success).toBe(false)
  expect(recipeCreateSchema.safeParse({ title: 'Soup', description: '', sourceUrl: `https://example.com/${value}` }).success).toBe(false)
})
it.each(['\u200b\u200b', '---'])('rejects titles and pantry names without visible letters, digits or pictographs: %s', value => {
  expect(recipeCreateSchema.safeParse({ title: value, description: '' }).success).toBe(false)
  expect(pantryInput.safeParse({ name: value }).success).toBe(false)
})
it.each(['🍕', '🍰🍰', '👻'])('accepts pictographic recipe titles: %s', value => {
  expect(recipeCreateSchema.safeParse({ title: value, description: '' }).success).toBe(true)
})
it('allows Greek names, digits and multiline notes', () => {
  expect(recipeCreateSchema.safeParse({ title: 'Σούπα 2', description: 'Line one\nLine two\tmore' }).success).toBe(true)
  expect(pantryInput.safeParse({ name: 'Ρύζι 2' }).success).toBe(true)
})
it.each(['aGVsbG8=', 'AAAA', 'R0lGODlh', Buffer.from('<svg/>').toString('base64'), png.slice(0, -1)])('rejects non-photo bytes and incomplete base64: %s', data => {
  expect(photoMimeType(data)).toBeNull()
  expect(recipeCreateSchema.safeParse({ title: 'Soup', description: '', imageUrl: `data:image/png;base64,${data}` }).success).toBe(false)
})
it('recognizes JPEG, PNG and WebP headers and checks declared recipe-photo MIME', () => {
  expect(photoMimeType('/9j/2Q==')).toBe('image/jpeg')
  expect(photoMimeType(png)).toBe('image/png')
  expect(photoMimeType(Buffer.from('RIFF1234WEBPdata').toString('base64'))).toBe('image/webp')
  expect(recipeCreateSchema.safeParse({ title: 'Soup', description: '', imageUrl: `data:image/png;base64,${png}` }).success).toBe(true)
  expect(recipeCreateSchema.safeParse({ title: 'Soup', description: '', imageUrl: `data:image/jpeg;base64,${png}` }).success).toBe(false)
})
it('folds final sigma consistently for capital and lower-case Greek search', () => {
  expect(normalizeGreekText('ΜΑΣ')).toBe(normalizeGreekText('μασ'))
  expect(normalizeGreekText('μας')).toBe(normalizeGreekText('μασ'))
})
it('prefers a recipe over utility chapters sharing the same timestamp', () => {
  expect(extractVideoChapters('0:00 Intro\n0:00 Pasta\n0:00 Second Pasta\n1:00 Outro').map(row => row.title)).toEqual(['Pasta', 'Outro'])
})
it('unescapes caption entities twice without treating text as markup', () => {
  expect(parseTranscriptCues('<transcript><text start="1">don&amp;#39;t &amp;quot;boil&amp;quot; &amp;lt;salt&amp;gt; &amp;#x3b1;</text></transcript>')[0]!.text).toBe('don\'t "boil" <salt> α')
})
