import { describe, expect, it, vi } from 'vitest'
import { extractHtml, extractJsonLd, parseIngredient, duration } from '../server/utils/ai/normalize'
import { publicAddress, resolvePublicUrl } from '../server/utils/ai/safe-fetch'
import { youtubeId } from '../server/utils/ai/ingest'
import { recipeCreateSchema } from '../server/utils/validation'
vi.mock('node:dns/promises', () => ({ lookup: vi.fn(async (host: string) => host === 'mixed.example' ? [{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }] : [{ address: '93.184.216.34', family: 4 }]) }))
describe('source normalization', () => {
  it('extracts nested JSON-LD, fractions, sections, yields and times', () => {
    const recipe = extractJsonLd('<script type="application/ld+json">' + JSON.stringify({ '@graph': [{ '@type': ['Recipe'], name: 'Lemon soup', recipeYield: '6 servings', prepTime: 'PT15M', cookTime: 'PT1H', recipeIngredient: ['1 1/2 cups flour', '½ tsp salt'], recipeInstructions: [{ '@type': 'HowToSection', itemListElement: [{ text: 'Simmer gently.' }, { text: 'Serve.' }] }] }] }) + '</script>')!
    expect(recipeCreateSchema.safeParse(recipe).success).toBe(true)
    expect(recipe).toMatchObject({ title: 'Lemon soup', servings: 6, totalTimeMinutes: 75 })
    expect(recipe.ingredients?.map(i => i.amount)).toEqual([1.5, 0.5])
    expect(recipe.steps?.map(s => s.stepNumber)).toEqual([1, 2])
  })
  it('ignores malformed metadata and strips page chrome', () => {
    expect(extractJsonLd('<script type="application/ld+json">bad</script>')).toBeNull()
    expect(extractHtml('<nav>Ignore me</nav><main><h1>Soup</h1>Simmer beans</main><script>secret</script>').text).not.toContain('secret')
    expect(parseIngredient('salt').notes).toContain('[Inferred by AI]')
    expect(parseIngredient('2–3 tbsp olive oil')).toMatchObject({ amount: 2, unit: 'tbsp', name: 'olive oil', notes: expect.stringContaining('[Inferred by AI]') })
    expect(parseIngredient('1 pinch salt')).toMatchObject({ amount: 1, unit: 'pinch', name: 'salt' })
    expect(duration('PT90S')).toBe(2)
  })
  it.each(['127.0.0.1', '10.1.1.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '224.0.0.1'])('blocks private/reserved address %s', address => expect(publicAddress(address)).toBe(false))
  it.each(['file:///etc/passwd', 'http://localhost', 'http://test.localhost', 'http://127.1', 'http://0x7f000001', 'http://[::ffff:127.0.0.1]', 'https://user:pass@example.com', 'https://example.com:8080', 'https://mixed.example'])('rejects unsafe URL %s', async url => { await expect(resolvePublicUrl(url)).rejects.toThrow() })
  it('pins a public DNS answer', async () => expect(await resolvePublicUrl('https://public.example/recipe')).toMatchObject({ address: { address: '93.184.216.34' } }))
  it('only accepts YouTube IDs and known YouTube hosts', () => {
    expect(youtubeId('https://youtu.be/abcdefghijk')).toBe('abcdefghijk')
    expect(youtubeId('https://www.youtube.com/watch?v=abcdefghijk')).toBe('abcdefghijk')
    expect(() => youtubeId('https://youtube.com.evil.test/watch?v=abcdefghijk')).toThrow()
  })
})
