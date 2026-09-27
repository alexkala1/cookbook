import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { appTabs, isTabActive } from '../app/utils/navigation'
import { swipeIntent } from '../app/utils/swipe'

describe('destination matching', () => {
  it.each(['/recipes', '/recipes/import', '/recipes/abc', '/recipes/abc/cook'])('keeps Recipes active for %s', path => {
    expect(appTabs.filter(tab => isTabActive(path, tab.to)).map(tab => tab.label)).toEqual(['Recipes'])
  })
  it('matches whole path segments and leaves Home without a false active tab', () => {
    expect(isTabActive('/recipes-other', '/recipes')).toBe(false)
    expect(appTabs.some(tab => isTabActive('/', tab.to))).toBe(false)
    expect(appTabs.filter(tab => isTabActive('/pantry/', tab.to)).map(tab => tab.label)).toEqual(['Pantry'])
  })
})
describe('touch swipe intent', () => {
  it.each([[-60, 0, 'next'], [60, 0, 'previous'], [-59, 0, null], [100, 80, null], [60, 40, null], [-90, -59, 'next'], [0, 90, null], [NaN, 0, null], [Infinity, 0, null]] as const)('%s/%s → %s', (x, y, direction) => {
    expect(swipeIntent(x, y)).toBe(direction)
  })
})
describe('review regressions (static)', () => {
  const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
  it('pins the finished-timer alert above the step bar instead of inside the timers panel', () => {
    const rule = read('app/pages/recipes/[id]/cook.vue').match(/\.timer-alert \{[^}]*\}/)?.[0] ?? ''
    expect(rule).toContain('position: fixed')
    expect(rule).toContain('bottom: calc(5.5rem + env(safe-area-inset-bottom))')
    expect(rule).not.toContain('sticky')
  })
  it('self-hosts every Commissioner weight the UI uses, so bold is never synthesised', () => {
    expect(read('nuxt.config.ts')).toMatch(/name: 'Commissioner'[^}]*weights: \[400, 600, 700\]/)
  })
  it('keeps desktop top-nav links at least 44px in both dimensions', () => {
    const rule = read('app/components/AppTopBar.vue').match(/\.top-link \{[^}]*\}/)?.[0] ?? ''
    expect(rule).toContain('min-height: 44px'); expect(rule).toContain('min-width: 44px')
  })
})
