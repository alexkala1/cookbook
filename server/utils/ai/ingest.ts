import { z } from 'zod'
import { createError, type H3Event } from 'h3'
import { load } from 'cheerio'
import { aiClient } from './client'
import { safeFetch } from './safe-fetch'
import { extractHtml, extractJsonLd, fallbackRecipe } from './normalize'
import { enrichScience } from './science'
import { recipeCreateSchema, validate } from '../validation'

export const ingestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('url'), url: z.string().url().max(2000) }).strict(),
  z.object({ kind: z.literal('video'), videoUrl: z.string().min(1).max(2000), language: z.string().regex(/^[a-zA-Z-]{2,12}$/).optional() }).strict(),
  z.object({ kind: z.literal('prompt'), prompt: z.string().trim().min(5).max(20000) }).strict()
])
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
  let source = '', title = '', sourceUrl: string | undefined
  let extracted: ReturnType<typeof extractJsonLd> = null
  let provenance = 'Conversational memory'
  progress('Reading the source')
  if (request.kind === 'prompt') source = request.prompt
  else if (request.kind === 'url') {
    sourceUrl = request.url
    const html = await safeFetch(sourceUrl, signal)
    extracted = extractJsonLd(html)
    const plain = extractHtml(html); source = plain.text; title = plain.title
    provenance = extracted ? 'Recipe JSON-LD' : 'Page text'
  } else {
    sourceUrl = 'https://www.youtube.com/watch?v=' + youtubeId(request.videoUrl)
    const html = await safeFetch(sourceUrl, signal)
    const player = playerData(html)
    // Generic YouTube error/consent pages also have a description meta tag.
    // Only video-specific player data counts as a recipe source.
    title = player?.videoDetails?.title || ''
    source = player?.videoDetails?.shortDescription || ''
    if (player?.playabilityStatus?.status && player.playabilityStatus.status !== 'OK') source = ''
    provenance = 'Video description (transcript unavailable)'
    const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks
    const track = Array.isArray(tracks) ? tracks.find(item => item.languageCode === (request.language || 'en')) || tracks[0] : undefined
    if (track?.baseUrl) {
      try {
        const captions = await safeFetch(track.baseUrl, signal)
        const $ = load(captions, { xml: true })
        const transcript = $('text, p').map((_i, el) => $(el).text()).get().join(' ')
        if (transcript.trim()) { source = transcript; provenance = 'Video captions' }
      } catch { if (signal?.aborted) throw createError({ statusCode: 499, statusMessage: 'Cancelled' }) }
    }
    if (!source.trim()) throw createError({ statusCode: 422, statusMessage: 'Video has no accessible captions or description. Paste your notes in Memory instead.' })
  }
  progress('Preserving measurements and identifying gaps')
  const recipe = extracted || await client.generate(recipeCreateSchema, 'Normalize a recipe from the source. Include ingredients, ordered steps, equipment, scienceWhy and sensory cues. Mark all inferred measurements. Do not invent a transcript.', source.slice(0, 30000), () => fallbackRecipe(source, title || undefined), signal)
  const sanitized = { ...recipe, originalSaltType: extracted?.originalSaltType ?? null }
  if (!extracted) {
    delete sanitized.imageUrl
    delete sanitized.rating
    delete sanitized.isFavorite
  }
  const draft = recipeCreateSchema.parse(enrichScience({ ...sanitized, sourceType: request.kind, sourceUrl: sourceUrl || null }))
  return { recipe: draft, mode: extracted ? 'extracted' as const : client.mode, provenance, warnings: [extracted ? 'Review parsed quantities, especially ranges and missing measures.' : client.mode === 'fallback' ? 'No live model used. This is a deterministic starting draft, not a recovered recipe.' : 'AI-generated draft: verify inferred quantities and cooking requirements.'] }
}
