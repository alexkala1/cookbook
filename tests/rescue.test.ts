import { afterEach, expect, it, vi } from 'vitest'
import { createApp, toWebHandler } from 'h3'
import rescue from '../server/api/ai/rescue.post'
import csrf from '../server/middleware/csrf'
import { rescueTriage } from '../shared/culinary/rescue'
afterEach(() => vi.unstubAllGlobals())
it.each(['split sauce', 'oversalted soup', 'scorched pot', 'soggy sear', 'too acidic', 'too spicy', 'too bitter', 'too sweet', 'mystery texture'])('provides instant triage for %s', problem => {
  const advice = rescueTriage(problem)
  expect(advice.actions.length).toBeGreaterThanOrEqual(3)
  expect(advice.science).toBeTruthy(); expect(advice.caution).toBeTruthy()
})
it('debunks potato salt removal and forbids scraping the scorched bottom', () => {
  expect(rescueTriage('too salty').science).toContain('does not selectively extract salt')
  expect(rescueTriage('burnt pot').actions.join(' ')).toContain('without stirring or scraping')
  expect(rescueTriage('spoiled mayonnaise').title).toBe('Pause, isolate, and diagnose')
})
const handle = toWebHandler(createApp().use(csrf).use(rescue))
const request = (body: unknown, extra: Record<string, string> = {}) => handle(new Request('http://localhost/api/ai/rescue', { method: 'POST', headers: { Host: 'localhost', Origin: 'http://localhost', 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) }))
it('serves comprehensive fallback without a provider request', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  const response = await request({ issueDescription: 'too salty', recipeContext: 'bean soup', currentStep: 2 })
  expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ title: 'Too salty', mode: 'fallback' })
  expect(fetch).not.toHaveBeenCalled()
  expect((await request({ issueDescription: '' })).status).toBe(400)
  expect((await request({ issueDescription: 'too salty', currentStep: 0 })).status).toBe(400)
  expect((await request({ issueDescription: 'too salty' }, { Origin: 'https://evil.example' })).status).toBe(403)
})
it('supports BYOK and sanitizes failed provider calls', async () => {
  const headers = { 'x-byok-provider': 'openai', 'x-byok-model': 'test', 'x-byok-key': 'test-secret' }
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(rescueTriage('split sauce')) } }] }))))
  expect(await (await request({ issueDescription: 'split sauce' }, headers)).json()).toMatchObject({ mode: 'live', title: 'Split sauce / broken emulsion' })
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('test-secret') }))
  const failed = await request({ issueDescription: 'split sauce' }, headers)
  expect(failed.status).toBe(502); expect(await failed.text()).not.toContain('test-secret')
})
