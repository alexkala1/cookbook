import { expect, it, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { repairTruncatedJson, sanitizeAiDraft } from '../server/utils/ai/sanitize-draft'
import { recipeCreateSchema } from '../server/utils/validation'

it.each([
  ['1/2', 0.5], ['1 1/2', 1.5], ['1,5', 1.5], ['½', 0.5], ['¼', 0.25], ['¾', 0.75], ['⅓', 1 / 3], ['⅔', 2 / 3], ['⅛', 0.125], ['2½', 2.5], ['1 1/2 cups', 1.5], ['1,5 κιλά', 1.5], ['0', 0]
])('preserves quantity %s as %s during draft cleanup', (amount, expected) => {
  const warn = vi.fn()
  const draft = recipeCreateSchema.parse(sanitizeAiDraft({ title: 'Soup', ingredients: [{ name: 'flour', amount, unit: 'cup' }] }, warn))
  expect(draft.ingredients![0]!.amount).toBe(expected)
  expect(warn).not.toHaveBeenCalled()
})
it.each([
  ['servings', '4-6', 4], ['servings', 'serves 4', 4], ['servings', '~4', 4],
  ['servings', 'serve 4', 4], ['servings', 'makes 4', 4], ['servings', 'make 4', 4], ['servings', 'for 4', 4],
  ['prepTimeMinutes', 'about 15', 15], ['prepTimeMinutes', '10-15 minutes', 10],
  ['cookTimeMinutes', 'approx. 15', 15], ['cookTimeMinutes', 'approx 15', 15],
  ['totalTimeMinutes', 'around 10–15 minutes', 10], ['totalTimeMinutes', '10 to 15 minutes', 10]
] as const)('parses %s value %s as %s', (field, value, expected) => {
  const warn = vi.fn()
  const draft = recipeCreateSchema.parse(sanitizeAiDraft({ title: 'Soup', [field]: value }, warn))
  expect(draft[field]).toBe(expected)
  expect(warn).not.toHaveBeenCalled()
})
it.each(['2-3', '2–3', '2 to 3', 'about 2-3', 'approx. 2', '~2'])('takes the lower ingredient quantity from %s', amount => {
  const warn = vi.fn()
  const draft = recipeCreateSchema.parse(sanitizeAiDraft({ title: 'Soup', ingredients: [{ name: 'salt', amount }] }, warn))
  expect(draft.ingredients![0]!.amount).toBe(2)
  expect(warn).not.toHaveBeenCalled()
})
it.each(['servings', 'prepTimeMinutes', 'cookTimeMinutes', 'totalTimeMinutes'] as const)('warns when %s cannot be parsed', field => {
  const warn = vi.fn()
  const draft = recipeCreateSchema.parse(sanitizeAiDraft({ title: 'Soup', [field]: 'unknown' }, warn))
  expect(draft[field]).toBe(field === 'servings' ? 1 : 0)
  expect(warn).toHaveBeenCalledWith(expect.stringContaining(field))
})
it('warns when a step duration cannot be parsed', () => {
  const warn = vi.fn()
  const draft = recipeCreateSchema.parse(sanitizeAiDraft({ title: 'Soup', steps: [{ instruction: 'Simmer', durationMinutes: 'unknown' }] }, warn))
  expect(draft.steps![0]!.durationMinutes).toBe(0)
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('durationMinutes'))
})
it.each(['-3', 'to taste', '1/0', '', 'garbage', undefined])('flags unreadable amount %s instead of guessing a quantity', amount => {
  const warn = vi.fn()
  const draft = recipeCreateSchema.parse(sanitizeAiDraft({ title: 'Soup', ingredients: [{ name: 'salt', amount, notes: 'Family note' }] }, warn))
  expect(draft.ingredients![0]).toMatchObject({ amount: 0, notes: 'Family note [Inferred by AI: amount unreadable]' })
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('salt'))
})
it.each([
  '{"title":"T","ingredients":[{"name":"a","amount":',
  '{"title":"T","ingredients":[{"name":"a",',
  '{"title":"T","description":"abc\\',
  '{"a":1,"b":tr', '{"a":1,"b":-', '{"a":1,"b"', '{"a":1,', '{"a":['
])('repairs dangling JSON tokens: %s', input => {
  expect(() => JSON.parse(repairTruncatedJson(input))).not.toThrow()
})
it('repairs every nonempty cut of a recipe containing escaped strings and numeric literals', () => {
  const sample = JSON.stringify({ title: 'Soup', description: 'A "quoted" \\ note', ingredients: [{ name: 'salt', amount: 0.5, unit: 'tsp' }, { name: 'water', amount: 1, unit: 'l' }], steps: [{ stepNumber: 1, instruction: 'Simmer.', timerRequired: true }], rating: null })
  for (let cut = 1; cut < sample.length; cut++) expect(() => JSON.parse(repairTruncatedJson(sample.slice(0, cut))), `cut ${cut}`).not.toThrow()
})
it('repairs 20,000 nested levels in linear time and bounds oversized inputs', () => {
  const script = `import { repairTruncatedJson } from './server/utils/ai/sanitize-draft.ts'; const d=20000; const s='[{"a":'.repeat(d)+'1'+'}]'.repeat(d-1)+'{"x":'; const start=performance.now(); const fixed=repairTruncatedJson(s); const elapsed=performance.now()-start; JSON.parse(fixed); console.log(elapsed);`
  const elapsed = Number(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { cwd: process.cwd(), timeout: 3000, encoding: 'utf8' }).trim())
  expect(elapsed).toBeLessThan(100)
  const large = '{"a":' + 'x'.repeat(300_000)
  expect(repairTruncatedJson(large)).toBe(large)
})
