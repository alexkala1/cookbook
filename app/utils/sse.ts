export function streamIdleTimeout(onTimeout: () => void, milliseconds = 30_000) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const clear = () => { clearTimeout(timer); timer = undefined }
  const activity = () => { clear(); timer = setTimeout(onTimeout, milliseconds) }
  activity()
  return { activity, clear }
}

export async function readRecipeStream(response: Response, onEvent: (event: string, data: unknown) => void, onActivity: () => void = () => {}) {
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw Object.assign(new Error(body?.statusMessage || body?.message || 'Unable to start import.'), { status: response.status })
  }
  if (!response.body) throw new Error('Unable to start import.')
  const reader = response.body.getReader(), decoder = new TextDecoder()
  let buffer = '', complete = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (value?.length) onActivity()
      buffer += decoder.decode(value, { stream: !done })
      let match: RegExpExecArray | null
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, match.index); buffer = buffer.slice(match.index + match[0].length)
        const lines = frame.split(/\r?\n/)
        const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim() || 'message'
        const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
        if (!data) continue
        let parsed
        try { parsed = JSON.parse(data) } catch { throw new Error('The import stream was interrupted. Try again.') }
        if (event === 'error') throw new Error(parsed.message || 'Import failed.')
        onEvent(event, parsed)
        if (event === 'complete') complete = true
      }
      if (done) break
    }
    if (!complete) throw new Error('Import ended before the draft was ready. Retry to continue.')
  } finally { await reader.cancel().catch(() => {}) }
}
