import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('error boundary page (app/error.vue)', () => {
  const content = readFileSync(new URL('../app/error.vue', import.meta.url), 'utf8')

  it('declares props matching NuxtError', () => {
    expect(content).toContain("import type { NuxtError } from '#app'")
    expect(content).toContain('error: NuxtError')
  })

  it('differentiates 404 Recipe Not Found from server/runtime errors', () => {
    expect(content).toContain("props.error?.statusCode === 404")
    expect(content).toContain("'Recipe Not Found'")
    expect(content).toContain("'Dish Dropped'")
  })

  it('provides accessible buttons with >= 44x44px touch targets', () => {
    expect(content).toContain('button-primary min-h-11 min-w-11')
    expect(content).toContain('button-secondary min-h-11 min-w-11')
  })

  it('clears error and redirects to the kitchen homepage', () => {
    expect(content).toContain("clearError({ redirect: '/' })")
  })

  it('uses semantic typography and accessible iconography', () => {
    expect(content).toContain('<main')
    expect(content).toContain('<h1')
    expect(content).toContain('i-lucide-home')
    expect(content).toContain('i-lucide-rotate-ccw')
    expect(content).toContain('aria-hidden="true"')
  })
})
