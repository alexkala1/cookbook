import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: { exclude: [...configDefaults.exclude, '.herdr/**'] },
  resolve: { alias: { '#shared': fileURLToPath(new URL('./shared', import.meta.url)) } }
})
