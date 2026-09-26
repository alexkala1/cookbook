export async function readRecipeStream(response: Response, onEvent: (event: string, data: unknown) => void) {
  if (!response.ok || !response.body) throw new Error('Unable to start import. Check the input and AI settings.')
  const reader = response.body.getReader(), decoder = new TextDecoder()
  let buffer = '', complete = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      let match: RegExpExecArray | null
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, match.index); buffer = buffer.slice(match.index + match[0].length)
        const lines = frame.split(/\r?\n/)
        const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim() || 'message'
        const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
        if (!data) continue
        const parsed = JSON.parse(data)
        if (event === 'error') throw new Error(parsed.message || 'Import failed.')
        onEvent(event, parsed)
        if (event === 'complete') complete = true
      }
      if (done) break
    }
    if (!complete) throw new Error('Import ended before the draft was ready. Retry to continue.')
  } finally { await reader.cancel() }
}
