import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { readRecipeStream, streamIdleTimeout } from '../app/utils/sse'
import { downsizePhoto } from '../app/utils/import-photo'
import * as multi from '../app/utils/multi-recipe-import'

const require = createRequire(import.meta.url)
const { ref, computed } = require(require.resolve('vue', { paths: [require.resolve('nuxt/package.json')] }))
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('import stream', () => {
  it.each([401, 422, 424, 429])('propagates HTTP %s and the server explanation', async status => {
    await expect(readRecipeStream(Response.json({ statusMessage: 'Source was blocked' }, { status }), vi.fn())).rejects.toMatchObject({ message: 'Source was blocked', status })
  })
  it('handles non-JSON HTTP failures without settings boilerplate', async () => {
    await expect(readRecipeStream(new Response('bad gateway', { status: 502 }), vi.fn())).rejects.toMatchObject({ message: 'Unable to start import.', status: 502 })
  })
  it('uses a friendly error for malformed frames and releases the reader', async () => {
    const cancel = vi.fn()
    const body = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('event: progress\ndata: {broken\n\n')) }, cancel })
    await expect(readRecipeStream(new Response(body), vi.fn())).rejects.toThrow('The import stream was interrupted. Try again.')
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('counts comment heartbeat chunks as activity', async () => {
    const activity = vi.fn(), events = vi.fn()
    const body = new ReadableStream({ start(c) {
      c.enqueue(new TextEncoder().encode(': heartbeat\n\n'))
      c.enqueue(new TextEncoder().encode('event: complete\ndata: {}\n\n')); c.close()
    } })
    await readRecipeStream(new Response(body), events, activity)
    expect(activity).toHaveBeenCalledTimes(2)
    expect(events).toHaveBeenCalledWith('complete', {})
  })
  it('resets the silence deadline and clears it on cleanup', () => {
    vi.useFakeTimers()
    const timeout = vi.fn(), idle = streamIdleTimeout(timeout)
    vi.advanceTimersByTime(29_000); idle.activity(); vi.advanceTimersByTime(29_000)
    expect(timeout).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000); expect(timeout).toHaveBeenCalledOnce()
    idle.activity(); idle.clear(); vi.advanceTimersByTime(30_000)
    expect(timeout).toHaveBeenCalledOnce()
  })
})

describe('photo decoding', () => {
  let bitmap: { width: number, height: number, close: ReturnType<typeof vi.fn> }
  let canvas: { width: number, height: number, getContext: ReturnType<typeof vi.fn>, toDataURL: ReturnType<typeof vi.fn> }
  beforeEach(() => {
    bitmap = { width: 2000, height: 1000, close: vi.fn() }
    canvas = { width: 0, height: 0, getContext: vi.fn(() => ({ fillRect: vi.fn(), drawImage: vi.fn() })), toDataURL: vi.fn(() => 'data:image/jpeg;base64,photo') }
    vi.stubGlobal('document', { createElement: vi.fn(() => canvas) })
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap))
  })
  it('rejects oversized files before decoding', async () => {
    await expect(downsizePhoto({ size: 30 * 1024 * 1024 + 1, type: 'image/jpeg' } as File)).rejects.toThrow('30 MB')
    expect(createImageBitmap).not.toHaveBeenCalled()
  })
  it('requests a resized decode and releases both canvas and bitmap', async () => {
    const file = new File([new Uint8Array(1.5 * 1024 * 1024 + 1)], 'photo.jpg', { type: 'image/jpeg' })
    expect(await downsizePhoto(file)).toContain('data:image/jpeg')
    expect(createImageBitmap).toHaveBeenCalledWith(file, { resizeWidth: 2000, resizeQuality: 'medium' })
    expect(canvas.width).toBe(0); expect(canvas.height).toBe(0)
    expect(bitmap.close).toHaveBeenCalledOnce()
  })
  it('falls back when resize options are unsupported', async () => {
    vi.mocked(createImageBitmap).mockRejectedValueOnce(new TypeError('unsupported option'))
    const file = new File([new Uint8Array(1.5 * 1024 * 1024 + 1)], 'photo.png', { type: 'image/png' })
    await downsizePhoto(file)
    expect(createImageBitmap).toHaveBeenLastCalledWith(file)
  })
  it.each([5, 1.5 * 1024 * 1024])('keeps an 800×600 photo of %s bytes at its original dimensions', async size => {
    bitmap.width = 800; bitmap.height = 600
    const file = new File([new Uint8Array(size)], 'small.jpg', { type: 'image/jpeg' })
    canvas.toDataURL.mockImplementation(() => {
      expect(canvas.width).toBe(800); expect(canvas.height).toBe(600)
      return 'data:image/jpeg;base64,photo'
    })
    await downsizePhoto(file)
    expect(createImageBitmap).toHaveBeenCalledWith(file)
    expect(canvas.getContext.mock.results[0]!.value.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 800, 600)
    expect(canvas.width).toBe(0); expect(canvas.height).toBe(0)
    expect(bitmap.close).toHaveBeenCalledOnce()
  })
  it('releases allocations when canvas serialization fails', async () => {
    canvas.toDataURL.mockImplementation(() => { throw new Error('canvas failure') })
    await expect(downsizePhoto(new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }))).rejects.toThrow('canvas failure')
    expect(canvas.width).toBe(0); expect(bitmap.close).toHaveBeenCalledOnce()
  })
})

