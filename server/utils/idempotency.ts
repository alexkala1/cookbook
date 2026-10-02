// Cooking mutations are synchronous SQLite transactions. Cache the result before
// yielding so concurrent retries cannot apply the same mutation twice.
// Replay protection lasts until expiry, LRU eviction or this process restarts.
const results = new Map<string, { result: unknown, expiresAt: number }>()
const lifetime = 24 * 60 * 60 * 1000
const capacity = 1000

export function idempotent<T>(scope: string, requestId: string | undefined, run: () => T): T {
  if (!requestId) return run()
  const key = `${scope}:${requestId}`
  const now = Date.now()
  for (const [key, cached] of results) {
    if (cached.expiresAt <= now) results.delete(key)
  }
  const cached = results.get(key)
  if (cached) {
    results.delete(key)
    results.set(key, cached)
    return structuredClone(cached.result) as T
  }
  const result = run()
  results.set(key, { result: structuredClone(result), expiresAt: now + lifetime })
  if (results.size > capacity) results.delete(results.keys().next().value!)
  return result
}
