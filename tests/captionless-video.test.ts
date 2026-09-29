import { afterEach, expect, it, vi } from 'vitest'
import { createApp, defineEventHandler, toWebHandler } from 'h3'
import { ingest } from '../server/utils/ai/ingest'
import { safeFetch } from '../server/utils/ai/safe-fetch'
import { recipeCreateSchema } from '../server/utils/validation'

vi.mock('../server/utils/ai/safe-fetch', () => ({ safeFetch: vi.fn() }))
afterEach(() => { vi.unstubAllGlobals(); vi.mocked(safeFetch).mockReset() })

const page = (player: object) => `<script>var ytInitialPlayerResponse = ${JSON.stringify(player)};</script>`
const description = 'Ingredients\n2 eggs\n200 g flour\n\n0:00 Intro\n0:30 Whisk the eggs into the flour\n2:10 Bake at 180C for 20 minutes'
const run = (headers: Record<string, string> = {}) =>
  toWebHandler(createApp().use(defineEventHandler(event => ingest(event, { kind: 'video', videoUrl: 'TESTVIDEO11' }))))(new Request('http://localhost/', { headers }))

it('flags captionless videos and tells a live model to synthesize from timestamps, tagging inferences', async () => {
  vi.mocked(safeFetch).mockResolvedValue(page({ videoDetails: { title: 'Easy Cake', shortDescription: description } }))
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ title: 'Easy Cake', description: '', ingredients: [{ name: 'flour', amount: 200, unit: 'g' }] }) } }] })))
  vi.stubGlobal('fetch', fetchMock)
  const result = await (await run({ 'x-byok-key': 'k', 'x-byok-model': 'm' })).json()
  expect(result).toMatchObject({ provenance: 'Video description & timestamps (captions unavailable)', captionsUnavailable: true })
  const system = JSON.parse(fetchMock.mock.calls[0]![1].body).messages[0].content as string
  expect(system).toContain('no captions track')
  expect(system).toContain('timestamp')
  expect(system).toContain('[Inferred from description]')
})

it('does not flag videos whose captions were read', async () => {
  vi.mocked(safeFetch)
    .mockResolvedValueOnce(page({ videoDetails: { title: 'Cake', shortDescription: description }, captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ languageCode: 'en', baseUrl: 'https://www.youtube.com/api/timedtext?v=x' }] } } }))
    .mockResolvedValueOnce('<transcript><text>Whisk two eggs with 200 g flour.</text></transcript>')
  const result = await (await run()).json()
  expect(result).toMatchObject({ provenance: expect.stringContaining('Video captions'), captionsUnavailable: false })
})

it('accepts a compact card photo as imageUrl but rejects other schemes', () => {
  const base = { title: 'Card', description: '', ingredients: [{ name: 'flour', amount: 1, unit: 'g' }], steps: [{ stepNumber: 1, instruction: 'Mix.' }] }
  expect(recipeCreateSchema.safeParse({ ...base, imageUrl: 'data:image/jpeg;base64,/9j/2Q==' }).success).toBe(true)
  for (const imageUrl of ['data:text/html;base64,YQ==', 'javascript:alert(1)', 'data:image/svg+xml;base64,YQ==', 'data:image/jpeg;base64,' + 'A'.repeat(1_500_001)]) {
    expect(recipeCreateSchema.safeParse({ ...base, imageUrl }).success).toBe(false)
  }
})
