import { afterEach, expect, it, vi } from 'vitest'
import { createApp, toWebHandler } from 'h3'
import rescue from '../server/api/ai/rescue.post'
import csrf from '../server/middleware/csrf'
import { rescueGuides, rescueTriage, type RescueIssue } from '../shared/culinary/rescue'
afterEach(() => vi.unstubAllGlobals())
const mediterraneanCases: [string, RescueIssue][] = [
  ['curdled avgolemono', 'avgolemono'], ['my egg-lemon sauce split', 'avgolemono'],
  ['το αυγολέμονο έκοψε', 'avgolemono'], ['κομμένο αυγολεμονο', 'avgolemono'],
  ['ΕΚΟΨΕ ΤΟ ΑΥΓΟΛΕΜΟΝΟ', 'avgolemono'], ['το αβγολέμονο έχει κόψει', 'avgolemono'],
  ['lumpy béchamel', 'bechamel_lumpy'], ['my bechamel separated', 'bechamel_lumpy'],
  ['η μπεσαμέλ έχει σβόλους', 'bechamel_lumpy'], ['μπεσαμελ με κόμπους', 'bechamel_lumpy'],
  ['watery moussaka', 'moussaka_watery'], ['runny pastitsio', 'moussaka_watery'],
  ['ο μουσακάς έβγαλε νερά', 'moussaka_watery'], ['μουσακας πολύ υγρός', 'moussaka_watery'],
  ['το παστίτσιο είναι νερουλό', 'moussaka_watery'],
  ['dry roast lamb', 'dry_meat'], ['tough roast meat', 'dry_meat'], ['dried out beef', 'dry_meat'],
  ['το αρνί είναι στεγνό', 'dry_meat'], ['σκληρό αρνι', 'dry_meat'], ['το κρέας ξεράθηκε', 'dry_meat'],
  ['scorched garlic in oil', 'burnt_garlic'], ['burnt garlic', 'burnt_garlic'],
  ['κάηκε το σκόρδο στο λάδι', 'burnt_garlic'], ['καμένο σκορδο', 'burnt_garlic']
]
it.each(mediterraneanCases)('matches Mediterranean crisis: %s', (problem, issue) => {
  for (const text of [problem, problem.toUpperCase(), problem.normalize('NFD')]) {
    expect(rescueTriage(text)).toEqual(rescueGuides[issue])
  }
})
it.each(mediterraneanCases)('keeps unsafe signs ahead of dish-specific advice: %s', (problem) => {
  for (const unsafe of ['left out overnight', 'spoiled', 'χαλασμένο', 'μούχλα']) {
    expect(rescueTriage(`${problem}; ${unsafe}`)).toEqual(rescueGuides.unknown)
  }
})
it.each([
  ['avgolemono is too salty', 'salt'], ['béchamel is too sweet', 'sweet'],
  ['moussaka is too acidic', 'acid'], ['lamb is not salty enough', 'underseasoned'],
  ['garlic sauce split', 'emulsion'], ['burnt pot', 'scorch'],
  ['avgolemono', 'unknown'], ['μπεσαμέλ', 'unknown'], ['μουσακάς', 'unknown'],
  ['αρνί', 'unknown'], ['σκόρδο', 'unknown'], ['dry breadcrumbs', 'unknown'], ['dry roast potatoes', 'unknown'],
  ['curdled mayonnaise', 'emulsion']
] as [string, RescueIssue][])('preserves existing triage and avoids dish-only triggers: %s', (problem, issue) => {
  expect(rescueTriage(problem)).toEqual(rescueGuides[issue])
})
it('gives concrete rescue actions with accurate limits', () => {
  const actions = (issue: RescueIssue) => rescueGuides[issue].actions.join(' ')
  expect(actions('avgolemono')).toMatch(/off heat.*1-2 tbsp ice water or cold broth.*pasteurized yolk.*cold water/)
  expect(rescueGuides.avgolemono.science).toContain('cannot reverse protein coagulation')
  expect(actions('bechamel_lumpy')).toMatch(/off heat.*whisk vigorously.*fine mesh.*immersion blender.*warm milk/)
  expect(actions('moussaka_watery')).toMatch(/decant.*uncovered.*10-15 minutes.*20-30 minutes before slicing/)
  expect(rescueGuides.moussaka_watery.science).toContain('gelatinize during cooking')
  expect(actions('dry_meat')).toMatch(/across the grain.*warm seasoned stock.*olive oil, lemon, and oregano.*Steep/)
  expect(actions('burnt_garlic')).toMatch(/off heat.*Discard.*all of the affected oil.*wipe the pan clean/)
  expect(rescueGuides.burnt_garlic.science).toContain('allicin')
})
it('returns independent action arrays for deterministic repeated calls', () => {
  const first = rescueTriage('curdled avgolemono')
  first.actions.splice(0)
  expect(rescueTriage('curdled avgolemono')).toEqual(rescueGuides.avgolemono)
})
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
it.each([
  ['έκοψε το αυγολέμονο', 'avgolemono'], ['μπεσαμέλ με σβόλους', 'bechamel_lumpy'],
  ['μουσακάς με νερά', 'moussaka_watery'], ['στεγνό αρνί', 'dry_meat'], ['καμένο σκόρδο', 'burnt_garlic']
] as [string, RescueIssue][])('serves offline Mediterranean advice without a provider: %s', async (issueDescription, issue) => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  const response = await request({ issueDescription })
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ ...rescueGuides[issue], mode: 'fallback' })
  expect(fetch).not.toHaveBeenCalled()
})
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
