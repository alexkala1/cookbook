import { EventEmitter } from 'node:events'
import { afterEach, expect, it, vi } from 'vitest'
import { createApp, toWebHandler, type H3Event } from 'h3'
import rescue from '../server/api/ai/rescue.post'
import substitute from '../server/api/ai/substitute.post'
import translate from '../server/api/ai/recipe/translate.post'
import { requestSignal } from '../server/utils/abort'

const state = vi.hoisted(() => ({ body: {} as unknown, event: undefined as H3Event | undefined, closeDuringBody: false }))
vi.mock('h3', async importOriginal => {
  const original = await importOriginal<typeof import('h3')>()
  return { ...original, readBody: async (event: H3Event) => {
    state.event = event
    if (state.closeDuringBody) event.node.res.emit('close')
    return state.body
  } }
})
afterEach(() => { vi.unstubAllGlobals(); state.event = undefined; state.closeDuringBody = false })

it.each(['destroyed', 'writableEnded'] as const)('immediately cancels a response already %s', flag => {
  const response = Object.assign(new EventEmitter(), { destroyed: flag === 'destroyed', writableEnded: flag === 'writableEnded' })
  const signal = requestSignal({ node: { res: response } } as unknown as H3Event)
  expect(signal.aborted).toBe(true)
  expect(response.listenerCount('close')).toBe(0)
})
it('cancels on response close using a single-use listener', () => {
  const response = Object.assign(new EventEmitter(), { destroyed: false, writableEnded: false })
  const signal = requestSignal({ node: { res: response } } as unknown as H3Event)
  expect(signal.aborted).toBe(false)
  response.emit('close')
  expect(signal.aborted).toBe(true)
  expect(response.listenerCount('close')).toBe(0)
})
it.each([
  ['rescue', rescue, { issueDescription: 'Soup too salty' }],
  ['substitute', substitute, { ingredientName: 'butter' }],
  ['translate', translate, { recipe: { title: 'Soup', description: 'Warm' } }]
] as const)('wires cancellation before readBody and through provider fetch for %s', async (_name, handler, body) => {
  state.body = body
  for (const closeDuringBody of [true, false]) {
    state.closeDuringBody = closeDuringBody
    const fetchSpy = vi.fn(async (_url: string, init: RequestInit) => {
      state.event!.node.res.emit('close')
      init.signal!.throwIfAborted()
      return new Response('{}')
    })
    vi.stubGlobal('fetch', fetchSpy)
    const response = await toWebHandler(createApp().use(handler))(new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-byok-key': 'test', 'x-byok-model': 'test' }, body: '{}' }))
    expect(response.status).toBe(499)
    expect((await response.json()).statusMessage).toBe('Request cancelled')
    expect(fetchSpy).toHaveBeenCalledTimes(closeDuringBody ? 0 : 1)
  }
})
