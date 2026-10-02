import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

describe.each(['e2e-user-flows.js', 'e2e-offline-flight.js'])('%s browser detection', script => {
  const source = readFileSync(new URL(`../scripts/${script}`, import.meta.url), 'utf8')
  const detector = source.slice(source.indexOf('function chromiumPath()'), source.indexOf('function freePort()'))
  const detect = (files: string[] = [], configured?: string, builds: string[] = []) => runInNewContext(`${detector}\nchromiumPath()`, {
    process: { env: { CHROMIUM_PATH: configured } },
    chromium: { executablePath: () => '/playwright/chrome' },
    existsSync: (path: string) => files.includes(path),
    homedir: () => '/home/test',
    readdirSync: () => builds,
    join
  })

  it('prefers an explicitly configured browser', () => {
    expect(detect(['/usr/bin/chromium'], '/custom/chrome')).toBe('/custom/chrome')
  })
  it('uses the installed Playwright browser before a system binary', () => {
    expect(detect(['/playwright/chrome', '/usr/bin/chromium'])).toBeUndefined()
  })
  it('uses a cached browser before a system binary', () => {
    const cache = '/home/test/.cache/ms-playwright'
    const binary = `${cache}/chromium-1234/chrome-linux64/chrome`
    expect(detect([cache, binary, '/usr/bin/chromium'], undefined, ['chromium-1234'])).toBe(binary)
  })
  it.each(['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'])('finds system browser %s when no cached browser exists', binary => {
    expect(detect([binary])).toBe(binary)
  })
  it('reports a missing browser after exhausting every source', () => {
    expect(() => detect()).toThrow('No Chromium found')
  })
})
