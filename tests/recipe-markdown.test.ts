import { afterEach, expect, it, vi } from 'vitest'
import { downloadRecipeMarkdown, formatRecipeMarkdown, slugifyTitle } from '../app/utils/recipe-markdown'
import type { RecipeDetail } from '../shared/types/recipe'

const recipe = {
  title: 'Άρνί με Πατάτες', recipeType: 'food', cuisine: 'Greek', servings: 6,
  prepTimeMinutes: 20, cookTimeMinutes: 90, totalTimeMinutes: 110, difficulty: 'easy',
  description: 'Sunday dinner.', heirloomNotes: 'From Χίος.', storageReheating: 'Reheat gently.',
  ingredients: [{ amount: 200, unit: 'g', name: 'Φέτα', notes: 'crumbled' }],
  steps: [{ stepNumber: 1, instruction: 'Roast gently.', durationMinutes: 90 }],
  equipment: [{ name: 'Roasting pan', substituteTool: 'Oven dish' }]
} as RecipeDetail

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it.each([
  [' Sunday   Dinner! ', 'sunday-dinner'], ['Άρνί με Πατάτες', 'αρνι-με-πατατες'],
  ['Salt & Pepper / Soup', 'salt-pepper-soup'], ['', 'recipe'], ['!!!', 'recipe'], ['a--b', 'a-b']
])('slugifies %j as %s', (title, expected) => expect(slugifyTitle(title)).toBe(expected))

it('exports complete metadata and recipe sections while preserving Greek text', () => {
  expect(formatRecipeMarkdown(recipe)).toBe([
    '---', 'title: "Άρνί με Πατάτες"', 'type: "food"', 'cuisine: "Greek"',
    'servings: 6', 'prepTimeMinutes: 20', 'cookTimeMinutes: 90', 'totalTimeMinutes: 110',
    'difficulty: "easy"', '---', '', 'Sunday dinner.', '', '## Ingredients',
    '- 200 g Φέτα (crumbled)', '', '## Method', '1. Roast gently. (90 min)',
    '', '## Equipment', '- Roasting pan (Substitute: Oven dish)',
    '', '## Heirloom Notes', 'From Χίος.', '', '## Storage & Reheating', 'Reheat gently.', ''
  ].join('\n'))
})

it('handles null optional fields, zero as-needed amounts and missing equipment', () => {
  const minimal = { ...recipe, cuisine: null, description: '', heirloomNotes: null, storageReheating: null,
    ingredients: [{ amount: 0, unit: 'as needed', name: 'Salt', notes: null }],
    steps: [{ instruction: 'Season.', durationMinutes: null }], equipment: undefined } as unknown as RecipeDetail
  const text = formatRecipeMarkdown(minimal)
  expect(text).toContain('cuisine: ""\n')
  expect(text).toContain('- as needed Salt\n')
  expect(text).toContain('1. Season.\n')
  expect(text).not.toMatch(/undefined|null|## Equipment|## Heirloom|## Storage|0 as needed/)
})

it('escapes YAML quotes, backslashes and newlines and uses LF line endings', () => {
  const title = 'Yiayia "Eleni" \\ Χίος\n---\nservings: 999'
  const text = formatRecipeMarkdown({ ...recipe, title, description: 'First\r\nSecond\rThird' })
  const titleLine = text.split('\n')[1]!
  expect(JSON.parse(titleLine.slice('title: '.length))).toBe(title)
  expect(text.split('\n').filter(line => line === '---')).toHaveLength(2)
  expect(text).not.toContain('\r')
  expect(text).toContain('First\nSecond\nThird')
  expect(text.endsWith('\n')).toBe(true)
})

it('does nothing during server rendering', () => {
  vi.stubGlobal('window', undefined)
  vi.stubGlobal('document', undefined)
  expect(() => downloadRecipeMarkdown(recipe)).not.toThrow()
})

it('downloads a UTF-8 Markdown blob and cleans up the temporary link and URL', async () => {
  const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() }
  const appendChild = vi.fn()
  vi.stubGlobal('window', {})
  vi.stubGlobal('document', { createElement: vi.fn(() => anchor), body: { appendChild } })
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:recipe')
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  downloadRecipeMarkdown(recipe)
  expect(anchor.download).toBe('αρνι-με-πατατες.md')
  expect(anchor.href).toBe('blob:recipe')
  expect(anchor.click).toHaveBeenCalledOnce()
  expect(appendChild).toHaveBeenCalledWith(anchor)
  expect(anchor.remove).toHaveBeenCalledOnce()
  expect(revoke).toHaveBeenCalledWith('blob:recipe')
  const blob = create.mock.calls[0]![0] as Blob
  expect(blob.type).toBe('text/markdown;charset=utf-8')
  expect(await blob.text()).toBe(formatRecipeMarkdown(recipe))
})
