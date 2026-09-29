import { afterEach, expect, it, vi } from 'vitest'
import { createApp, createRouter, defineEventHandler, toWebHandler } from 'h3'
import url from '../server/api/ingest/url.post'
import video from '../server/api/ingest/video.post'
import prompt from '../server/api/ingest/prompt.post'
import ocr from '../server/api/ingest/ocr.post'
import { cardTitle, ingest, ingestSchema } from '../server/utils/ai/ingest'
import { safeFetch } from '../server/utils/ai/safe-fetch'
vi.mock('../server/utils/ai/safe-fetch', () => ({ safeFetch: vi.fn() }))
const handle = toWebHandler(createApp().use(createRouter().post('/url', url).post('/video', video).post('/prompt', prompt).post('/ocr', ocr)))
const request = (path: string, body: unknown, headers: Record<string, string> = {}) => handle(new Request('http://localhost/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }))
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })
const realSafeFetch = async () => (await vi.importActual<typeof import('../server/utils/ai/safe-fetch')>('../server/utils/ai/safe-fetch')).safeFetch
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
it('parses a structured video description offline instead of the one-step template', async () => {
  const description = 'Memberships are here! Hit the Join button.\nA glossy braise for Sunday. Serves 4.\n\nIngredients\n4 beef short ribs\n1.5 L beef stock\nSalt, to taste\n\nMethod\n1. Brown the ribs\nPreheat your oven to 140°C. Sear the ribs over medium-high heat.\n2. Braise\nAdd the stock, cover and transfer to the oven for 3½–4 hours.\n3. Rest\nRest for 30–45 minutes.'
  vi.mocked(safeFetch).mockResolvedValue('ytInitialPlayerResponse = ' + JSON.stringify({ videoDetails: { title: 'Short ribs', shortDescription: description } }) + ';')
  const draft = await (await request('video', { videoUrl: 'abcdefghijk' })).json()
  expect(draft.steps.map((step: { instruction: string }) => step.instruction.split('.')[0])).toEqual(['Brown the ribs', 'Braise', 'Rest'])
  expect(draft.steps.map((step: { durationMinutes?: number }) => step.durationMinutes ?? null)).toEqual([null, 210, 30])
  expect(draft.steps[1].instruction).toContain('(oven at 140°C)')
  expect(draft.ingredients.map((row: { amount: number, unit: string }) => `${row.amount} ${row.unit}`)).toEqual(['4 piece', '1.5 l', '0 as needed'])
  expect(draft.heirloomNotes).toBe('A glossy braise for Sunday. Serves 4.')
  expect(draft.description).toBe('A glossy braise for Sunday. Serves 4.')
})
it('keeps the offline template for unstructured sources', async () => {
  const draft = await (await request('prompt', { prompt: 'Grandma lemon chicken, roasted on Sundays' })).json()
  expect(draft.steps).toHaveLength(1)
  expect(draft.ingredients[0].notes).toContain('Deterministic baseline')
})

