import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import ts from 'typescript'

// Exercise the page's actual handlers without recreating the surrounding Nuxt application.
const source = readFileSync(new URL('../app/pages/recipes/[id]/cook.vue', import.meta.url), 'utf8')
const finishSource = source.slice(source.indexOf('const finishDialog ='), source.indexOf('const fromOven ='))
function cooking(post: ReturnType<typeof vi.fn>) {
  const dialog = { open: false, showModal: vi.fn(function () { dialog.open = true }), close: vi.fn(function () { dialog.open = false }) }
  const randomUUID = vi.fn(() => '2ce37443-e48a-4e8e-ae0c-44ff3cd97435')
  const script = ts.transpileModule(finishSource, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const create = new Function('ref', '$fetch', 'crypto', 'stopSpeech', 'sessionStorage', 'navigateTo', `
    const id = 'soup', prepKey = 'prep', servings = { value: 4 }, servingsScaled = { value: false };
    ${script}
    return { finishDialog, finishState, finishError, deducted, rating, journalNote, finishCooking, finishWith };
  `)
  const page = create((value: unknown) => ({ value }), post, { randomUUID }, vi.fn(), { removeItem: vi.fn() }, vi.fn())
  page.finishDialog.value = dialog
  return { page, dialog, randomUUID }
}

it('keeps one finish key and saved journal when retrying a lost pantry response', async () => {
  let deductions = 0
  const post = vi.fn(async (url: string) => {
    if (url === '/api/pantry/deduct' && ++deductions === 1) throw new Error('Lost response')
    return { deducted: [{ name: 'Rice', amount: '100 g' }] }
  })
  const { page, dialog, randomUUID } = cooking(post)
  page.finishCooking()
  page.rating.value = 5
  page.journalNote.value = 'Good soup'
  await page.finishWith(true)
  expect(page.finishState.value).toBe('ask')
  dialog.close()
  page.finishCooking()
  expect(page.rating.value).toBe(5)
  expect(page.journalNote.value).toBe('Good soup')
  await page.finishWith(true)
  expect(post.mock.calls.filter(([url]) => url.endsWith('/cook-log'))).toHaveLength(1)
  expect(post.mock.calls.map(([, options]) => options.body.requestId)).toEqual(Array(3).fill(randomUUID.mock.results[0]!.value))
  expect(randomUUID).toHaveBeenCalledTimes(1)
  expect(page.finishState.value).toBe('done')
  dialog.close()
  page.finishCooking()
  await page.finishWith(true)
  expect(page.finishState.value).toBe('done')
  expect(page.deducted.value).toEqual([{ name: 'Rice', amount: '100 g' }])
  expect(post).toHaveBeenCalledTimes(3)
})

it('retains the same journal key after its response is lost', async () => {
  const post = vi.fn().mockRejectedValueOnce(new Error('Lost response')).mockResolvedValue({ deducted: [] })
  const { page } = cooking(post)
  page.finishCooking()
  await page.finishWith(true)
  expect(page.finishState.value).toBe('ask')
  page.finishCooking()
  await page.finishWith(true)
  expect(post.mock.calls[0]![1].body.requestId).toBe(post.mock.calls[1]![1].body.requestId)
})

it('ignores duplicate finish actions while saving and preserves busy state on reopen', async () => {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  const post = vi.fn().mockReturnValueOnce(pending).mockResolvedValue({ deducted: [] })
  const { page, dialog, randomUUID } = cooking(post)
  page.finishCooking()
  const saving = page.finishWith(true)
  page.finishCooking()
  await page.finishWith(true)
  expect(page.finishState.value).toBe('busy')
  expect(post).toHaveBeenCalledTimes(1)
  expect(dialog.showModal).toHaveBeenCalledTimes(1)
  expect(randomUUID).toHaveBeenCalledTimes(1)
  release()
  await saving
  expect(post).toHaveBeenCalledTimes(2)
})

it.each(['running', 'paused'])('does not duplicate an existing %s step timer', state => {
  const start = vi.fn()
  const offset = source.indexOf('function startStepTimer(')
  const handler = source.slice(offset, source.indexOf('\n}\n', offset) + 3)
  const script = ts.transpileModule(handler, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const startStepTimer = new Function('timers', 'start', `const index = { value: 0 }, durations = { value: [60] }; ${script}; return startStepTimer;`)({ value: [{ name: 'Step 1', state }] }, start)
  startStepTimer(60, 0)
  expect(start).not.toHaveBeenCalled()
})
