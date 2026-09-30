import { z } from 'zod'
import { createError, type H3Event } from 'h3'
import { load } from 'cheerio'
import { aiClient } from './client'
import { safeFetch } from './safe-fetch'
import { extractHtml, extractJsonLd, extractPageRecipe, fallbackRecipe, structuredDraft } from './normalize'
import { enrichScience } from './science'
import { recipeCreateSchema, validate } from '../validation'

export const ingestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('url'), url: z.string().url().max(2000) }).strict(),
  z.object({ kind: z.literal('video'), videoUrl: z.string().min(1).max(2000), language: z.string().regex(/^[a-zA-Z-]{2,12}$/).optional() }).strict(),
  z.object({ kind: z.literal('prompt'), prompt: z.string().trim().min(5).max(20000) }).strict(),
  z.object({
    kind: z.literal('ocr'),
    text: z.string().trim().max(30000).optional(),
    image: z.string().trim().min(1).max(10 * 1024 * 1024).optional(),
    mimeType: z.string().regex(/^image\/[a-zA-Z0-9.+-]+$/).max(100).optional()
  }).strict().refine(value => (value.text?.length ?? 0) >= 5 || !!value.image, { message: 'Provide at least 5 characters of text or a recipe card image' })
])
// A scanned card usually opens with its name: a short line with no quantity, sentence punctuation or section heading.
export function cardTitle(text: string) {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
  const line = (lines[0] ?? '').replace(/^[#*\s]+|[#*\s]+$/g, '')
  if (lines.length < 2 || line.length < 3 || line.length > 80 || line.split(/\s+/).length > 8) return ''
  if (/[.,:;!?]$/.test(line) || /^[\d½¼¾⅓⅔⅛-]/.test(line) || /^(?:ingredients?|method|directions|instructions|steps|preparation|υλικά|εκτέλεση|οδηγίες)(?!\p{L})/iu.test(line)) return ''
  return line
}
export function youtubeId(input: string) {
  if (/^[\w-]{11}$/.test(input)) return input
  try {
    const url = new URL(input)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error()
    const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : ['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(url.hostname) ? url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})$/)?.[1] : null
    if (id && /^[\w-]{11}$/.test(id)) return id
  } catch { /* Invalid video source. */ }
  throw createError({ statusCode: 400, statusMessage: 'Use a YouTube video URL or 11-character ID' })
}
function playerData(html: string): Record<string, any> | null {
  const start = html.indexOf('ytInitialPlayerResponse = ')
  if (start < 0) return null
  const content = html.slice(start + 'ytInitialPlayerResponse = '.length)
  let depth = 0, quoted = false, escaped = false
  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false }
    else if (char === '"') quoted = true
    else if (char === '{') depth++
    else if (char === '}' && --depth === 0) { try { return JSON.parse(content.slice(0, i + 1)) } catch { return null } }
  }
  return null
}
export async function ingest(event: H3Event, input: unknown, signal?: AbortSignal, progress: (message: string) => void = () => {}) {
  const request = validate(ingestSchema, input)
  const client = aiClient(event)
  let source = '', title = '', sourceUrl: string | undefined, draftSource = ''
  let extracted: ReturnType<typeof extractPageRecipe> = null
  let provenance = 'Conversational memory'
  let image: { data: string, mimeType: string } | undefined
  let captionsUnavailable = false
  let task = 'Normalize a recipe from the source. Include ingredients, ordered steps, equipment, scienceWhy and sensory cues. Mark all inferred measurements. Do not invent a transcript.'
  progress('Reading the source')
  if (request.kind === 'prompt') source = request.prompt
  else if (request.kind === 'ocr') {
    source = request.text || ''
    title = cardTitle(source)
    // Offline drafts parse the card body; the model still reads the whole card.
    if (title) draftSource = source.slice(source.indexOf(title) + title.length).replace(/^[#*\s]+/, '')
    provenance = 'Scanned recipe card / OCR'
    if (request.image) {
      const prefix = request.image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/)
      const data = prefix ? request.image.slice(prefix[0].length) : request.image
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw createError({ statusCode: 400, statusMessage: 'Use a base64 recipe card image or image data URL' })
      image = { data, mimeType: prefix?.[1] || request.mimeType || 'image/jpeg' }
      provenance = 'Photographed recipe card / Vision AI'
    }
  }
  else if (request.kind === 'url' && !/^(?:https?:)?\/\/(?:[\w-]+\.)?(?:youtube\.com|youtu\.be)\//i.test(request.url)) {
    sourceUrl = request.url
    const html = await safeFetch(sourceUrl, signal)
    // Complete schema.org metadata is used as-is; page lists only supplement incomplete metadata.
    const jsonLd = extractJsonLd(html)
    const complete = !!(jsonLd?.ingredients?.length && jsonLd.steps?.length)
    extracted = complete ? jsonLd : extractPageRecipe(html)
    const plain = extractHtml(html); source = plain.text; title = plain.title
    provenance = complete ? 'Recipe JSON-LD' : extracted ? 'Recipe metadata & page lists' : 'Page text'
  } else {
    const videoTarget = request.kind === 'video' ? request.videoUrl : request.url
    sourceUrl = 'https://www.youtube.com/watch?v=' + youtubeId(videoTarget)
    const html = await safeFetch(sourceUrl, signal)
    const player = playerData(html)
    // Generic YouTube error/consent pages also have a description meta tag.
    // Only video-specific player data counts as a recipe source.
    title = player?.videoDetails?.title || ''
    source = player?.videoDetails?.shortDescription || ''
    if (player?.playabilityStatus?.status && player.playabilityStatus.status !== 'OK') source = ''
    provenance = 'Video description & timestamps (captions unavailable)'
    captionsUnavailable = true
    draftSource = source
    const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks
    const track = Array.isArray(tracks) ? tracks.find(item => item.languageCode === ((request.kind === 'video' ? request.language : undefined) || 'en')) || tracks[0] : undefined
    if (track?.baseUrl) {
      try {
        const captions = await safeFetch(track.baseUrl, signal)
        const $ = load(captions, { xml: true })
        const transcript = $('text, p').map((_i, el) => $(el).text()).get().join(' ')
        if (transcript.trim()) { source = transcript; provenance = 'Video captions'; captionsUnavailable = false }
      } catch { if (signal?.aborted) throw createError({ statusCode: 499, statusMessage: 'Cancelled' }) }
    }
    if (captionsUnavailable) {
      const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/)
      const videoId = youtubeId(videoTarget)
      if (apiKeyMatch?.[1] && videoId) {
        try {
          const androidResp = await (await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKeyMatch[1]}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
              videoId
            }),
            signal
          })).json()
          const androidTracks = androidResp?.captions?.playerCaptionsTracklistRenderer?.captionTracks
          const androidTrack = Array.isArray(androidTracks) ? androidTracks.find(item => item.languageCode === ((request.kind === 'video' ? request.language : undefined) || 'en')) || androidTracks[0] : undefined
          if (androidTrack?.baseUrl) {
            const captions = await safeFetch(androidTrack.baseUrl, signal)
            const $ = load(captions, { xml: true })
            const transcript = $('text, p').map((_i, el) => $(el).text()).get().join(' ')
            if (transcript.trim()) { source = transcript; provenance = 'Video captions'; captionsUnavailable = false }
          }
        } catch { if (signal?.aborted) throw createError({ statusCode: 499, statusMessage: 'Cancelled' }) }
      }
    }
    if (!source.trim() && title.trim()) {
      source = `Video: ${title}`
      provenance = 'Video title (captions and description unavailable)'
      captionsUnavailable = false
    }
    if (!source.trim()) throw createError({ statusCode: 422, statusMessage: 'Video has no accessible title, captions, or description. Paste your notes in Memory instead.' })
  }
  if (captionsUnavailable) task += ' This video has no captions track, so the source is the creator\u2019s description. Reconstruct the method in order from its timestamp/chapter lines and the method, notes and ingredient lists it contains, and take proportions only from amounts the creator lists. Tag every step or amount you infer rather than read, by starting its notes with [Inferred from description]. Never present inferred detail as something the creator said.'
  progress('Preserving measurements and identifying gaps')
  // Without a model, prefer the source's own ingredients and numbered method over the generic template.
  const structured = !extracted && client.mode === 'fallback' ? (draftSource ? structuredDraft(draftSource, title || undefined) : null) || structuredDraft(source, title || undefined) : null
  const promptSource = request.kind === 'video' && draftSource && draftSource !== source ? `=== VIDEO DESCRIPTION ===\n${draftSource}\n\n=== VIDEO TRANSCRIPT ===\n${source}` : source
  const recipe = extracted || structured || await client.generate(recipeCreateSchema, task, promptSource.slice(0, 30000), () => fallbackRecipe(source, title || undefined), signal, image)
  const sanitized = { ...recipe, originalSaltType: extracted?.originalSaltType ?? null }
  if (!extracted) {
    delete sanitized.imageUrl
    delete sanitized.rating
    delete sanitized.isFavorite
  }
  const draft = recipeCreateSchema.parse(enrichScience({ ...sanitized, sourceType: request.kind === 'ocr' ? 'handwritten_ocr' : request.kind, sourceUrl: sourceUrl || null }))
  return { recipe: draft, sourceText: source.slice(0, 20000), mode: extracted ? 'extracted' as const : client.mode, provenance: structured ? provenance + ' · parsed sections' : provenance, captionsUnavailable, warnings: [extracted ? 'Review parsed quantities, especially ranges and missing measures.' : structured ? 'No AI model was needed: ingredients and steps came straight from the source’s own sections. Check lines marked “as needed” and any estimates.' : client.mode === 'fallback' ? 'No AI key is set, so this is a basic starting draft rather than the full recipe. Fill in the details before you rely on it, or add a key in AI settings for a fuller import.' : 'Drafted by AI: double-check any quantities and cooking times it inferred.'] }
}
