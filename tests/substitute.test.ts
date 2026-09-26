import { expect, it } from 'vitest'
import { createApp, toWebHandler } from 'h3'
import substitute from '../server/api/ai/substitute.post'
import { culinarySubstitutions, substitutionResponse } from '../server/utils/ai/substitute'
it.each(['butter', 'egg', 'lemon', 'milk'])('gives bounded scientific options for %s', name => {
  const result = substitutionResponse.parse(culinarySubstitutions(name))
  expect(result.options).toHaveLength(2)
  expect(result.options.every(option => option.adjustment && option.science && option.ratio)).toBe(true)
})
it('does not invent an offline substitution for unknown ingredients', () => expect(() => culinarySubstitutions('gelatin')).toThrow())
it('serves substitution HTTP requests and rejects malformed inputs', async () => {
  const handle = toWebHandler(createApp().use(substitute))
  const request = (body: unknown) => handle(new Request('http://localhost/api/ai/substitute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
  expect(await (await request({ ingredientName: 'butter', recipeContext: 'cake' })).json()).toMatchObject({ mode: 'fallback' })
  expect((await request({ ingredientName: '' })).status).toBe(400)
})
