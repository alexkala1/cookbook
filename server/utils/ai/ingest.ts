import { z } from 'zod'
import { createError, type H3Event } from 'h3'
import { load } from 'cheerio'
import { aiClient } from './client'
import { safeFetch } from './safe-fetch'
import { extractHtml, extractJsonLd, fallbackRecipe, structuredDraft } from './normalize'
import { enrichScience } from './science'
import { recipeCreateSchema, validate } from '../validation'

export const ingestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('url'), url: z.string().url().max(2000) }).strict(),
  z.object({ kind: z.literal('video'), videoUrl: z.string().min(1).max(2000), language: z.string().regex(/^[a-zA-Z-]{2,12}$/).optional() }).strict(),
  z.object({ kind: z.literal('prompt'), prompt: z.string().trim().min(5).max(20000) }).strict(),
  z.object({ kind: z.literal('ocr'), text: z.string().trim().min(5).max(30000) }).strict()
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
  let extracted: ReturnType<typeof extractJsonLd> = null
  let provenance = 'Conversational memory'
  progress('Reading the source')
  if (request.kind === 'prompt') source = request.prompt
  else if (request.kind === 'ocr') {
    source = request.text
    title = cardTitle(source)
    // Offline drafts parse the card body; the model still reads the whole card.
    if (title) draftSource = source.slice(source.indexOf(title) + title.length).replace(/^[#*\s]+/, '')
    provenance = 'Scanned recipe card / OCR'
  }
  else if (request.kind === 'url' && !/^(?:https?:)?\/\/(?:[\w-]+\.)?(?:youtube\.com|youtu\.be)\//i.test(request.url)) {
    sourceUrl = request.url
    const html = await safeFetch(sourceUrl, signal)
    extracted = extractJsonLd(html)
    const plain = extractHtml(html); source = plain.text; title = plain.title
    provenance = extracted ? 'Recipe JSON-LD' : 'Page text'
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
    provenance = 'Video description (transcript unavailable)'
    const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks
    const track = Array.isArray(tracks) ? tracks.find(item => item.languageCode === ((request.kind === 'video' ? request.language : undefined) || 'en')) || tracks[0] : undefined
    if (track?.baseUrl) {
      try {
        const captions = await safeFetch(track.baseUrl, signal)
        const $ = load(captions, { xml: true })
        const transcript = $('text, p').map((_i, el) => $(el).text()).get().join(' ')
        if (transcript.trim()) { source = transcript; provenance = 'Video captions' }
      } catch { if (signal?.aborted) throw createError({ statusCode: 499, statusMessage: 'Cancelled' }) }
    }
    if (!source.trim() && title.trim()) {
      source = `Video: ${title}`
      provenance = 'Video title (captions and description unavailable)'
    }
    if (!source.trim()) throw createError({ statusCode: 422, statusMessage: 'Video has no accessible title, captions, or description. Paste your notes in Memory instead.' })
  }
  progress('Preserving measurements and identifying gaps')
  // Without a model, prefer the source's own ingredients and numbered method over the generic template.
  const structured = !extracted && client.mode === 'fallback' ? structuredDraft(draftSource || source, title || undefined) : null
  const recipe = extracted || structured || await client.generate(recipeCreateSchema, 'Normalize a recipe from the source. Include ingredients, ordered steps, equipment, scienceWhy and sensory cues. Mark all inferred measurements. Do not invent a transcript.', source.slice(0, 30000), () => fallbackRecipe(draftSource || source, title || undefined), signal)
  const sanitized = { ...recipe, originalSaltType: extracted?.originalSaltType ?? null }
  if (!extracted) {
    delete sanitized.imageUrl
    delete sanitized.rating
    delete sanitized.isFavorite
  }
  const draft = recipeCreateSchema.parse(enrichScience({ ...sanitized, sourceType: request.kind === 'ocr' ? 'handwritten_ocr' : request.kind, sourceUrl: sourceUrl || null }))
  return { recipe: draft, sourceText: source.slice(0, 20000), mode: extracted ? 'extracted' as const : client.mode, provenance: structured ? provenance + ' · parsed sections' : provenance, warnings: [extracted ? 'Review parsed quantities, especially ranges and missing measures.' : structured ? 'No live model used. Ingredients and steps were parsed from the source’s own sections; check lines marked “as needed” and any estimates.' : client.mode === 'fallback' ? 'No live model used. This is a deterministic starting draft, not a recovered recipe.' : 'AI-generated draft: verify inferred quantities and cooking requirements.'] }
}
