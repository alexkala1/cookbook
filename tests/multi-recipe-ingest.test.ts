import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineEventHandler, toWebHandler } from 'h3'
import { extractVideoChapters, ingest, parseTranscriptCues, windowTranscript } from '../server/utils/ai/ingest'
import { safeFetch } from '../server/utils/ai/safe-fetch'
import video from '../server/api/ingest/video.post'
import stream from '../server/api/ai/recipe/stream.post'
import { readRecipeStream } from '../app/utils/sse'

vi.mock('../server/utils/ai/safe-fetch', () => ({ safeFetch: vi.fn() }))
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals() })

const description = '00:00 Intro\n00:18 Peppercorn Sauce\n05:00 Sponsor\n05:32 Entrecote Sauce\n09:00 Taste Test\n10:00 Outro'
const captions = '<transcript><text start="0">Welcome intro</text><text start="18">Simmer peppercorns with cream.</text><text start="299">Finish peppercorn sauce.</text><text start="300">Buy sponsored mustard.</text><text start="332">Blend tarragon and butter.</text><text start="539">Serve entrecote sauce.</text><text start="540">Taste test both sauces.</text></transcript>'
function fixture(desc = description, transcript: string | null = captions) {
  const player = { videoDetails: { title: 'Sauce compilation', shortDescription: desc }, ...(transcript === null ? {} : { captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ languageCode: 'en', baseUrl: 'https://www.youtube.com/captions' }] } } }) }
  vi.mocked(safeFetch).mockResolvedValueOnce('ytInitialPlayerResponse = ' + JSON.stringify(player) + ';')
  if (transcript !== null) vi.mocked(safeFetch).mockResolvedValueOnce(transcript)
}
async function importVideo(headers: Record<string, string> = {}, kind: 'video' | 'url' = 'video') {
  const body = kind === 'url' ? { kind, url: 'https://youtu.be/MNcu0JX_EMI' } : { kind, videoUrl: 'MNcu0JX_EMI' }
  const handle = toWebHandler(createApp().use(defineEventHandler(event => ingest(event, body))))
  const response = await handle(new Request('http://localhost', { headers }))
  expect(response.status).toBe(200)
  return response.json()
}

describe('chapter boundaries', () => {
  it('parses timestamps and keeps utility chapters as boundaries only', () => {
    const chapters = extractVideoChapters(description)
    expect(chapters.filter(c => c.isRecipe).map(c => [c.title, c.startSeconds, c.endSeconds])).toEqual([
      ['Peppercorn Sauce', 18, 300], ['Entrecote Sauce', 332, 540]
    ])
    expect(chapters.filter(c => !c.isRecipe).map(c => c.title)).toEqual(['Intro', 'Sponsor', 'Taste Test', 'Outro'])
  })
  it('handles hours, CRLF, dash separators, sorting, duplicates and invalid seconds', () => {
    const chapters = extractVideoChapters('01:02:03 — Lemon Soup\r\n00:18 - Pepper Sauce\n00:18 Duplicate\n00:99 Invalid\n02:00 – Tomato Soup')
    expect(chapters.map(c => [c.title, c.startSeconds])).toEqual([['Pepper Sauce', 18], ['Tomato Soup', 120], ['Lemon Soup', 3723]])
  })
  it.each(['Introduction', 'Sponsored by a brand', 'Subscribe now', 'Taste Test', 'Credits', 'Outro'])('filters %s', title => {
    expect(extractVideoChapters(`00:00 ${title}`)[0]!.isRecipe).toBe(false)
  })
  it('keeps legitimate recipe titles containing utility words', () => {
    expect(extractVideoChapters('00:18 Introvert’s Tomato Soup')[0]!.isRecipe).toBe(true)
  })
  it('does not mistake cooking-method timestamps for separate recipes', () => {
    const chapters = extractVideoChapters('0:00 Intro\n0:30 Whisk the eggs into the flour\n2:10 Bake at 180C for 20 minutes')
    expect(chapters.filter(c => c.isRecipe)).toHaveLength(0)
    expect(extractVideoChapters('0:00 Roast Potatoes')[0]!.isRecipe).toBe(true)
  })
  it('windows half-open caption intervals without sponsors or later dishes', () => {
    const chapters = extractVideoChapters(description), cues = parseTranscriptCues(captions)
    expect(windowTranscript(cues, chapters[1]!)).toBe('Simmer peppercorns with cream. Finish peppercorn sauce.')
    expect(windowTranscript(cues, chapters[3]!)).toBe('Blend tarragon and butter. Serve entrecote sauce.')
  })
  it('reads timed-text milliseconds, entities and ignores missing/invalid timestamps', () => {
    expect(parseTranscriptCues('<timedtext><p t="18000"><s>salt &amp; pepper</s></p><p t="332000">butter</p><p>untimed</p><text start="bad">invalid</text><text start="-1">negative</text></timedtext>')).toEqual([
      { startSeconds: 18, text: 'salt & pepper' }, { startSeconds: 332, text: 'butter' }
    ])
  })
})