const scannedCard = 'Yiayia’s Koulourakia\nEaster butter cookies from the tin by the stove. Makes 40.\n\nIngredients\n250 g butter\n200 g sugar\n3 eggs\n1 kg flour\n\nMethod\n1. Cream\nBeat the butter and sugar until pale.\n2. Shape\nAdd the eggs and flour, then roll into twists.\n3. Bake\nBake at 180°C for 20 minutes until golden.'
const cardImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII='
const visionProviders = ['anthropic', 'gemini', 'openai', 'groq', 'ollama'] as const
const providerReply = (provider: string) => {
  const content = JSON.stringify({ title: 'Photographed cookies', description: '', ingredients: [{ name: 'flour', amount: 250, unit: 'g' }] })
  return provider === 'anthropic' ? { content: [{ type: 'text', text: content }] }
    : provider === 'gemini' ? { candidates: [{ content: { parts: [{ text: content }] } }] }
      : provider === 'ollama' ? { message: { content } } : { choices: [{ message: { content } }] }
}
it.each(visionProviders)('sends OCR image contracts to %s with and without text', async provider => {
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify(providerReply(provider))))
  vi.stubGlobal('fetch', fetchMock)
  for (const text of ['', scannedCard]) {
    const body = text ? { text, image: cardImage, mimeType: 'image/png' } : { image: `data:image/png;base64,${cardImage}`, mimeType: 'image/jpeg' }
    const response = await request('ocr', body, { 'x-byok-provider': provider, 'x-byok-key': 'test', 'x-byok-model': 'vision-test' })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ title: 'Photographed cookies', sourceType: 'handwritten_ocr', ingredients: [{ name: 'flour', amount: 250, unit: 'g' }] })
    const sent = JSON.parse(fetchMock.mock.calls.at(-1)![1]!.body as string)
    const prompt = text || 'Transcribe and normalize this recipe card.'
    if (provider === 'anthropic') expect(sent.messages[0]).toEqual({ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: cardImage } }, { type: 'text', text: prompt }] })
    else if (provider === 'gemini') expect(sent.contents).toEqual([{ parts: [{ inlineData: { mimeType: 'image/png', data: cardImage } }, { text: prompt }] }])
    else if (provider === 'ollama') expect(sent.messages[1]).toEqual({ role: 'user', content: prompt, images: [cardImage] })
    else expect(sent.messages[1]).toEqual({ role: 'user', content: [{ type: 'image_url', image_url: { url: `data:image/png;base64,${cardImage}` } }, { type: 'text', text: prompt }] })
  }
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
it.each(visionProviders)('preserves text-only OCR contracts for %s', async provider => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(providerReply(provider))))
  vi.stubGlobal('fetch', fetchMock)
  expect((await request('ocr', { text: scannedCard }, { 'x-byok-provider': provider, 'x-byok-key': 'test', 'x-byok-model': 'test' })).status).toBe(200)
  const sent = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)
  if (provider === 'gemini') expect(sent.contents).toEqual([{ parts: [{ text: scannedCard }] }])
  else expect(sent.messages.at(-1)).toEqual({ role: 'user', content: scannedCard })
})
it('defaults raw base64 to JPEG and returns vision provenance', async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(providerReply('openai'))))
  vi.stubGlobal('fetch', fetchMock)
  const inspect = toWebHandler(createApp().use(defineEventHandler(event => ingest(event, { kind: 'ocr', image: '/9j/2Q==' }))))
  const response = await inspect(new Request('http://localhost/', { headers: { 'x-byok-key': 'test', 'x-byok-model': 'test' } }))
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ provenance: 'Photographed recipe card / Vision AI', sourceText: '', mode: 'live' })
  const sent = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)
  expect(sent.messages[1].content[0].image_url.url).toBe('data:image/jpeg;base64,/9j/2Q==')
})
it('keeps image-only offline drafts deterministic without calling a provider', async () => {
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
  const first = await request('ocr', { image: cardImage, mimeType: 'image/png' })
  expect(first.status).toBe(200)
  const draft = await first.json()
  expect(draft.sourceType).toBe('handwritten_ocr')
  expect(await (await request('ocr', { image: cardImage, mimeType: 'image/png' })).json()).toEqual(draft)
  expect(fetchMock).not.toHaveBeenCalled()
})
it('validates optional OCR fields and the 10MB encoded image limit', async () => {
  for (const body of [{}, { text: '    ' }, { mimeType: 'image/png' }, { image: '' }, { image: ' ' }, { image: cardImage, text: 'x'.repeat(30001) }, { image: 'a'.repeat(10 * 1024 * 1024 + 1) }, { image: cardImage, mimeType: 'text/html' }]) {
    expect(ingestSchema.safeParse({ kind: 'ocr', ...body }).success).toBe(false)
  }
  expect(ingestSchema.safeParse({ kind: 'ocr', image: 'a'.repeat(10 * 1024 * 1024) }).success).toBe(true)
  expect(ingestSchema.safeParse({ kind: 'ocr', image: cardImage, text: 'abc' }).success).toBe(true)
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
  for (const image of ['https://example.com/card.png', 'data:image/png;base64,', 'data:text/html;base64,YQ==', 'not base64!']) {
    expect((await request('ocr', { image }, { 'x-byok-key': 'test', 'x-byok-model': 'test' })).status).toBe(400)
  }
  expect(fetchMock).not.toHaveBeenCalled()
})
it('turns scanned card text into a structured handwritten_ocr draft titled from its first line', async () => {
  const response = await request('ocr', { text: scannedCard })
  expect(response.status).toBe(200)
  const draft = await response.json()
  expect(draft).toMatchObject({ title: 'Yiayia’s Koulourakia', sourceType: 'handwritten_ocr', sourceUrl: null, description: 'Easter butter cookies from the tin by the stove. Makes 40.' })
  expect(draft.steps.map((step: { instruction: string }) => step.instruction.split('.')[0])).toEqual(['Cream', 'Shape', 'Bake'])
  expect(draft.ingredients.map((row: { amount: number, unit: string, name: string }) => `${row.amount} ${row.unit} ${row.name}`)).toEqual(['250 g butter', '200 g sugar', '3 piece eggs', '1 kg flour'])
  for (const field of ['imageUrl', 'rating', 'isFavorite']) expect(draft).not.toHaveProperty(field)
})
it('keeps untitled OCR text as a labelled offline draft and validates OCR length', async () => {
  const draft = await (await request('ocr', { text: 'mix flour water and salt then bake the bread' })).json()
  expect(draft.sourceType).toBe('handwritten_ocr')
  expect(draft.title).not.toBe('mix flour water and salt then bake the bread')
  expect((await request('ocr', { text: ' abc ' })).status).toBe(400)
  expect((await request('ocr', { text: 'x'.repeat(30001) })).status).toBe(400)
  expect(ingestSchema.safeParse({ kind: 'ocr', text: 'x'.repeat(30000) }).success).toBe(true)
  expect(ingestSchema.safeParse({ kind: 'ocr', prompt: 'Grandma chicken' }).success).toBe(false)
})
it.each([
  ['Yiayia’s Koulourakia\nIngredients', 'Yiayia’s Koulourakia'],
  ['## Spanakopita ##\n1 kg spinach', 'Spanakopita'],
  ['Only one line of text', ''],
  ['Ingredients\n250 g butter', ''],
  ['Υλικά\n250 γρ βούτυρο', ''],
  ['250 g butter\n200 g sugar', ''],
  ['Beat the butter until it turns pale and fluffy.\nThen add sugar', ''],
  ['Mom’s lemon chicken, the one we made every single Sunday afternoon\nChicken', '']
])('detects a recipe title on the first OCR line (%j)', (text, expected) => expect(cardTitle(text)).toBe(expected))
it('serves offline test fixtures through safeFetch only when test mode is on', async () => {
  const fetchFixture = await realSafeFetch()
  expect(await fetchFixture('https://fixtures.heirloom.test/recipe.html')).toContain('"@type":"Recipe"')
  expect(await fetchFixture('https://www.youtube.com/watch?v=TESTVIDEO11')).toContain('ytInitialPlayerResponse')
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('E2E_TEST', 'true')
  expect(await fetchFixture('https://fixtures.heirloom.test/recipe.html')).toContain('Fasolakia Ladera')
  vi.stubEnv('E2E_TEST', '')
  await expect(fetchFixture('https://fixtures.heirloom.test/recipe.html')).rejects.toMatchObject({ statusCode: 422 })
}, 15000)
it('imports the web and video fixtures end to end', async () => {
  vi.mocked(safeFetch).mockImplementation(await realSafeFetch())
  expect(await (await request('url', { url: 'https://fixtures.heirloom.test/recipe.html' })).json()).toMatchObject({
    title: 'Fasolakia Ladera', sourceType: 'url', sourceUrl: 'https://fixtures.heirloom.test/recipe.html', ingredients: expect.arrayContaining([expect.objectContaining({ name: 'green beans', amount: 500, unit: 'g' })])
  })
  const video = await (await request('video', { videoUrl: 'https://www.youtube.com/watch?v=TESTVIDEO11' })).json()
  expect(video).toMatchObject({ title: 'Patates Lemonates', sourceType: 'video', sourceUrl: 'https://www.youtube.com/watch?v=TESTVIDEO11' })
  expect(video.steps).toHaveLength(3)
  expect(video.ingredients).toHaveLength(6)
})
it('imports timed steps from a recipe page without JSON-LD', async () => {
  vi.mocked(safeFetch).mockResolvedValue(`<html><head><title>Fava · Blog</title></head><body><nav>Home</nav><article>
    <h1>Santorini Fava</h1><p>Silky split-pea purée from the island, served warm. Serves 6.</p>
    <h2>Ingredients</h2><ul><li>500 g yellow split peas</li><li>1 onion</li><li>100 ml olive oil</li></ul>
    <h2>Instructions</h2><ol><li>Rinse the split peas well.</li><li>Bring to a boil with the onion, skimming the foam.</li><li>Simmer for 45–50 minutes until soft.</li><li>Blend with the olive oil and rest for 10 minutes.</li></ol>
  </article></body></html>`)
  const draft = await (await request('url', { url: 'https://recipes.example/fava' })).json()
  expect(draft).toMatchObject({ title: 'Santorini Fava', servings: 6, sourceType: 'url' })
  expect(draft.ingredients.map((row: { amount: number, unit: string, name: string }) => `${row.amount} ${row.unit} ${row.name}`)).toEqual(['500 g yellow split peas', '1 piece onion', '100 ml olive oil'])
  expect(draft.steps.map((step: { durationMinutes: number | null, timerRequired: boolean, heatLevel?: string }) => [step.durationMinutes ?? null, step.timerRequired, step.heatLevel ?? null]))
    .toEqual([[null, false, null], [null, false, 'high'], [45, true, 'low'], [10, true, null]])
})
