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
it.each([
  'bulging can of tomatoes tastes sour', 'soup is fizzy and sour after 3 days', 'oil smells rancid and bitter', 'there is mould on the cheese',
  'moldy bread', 'chicken smells off and slimy', 'yogurt is past its date and sour', 'rice left out overnight', 'fermented smell from the stew', 'expired cream curdled', 'worried about botulism in my garlic oil'
])('routes spoilage signs to the do-not-taste guide: %s', problem => {
  const advice = rescueTriage(problem)
  expect(advice.title).toBe('Pause, isolate, and diagnose')
  expect(advice.caution).toContain('Do not taste')
})
it.each(['soup is not salty enough', 'not spicy enough', 'sauce is not sweet enough', 'the stew is bland', 'needs more salt', 'tasteless beans', 'under-seasoned chicken'])('routes negated or bland problems to the under-seasoned guide: %s', problem => {
  expect(rescueTriage(problem).title).toBe('Bland / under-seasoned')
})
it('keeps excess symptoms and sauce splits distinct from lookalikes', () => {
  expect(rescueTriage('split peas are still hard').title).not.toBe('Split sauce / broken emulsion')
  expect(rescueTriage('my sauce split').title).toBe('Split sauce / broken emulsion')
  expect(rescueTriage('the dressing separated').title).toBe('Split sauce / broken emulsion')
  expect(rescueTriage('way too salty').title).toBe('Too salty')
  expect(rescueTriage('too spicy for the kids').title).toBe('Too spicy')
  expect(rescueTriage('turn off the heat, sauce is too sweet').title).toBe('Too sweet')
})
