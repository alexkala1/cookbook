/** Signed displacement: negative x is a leftward swipe. Vertical scrolling wins. */
export function swipeIntent(dx: number, dy: number): 'next' | 'previous' | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) < 60 || Math.abs(dx) <= 1.5 * Math.abs(dy)) return null
  return dx < 0 ? 'next' : 'previous'
}
