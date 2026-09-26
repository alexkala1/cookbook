import { afterEach, expect, it, vi } from 'vitest'
import { createApp, createRouter, toWebHandler } from 'h3'
import url from '../server/api/ingest/url.post'
import video from '../server/api/ingest/video.post'
import prompt from '../server/api/ingest/prompt.post'
import { safeFetch } from '../server/utils/ai/safe-fetch'
vi.mock('../server/utils/ai/safe-fetch', () => ({ safeFetch: vi.fn() }))
const handle = toWebHandler(createApp().use(createRouter().post('/url', url).post('/video', video).post('/prompt', prompt)))
const request = (path: string, body: unknown, headers: Record<string, string> = {}) => handle(new Request('http://localhost/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }))
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals() })
it.each(['prompt', 'url', 'video'])('removes hallucinated metadata from generated %s drafts', async kind => {
  const generated = { title: 'Chicken', description: '', originalSaltType: 'table_salt', imageUrl: 'https://invented.example/image.jpg', rating: 5, isFavorite: true, steps: [{ stepNumber: 1, instruction: 'Roast chicken', internalTempTargetC: 50 }] }
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(generated) } }] }))))
  vi.mocked(safeFetch).mockResolvedValue(kind === 'video' ? 'ytInitialPlayerResponse = ' + JSON.stringify({ videoDetails: { title: 'Chicken', shortDescription: 'Roast chicken' } }) + ';' : '<main>Roast chicken</main>')
  const body = kind === 'url' ? { url: 'https://recipes.example/chicken' } : kind === 'video' ? { videoUrl: 'abcdefghijk' } : { prompt: 'Grandma chicken recipe' }
  const response = await request(kind, body, { 'x-byok-key': 'test', 'x-byok-model': 'test' })
  expect(response.status).toBe(200)
  const draft = await response.json()
  expect(draft.originalSaltType).toBeNull()
  for (const field of ['imageUrl', 'rating', 'isFavorite']) expect(draft).not.toHaveProperty(field)
  expect(draft.steps[0].internalTempTargetC).toBe(74)
})
it.each([['morton_kosher', 'morton_kosher'], [undefined, null], ['unknown_salt', null]])('preserves only explicit valid JSON-LD salt specification (%s)', async (salt, expected) => {
  vi.mocked(safeFetch).mockResolvedValue('<script type="application/ld+json">' + JSON.stringify({ '@type': 'Recipe', name: 'Soup', originalSaltType: salt, image: 'https://recipes.example/soup.jpg', recipeIngredient: ['1 tsp salt'], recipeInstructions: ['Simmer.'] }) + '</script>')
  const draft = await (await request('url', { url: 'https://recipes.example/soup' })).json()
  expect(draft.originalSaltType).toBe(expected)
  expect(draft.imageUrl).toBe('https://recipes.example/soup.jpg')
})
it('returns an extracted recipe from the URL endpoint without discarding known measurements', async () => {
  vi.mocked(safeFetch).mockResolvedValue('<script type="application/ld+json">' + JSON.stringify({ '@type': 'Recipe', name: 'Soup', recipeIngredient: ['200 g beans'], recipeInstructions: ['Simmer beans.'] }) + '</script>')
  const response = await request('url', { url: 'https://recipes.example/soup' })
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ sourceType: 'url', sourceUrl: 'https://recipes.example/soup', ingredients: [{ name: 'beans', amount: 200, unit: 'g' }] })
})
it('normalizes captions and falls back to the description when captions fail', async () => {
  const html = 'ytInitialPlayerResponse = ' + JSON.stringify({ videoDetails: { title: 'Lemon chicken', shortDescription: 'Roast chicken with lemon' }, captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ languageCode: 'en', baseUrl: 'https://www.youtube.com/captions' }] } } }) + ';'
  vi.mocked(safeFetch).mockResolvedValueOnce(html).mockResolvedValueOnce('<transcript><text>Grandma lemon chicken</text></transcript>')
  expect(await (await request('video', { videoUrl: 'abcdefghijk' })).json()).toMatchObject({ sourceType: 'video', heirloomNotes: 'Grandma lemon chicken' })
  vi.mocked(safeFetch).mockResolvedValueOnce(html).mockRejectedValueOnce(new Error('Unavailable'))
  expect(await (await request('video', { videoUrl: 'abcdefghijk' })).json()).toMatchObject({ heirloomNotes: 'Roast chicken with lemon' })
})
it('reports unavailable video content and creates deterministic memory drafts', async () => {
  vi.mocked(safeFetch).mockResolvedValue('<html><title>- YouTube</title><meta name="description" content="Enjoy videos and music on YouTube"></html>')
  expect((await request('video', { videoUrl: 'abcdefghijk' })).status).toBe(422)
  const body = { prompt: 'Grandma’s lemon chicken' }
  const first = await (await request('prompt', body)).json()
  expect(first).toEqual(await (await request('prompt', body)).json())
  expect(first.ingredients.every((row: { notes: string }) => row.notes.includes('[Inferred by AI]'))).toBe(true)
  expect(first.steps[0].internalTempTargetC).toBe(74)
})
