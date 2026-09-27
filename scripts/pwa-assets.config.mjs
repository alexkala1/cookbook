import { readFileSync } from 'node:fs'
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// The SVG already places its glyph inside the maskable 80% safe zone.
// Resolve the source palette at export time; librsvg does not resolve CSS variables.
const paper = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8').match(/--color-paper: ([^;]+);/)[1]
export default defineConfig({
  images: ['public/icon.svg'],
  preset: Object.fromEntries(Object.entries(minimal2023Preset).map(([key, preset]) => [key, {
    ...preset, padding: 0, resizeOptions: { background: paper }
  }]))
})
