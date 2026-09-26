import { expect, it } from 'vitest'
import { createApp, toWebHandler } from 'h3'
import substitute from '../server/api/ai/substitute.post'
import { culinarySubstitutions, filterSubstitutions, substitutionResponse } from '../server/utils/ai/substitute'
it.each(['butter', 'egg', 'lemon', 'milk'])('gives bounded scientific options for %s', name => {
  const result = substitutionResponse.parse(culinarySubstitutions(name))
  expect(result.options).toHaveLength(2)
  expect(result.options.every(option => option.adjustment && option.science && option.ratio)).toBe(true)
})
it('does not invent an offline substitution for unknown ingredients', () => expect(() => culinarySubstitutions('gelatin')).toThrow())
it.each(['buttermilk', 'peanut butter', 'smooth PEANUT-BUTTER', 'butternut squash', 'eggplant', 'αυγοτάραχο', 'ΑΥΓΟΤΑΡΑΧΟ', 'milk chocolate', 'coconut milk', 'butterfly', 'milky', 'eggplants', 'βουτυροκρέμα', 'γαλακτομπούρεκο'])('does not confuse %s with a simple ingredient', name => {
  expect(() => culinarySubstitutions(name)).toThrow()
})
it.each(['(βούτυρο)', 'ΒΟΥΤΥΡΟ', 'φρέσκο αυγό', 'αυγά, χτυπημένα', 'γάλα!', 'χυμός λεμονιού', 'lemon juice', 'large eggs'])('matches whole ingredient words in %s', name => {
  expect(substitutionResponse.safeParse(culinarySubstitutions(name)).success).toBe(true)
})
it.each(['lime', 'lime juice', 'lemon juice', 'mild vinegar', 'white wine vinegar', 'λάιμ', 'λεμόνι', 'ξίδι'])('keeps two alternatives without suggesting %s itself', name => {
  const options = culinarySubstitutions(name).options
  expect(options).toHaveLength(2)
  const excluded = /lime|λάιμ/.test(name) ? 'Lime juice' : /vinegar|ξίδι/.test(name) ? 'Mild vinegar' : 'Lemon juice'
  expect(options.map(option => option.name)).not.toContain(excluded)
})
it('removes exact self-suggestions for otherwise unknown ingredients', () => {
  const options = culinarySubstitutions('butter').options
  expect(filterSubstitutions('OLIVE OIL', { options: [{ ...options[0]!, name: 'olive oil (extra virgin)' }, { ...options[1]!, name: 'Avocado oil' }, { ...options[1]!, name: 'Sunflower oil' }] }).options.map(option => option.name)).toEqual(['Avocado oil', 'Sunflower oil'])
})
it('serves substitution HTTP requests and rejects malformed inputs', async () => {
  const handle = toWebHandler(createApp().use(substitute))
  const request = (body: unknown) => handle(new Request('http://localhost/api/ai/substitute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
  expect(await (await request({ ingredientName: 'butter', recipeContext: 'cake' })).json()).toMatchObject({ mode: 'fallback' })
  expect((await request({ ingredientName: '' })).status).toBe(400)
})