describe('multi-recipe backend contracts', () => {
  it('surfaces Groq trimming and salvage warnings across chapter drafts without duplicates', async () => {
    fixture('00:18 Peppercorn Sauce\n' + 'x'.repeat(9000) + '\n05:32 Entrecote Sauce')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '{"title":"Sauce","description":"Warm","steps":[{"instruction":"Simmer."}' } }] }))))
    const result = await importVideo({ 'x-byok-provider': 'groq', 'x-byok-key': 'test', 'x-byok-model': 'test' })
    expect(result.count).toBe(2)
    expect(result.warnings).toContain('Source notes were trimmed to fit Groq free-tier limits. Review final steps.')
    expect(result.warnings.filter((warning: string) => warning.includes('cut off by the model'))).toEqual(["The draft was cut off by the model's response limit. Review and complete the remaining steps."])
  })
  it.each(['video', 'url'] as const)('extracts separate offline %s drafts and deep links', async kind => {
    fixture()
    const result = await importVideo({}, kind)
    expect(result).toMatchObject({ isMulti: true, count: 2, captionsUnavailable: false })
    expect(result.recipe).toEqual(result.recipes[0])
    expect(result.recipes.map((r: { sourceUrl: string }) => r.sourceUrl)).toEqual(['https://www.youtube.com/watch?v=MNcu0JX_EMI&t=18s', 'https://www.youtube.com/watch?v=MNcu0JX_EMI&t=332s'])
    expect(result.recipes[0].heirloomNotes).toContain('peppercorns')
    expect(result.recipes[0].heirloomNotes).not.toMatch(/tarragon|sponsored|Taste test/)
    expect(result.recipes[1].heirloomNotes).toContain('tarragon')
    expect(result.recipes[1].heirloomNotes).not.toMatch(/peppercorn|sponsored|Taste test/)
  })
  it('sends only chapter-local ingredients and transcript to each AI call', async () => {
    fixture('00:18 Peppercorn Sauce\nIngredients\n2 tsp peppercorns\n05:32 Entrecote Sauce\nIngredients\n30 g tarragon')
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ title: 'Generated', description: '', ingredients: [], steps: [] }) } }] })))
    vi.stubGlobal('fetch', fetchSpy)
    await importVideo({ 'x-byok-key': 'test', 'x-byok-model': 'test' })
    const prompts = fetchSpy.mock.calls.map(call => JSON.parse((call as unknown as [string, RequestInit])[1].body as string).messages.at(-1).content)
    expect(prompts).toHaveLength(2)
    expect(prompts[0]).toContain('2 tsp peppercorns')
    expect(prompts[0]).not.toContain('tarragon')
    expect(prompts[1]).toContain('30 g tarragon')
    expect(prompts[1]).not.toContain('peppercorns')
  })
  it('parses independent structured description sections when captions are unavailable', async () => {
    fixture('00:18 Peppercorn Sauce\nIngredients\n2 tsp peppercorns\nMethod\n1. Simmer peppercorns.\n2. Serve the sauce.\n05:32 Entrecote Sauce\nIngredients\n30 g tarragon\nMethod\n1. Blend tarragon.\n2. Serve the sauce.', null)
    const result = await importVideo()
    expect(result.recipes[0].ingredients.map((i: { name: string }) => i.name)).toEqual(['peppercorns'])
    expect(result.recipes[1].ingredients.map((i: { name: string }) => i.name)).toEqual(['tarragon'])
    expect(result.captionsUnavailable).toBe(true)
    expect(result.warnings.join()).toContain('Timed captions are unavailable')
  })
  it('does not mix untimed captions or global description ingredients into chapters', async () => {
    fixture('Ingredients\n100 g global mustard\n' + description, '<transcript><text>Mix all sauces with shared mustard.</text></transcript>')
    const result = await importVideo()
    expect(result.isMulti).toBe(true)
    expect(result.recipes.every((r: { heirloomNotes: string }) => !r.heirloomNotes.includes('mustard'))).toBe(true)
    expect(result.warnings.join()).toContain('Timed captions are unavailable')
  })
  it('preserves single-video data and adds a one-recipe envelope', async () => {
    fixture('00:00 Intro\n00:18 Peppercorn Sauce\n05:00 Outro', captions)
    const result = await importVideo()
    expect(result).toMatchObject({ isMulti: false, count: 1, recipe: { title: 'Sauce compilation', sourceUrl: 'https://www.youtube.com/watch?v=MNcu0JX_EMI' } })
    expect(result.recipes).toEqual([result.recipe])
  })
  it('warns when timed captions do not cover every recipe chapter', async () => {
    fixture(description, '<transcript><text start="18">Simmer peppercorns.</text></transcript>')
    const result = await importVideo()
    expect(result.warnings.join()).toContain('Timed captions are unavailable for: Entrecote Sauce')
    expect(result.recipes[1].heirloomNotes).not.toContain('peppercorns')
  })
  it('uses Android fallback caption timestamps to keep recipes separate', async () => {
    const player = { videoDetails: { title: 'Compilation', shortDescription: description } }
    vi.mocked(safeFetch).mockResolvedValueOnce('ytInitialPlayerResponse = ' + JSON.stringify(player) + '; "INNERTUBE_API_KEY":"test_key"').mockResolvedValueOnce(captions)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ languageCode: 'en', baseUrl: 'https://www.youtube.com/captions' }] } } }))))
    const result = await importVideo()
    expect(result).toMatchObject({ count: 2, captionsUnavailable: false })
    expect(result.recipes[0].heirloomNotes).not.toContain('tarragon')
    expect(result.recipes[1].heirloomNotes).toContain('tarragon')
  })
  it('does not emit a partial completion when a later chapter provider request fails', async () => {
    fixture()
    const fetchSpy = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ title: 'Sauce', description: '' }) } }] }))).mockResolvedValueOnce(new Response('upstream failure', { status: 502 }))
    vi.stubGlobal('fetch', fetchSpy)
    const response = await toWebHandler(createApp().use(stream))(new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-byok-key': 'test', 'x-byok-model': 'test' }, body: JSON.stringify({ kind: 'video', videoUrl: 'MNcu0JX_EMI' }) }))
    const output = await response.text()
    expect(output).toContain('event: error')
    expect(output).not.toContain('event: complete')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
  it('exposes the batch in the video route while retaining legacy recipe fields', async () => {
    fixture()
    const response = await toWebHandler(createApp().use(video))(new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoUrl: 'MNcu0JX_EMI' }) }))
    const result = await response.json()
    expect(result).toMatchObject({ title: 'Peppercorn Sauce', isMulti: true, count: 2 })
    expect(result.recipe.title).toBe(result.title)
    expect(result.recipes).toHaveLength(2)
  })
  it('streams the full multi-recipe completion', async () => {
    fixture()
    const response = await toWebHandler(createApp().use(stream))(new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'video', videoUrl: 'MNcu0JX_EMI' }) }))
    const complete = vi.fn()
    await readRecipeStream(response, (event, data) => { if (event === 'complete') complete(data) })
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ isMulti: true, count: 2, recipes: expect.arrayContaining([expect.objectContaining({ title: 'Entrecote Sauce' })]) }))
  })
})
