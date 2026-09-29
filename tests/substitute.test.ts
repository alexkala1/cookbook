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
it.each([
  ['olive oil', 'Neutral vegetable oil'], ['Greek yogurt', 'Sour cream or labneh'],
  ['white wine', 'Broth with lemon or vinegar'], ['garlic', 'Garlic powder'], ['onion', 'Shallots'],
  ['ελαιόλαδο', 'Neutral vegetable oil'], ['γιαούρτι', 'Sour cream or labneh'],
  ['κρασί', 'Broth with lemon or vinegar'], ['σκόρδο', 'Garlic powder'], ['κρεμμύδι', 'Shallots']
])('provides distinct offline alternatives for %s', (name, first) => {
  const result = substitutionResponse.parse(culinarySubstitutions(name))
  expect(result.options).toHaveLength(2)
  expect(result.options[0]!.name).toBe(first)
  expect(filterSubstitutions(name, result)).toEqual(result)
})
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
it.each([
  ['olive oil', 'ελαιόλαδο'], ['Greek yogurt', 'γιαούρτι'], ['white wine', 'κρασί'],
  ['garlic', 'σκόρδο'], ['onion', 'κρεμμύδι'], ['ελαιόλαδο', 'Olive oil'],
  ['γιαούρτι', 'Greek yoghurt'], ['σκόρδο', 'Fresh garlic'], ['κρεμμύδι', 'Yellow onions']
])('removes self-suggestions and translated aliases for %s', (name, alias) => {
  const alternatives = culinarySubstitutions(name)
  const template = alternatives.options[0]!
  for (const self of [name, alias]) {
    expect(filterSubstitutions(name, { options: [{ ...template, name: self }, ...alternatives.options] })).toEqual(alternatives)
  }
})
it.each(['Garlic powder', 'Unsweetened plant yogurt'])('does not exempt %s from exact self-filtering', name => {
  const template = culinarySubstitutions('butter').options[1]!
  const alternatives = [{ ...template, name: 'Alternative A' }, { ...template, name: 'Alternative B' }]
  expect(filterSubstitutions(name, { options: [{ ...template, name }, ...alternatives] }).options).toEqual(alternatives)
})
it.each(['(ΕΛΑΙΟΛΑΔΟ)', 'olive-oil', 'yoghurt', 'γιαούρτι!', 'κρασί, λευκό', 'σκόρδα', 'κρεμμύδια'])('matches substitution boundaries in %s', name => {
  expect(substitutionResponse.safeParse(culinarySubstitutions(name)).success).toBe(true)
})
it.each(['oily', 'wineglass', 'oniongrass', 'σκορδοψωμο', 'γιαουρτοπιτα', 'ελαιολαδοπιτα'])('does not match ingredient substrings in %s', name => {
  expect(() => culinarySubstitutions(name)).toThrow()
})
it('serves substitution HTTP requests and rejects malformed inputs', async () => {
  const handle = toWebHandler(createApp().use(substitute))
  const request = (body: unknown) => handle(new Request('http://localhost/api/ai/substitute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
  expect(await (await request({ ingredientName: 'butter', recipeContext: 'cake' })).json()).toMatchObject({ mode: 'fallback' })
  expect((await request({ ingredientName: '' })).status).toBe(400)
})