// Exercise the page setup with Nuxt auto-imports supplied explicitly, without a DOM renderer.
function page() {
  let unmount = () => {}, tabChanged = () => {}
  const dependencies = {
    ref, computed, readRecipeStream, streamIdleTimeout, downsizePhoto, ...multi,
    readTranslateLang: () => 'el', writeTranslateLang: vi.fn(), translationLanguageOptions: [{ code: 'el', label: 'Greek' }],
    useByokSettings: () => ({ requestHeaders: () => ({}), ready: ref(true), settings: {} }),
    useActionFeedback: () => ({ state: ref('idle'), label: vi.fn() }),
    onMounted: vi.fn(), onBeforeUnmount: (callback: () => void) => { unmount = callback },
    watch: (_value: unknown, callback: () => void) => { tabChanged = callback }, useSeoMeta: vi.fn(), nextTick: async () => {}
  }
  const source = readFileSync(new URL('../app/pages/recipes/import.vue', import.meta.url), 'utf8').split('<script setup lang="ts">')[1]!.split('</script>')[0]!.replace(/^import .*\n/gm, '')
  const script = ts.transpileModule(source + '\nreturn { draft, recipes, busy, error, isAiError, photoDataUrl, photoBusy, pickPhoto, translating, translateError, translateDraft, generate, cancelTranslation: () => translateController?.abort() }', { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
  const state = new Function(...Object.keys(dependencies), script)(...Object.values(dependencies))
  return { ...state, unmount: () => unmount(), tabChanged: () => tabChanged() }
}

describe('import page lifecycle', () => {
  it('omits a photo from translation and restores it on the translated draft', async () => {
    const state = page(), imageUrl = 'data:image/jpeg;base64,' + 'x'.repeat(250_000)
    state.draft.value = { title: 'Soup', imageUrl }
    const fetcher = vi.fn(async () => Response.json({ recipe: { title: 'Σούπα' } }))
    vi.stubGlobal('fetch', fetcher)
    await state.translateDraft()
    expect(JSON.parse(fetcher.mock.calls[0]![1]!.body)).toEqual({ recipe: { title: 'Soup' }, targetLanguage: 'el' })
    expect(state.draft.value).toEqual({ title: 'Σούπα', imageUrl })
  })
  it.each(['cancel', 'unmount'])('aborts translation on %s without changing the draft or displaying an error', async action => {
    const state = page(), draft = { title: 'Soup' }
    state.draft.value = draft
    let signal: AbortSignal
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
      signal = options.signal; signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })))
    const pending = state.translateDraft()
    if (action === 'cancel') state.cancelTranslation(); else state.unmount()
    await pending
    expect(signal!.aborted).toBe(true); expect(state.draft.value.title).toBe('Soup'); expect(state.translateError.value).toBe('')
    if (action === 'cancel') expect(state.translating.value).toBe(false)
  })
  it('ignores stale photo completion after switching tabs', async () => {
    const state = page()
    let resolve!: (value: unknown) => void
    vi.stubGlobal('createImageBitmap', vi.fn(() => new Promise(r => { resolve = r })))
    const input = { files: [new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })], value: 'photo.jpg' }
    const pending = state.pickPhoto({ target: input })
    state.tabChanged()
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => 'data:photo' }) })
    resolve({ width: 2000, height: 1000, close() {} }); await pending
    expect(state.photoDataUrl.value).toBe(''); expect(state.photoBusy.value).toBe(false)
  })
  it('aborts a stalled stream after 30 seconds with a connection error', async () => {
    vi.useFakeTimers()
    const state = page()
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))))
    const pending = state.generate(); await vi.advanceTimersByTimeAsync(30_000); await pending
    expect(state.error.value).toBe('Connection lost. Try again.'); expect(state.busy.value).toBe(false); expect(vi.getTimerCount()).toBe(0)
    expect(state.isAiError.value).toBe(false)
  })
  it('clears the silence timer and aborts the stream on unmount', async () => {
    vi.useFakeTimers()
    const state = page()
    let signal!: AbortSignal
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
      signal = options.signal; signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })))
    const pending = state.generate(); state.unmount(); await pending
    expect(signal.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0); expect(state.error.value).toBe('')
  })
  it.each([[403, false], [401, true], [422, true], [424, true], [429, true]])('classifies HTTP %s using the server status', async (status, aiError) => {
    const state = page()
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ statusMessage: 'Source is unavailable' }, { status })))
    await state.generate()
    expect(state.error.value).toBe('Source is unavailable'); expect(state.isAiError.value).toBe(aiError)
  })
  it('blocks overlapping photo picks while the decoder is pending', async () => {
    const state = page()
    let resolve!: (value: unknown) => void
    const decode = vi.fn(() => new Promise(r => { resolve = r }))
    vi.stubGlobal('createImageBitmap', decode)
    const input = () => ({ files: [new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })], value: 'photo.jpg' })
    const pending = state.pickPhoto({ target: input() })
    await state.pickPhoto({ target: input() }); expect(decode).toHaveBeenCalledOnce()
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => 'data:photo' }) })
    resolve({ width: 2000, height: 1000, close() {} }); await pending
    expect(state.photoDataUrl.value).toBe('data:photo')
  })
})
