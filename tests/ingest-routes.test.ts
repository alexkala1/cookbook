import { afterEach, expect, it, vi } from 'vitest'
import { createApp, createRouter, toWebHandler } from 'h3'
import url from '../server/api/ingest/url.post'
import video from '../server/api/ingest/video.post'
import prompt from '../server/api/ingest/prompt.post'
import { safeFetch } from '../server/utils/ai/safe-fetch'
vi.mock('../server/utils/ai/safe-fetch', () => ({ safeFetch: vi.fn() }))
const handle = toWebHandler(createApp().use(createRouter().post('/url', url).post('/video', video).post('/prompt', prompt)))
const request = (path: string, body: unknown) => handle(new Request('http://localhost/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
afterEach(() => vi.resetAllMocks())
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
