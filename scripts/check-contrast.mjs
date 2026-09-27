import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const css = readFileSync(new URL('../app/assets/css/main.css', import.meta.url), 'utf8')
const tokens = Object.fromEntries([...css.matchAll(/--color-([\w-]+): oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\)/g)].map(([, name, light, chroma, hue]) => {
  const L = Number(light) / 100, C = Number(chroma), h = Number(hue) * Math.PI / 180
  const a = C * Math.cos(h), b = C * Math.sin(h)
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3
  const m = (L - .1055613458 * a - .0638541728 * b) ** 3
  const s = (L - .0894841775 * a - 1.291485548 * b) ** 3
  const clamp = value => Math.max(0, Math.min(1, value))
  const r = clamp(4.0767416621 * l - 3.3077115913 * m + .2309699292 * s)
  const g = clamp(-1.2684380046 * l + 2.6097574011 * m - .3413193965 * s)
  const blue = clamp(-.0041960863 * l - .7034186147 * m + 1.707614701 * s)
  return [name, .2126 * r + .7152 * g + .0722 * blue]
}))
const pairs = [
  ...['ink', 'muted', 'terracotta-ink', 'sage-ink', 'olive', 'olive-ink', 'error'].map(name => [name, 'paper', 4.5]),
  ['sage', 'paper', 3], ['terracotta', 'paper', 3],
  ['focus', 'paper', 3], ['focus', 'ink', 3],
  ['k-ink', 'k-paper', 4.5], ['k-muted', 'k-paper', 4.5], ['k-accent', 'k-paper', 4.5],
  ['k-danger-ink', 'k-danger', 4.5], ['k-rule', 'k-paper-2', 3]
]
for (const [foreground, background, minimum] of pairs) {
  const a = tokens[foreground], b = tokens[background]
  const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
  assert(ratio >= minimum, `${foreground}/${background}: ${ratio.toFixed(2)} < ${minimum}`)
  console.log(`${foreground}/${background}: ${ratio.toFixed(2)}:1 (minimum ${minimum})`)
}
