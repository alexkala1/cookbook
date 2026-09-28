import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseDurations } from '../shared/culinary/durations'
import { cookingSentences, splitInstructions, timedStep } from '../shared/culinary/method-steps'

describe('method step boundaries', () => {
  it.each([
    ['1.5 kg potatoes. Add the oil.', ['1.5 kg potatoes.', 'Add the oil.']],
    ['Add 1.5 kg potatoes. 2) Mix well.', ['Add 1.5 kg potatoes.', '2) Mix well.']],
    ['1. Add 1.5 kg potatoes. 2. Mix well.', ['Add 1.5 kg potatoes.', 'Mix well.']],
    ['Preheat to 180 °C. Add the potatoes.', ['Preheat to 180 °C.', 'Add the potatoes.']],
    ['Preheat to 350 F. Add the potatoes.', ['Preheat to 350 F.', 'Add the potatoes.']],
    ['Add 2 tbsp. Olive oil goes in first. Stir well.', ['Add 2 tbsp. Olive oil goes in first.', 'Stir well.']],
    ['Use approx. 2 cups water. Stir well.', ['Use approx. 2 cups water.', 'Stir well.']],
    ['Heat the oil. This prevents sticking. Add the onions.', ['Heat the oil. This prevents sticking.', 'Add the onions.']],
    ['Step 1: Mix well. Step 2: Bake gently.', ['Mix well.', 'Bake gently.']],
    ['', []],
    [' \t\n ', []]
  ])('splits %j without losing quantities or abbreviations', (source, expected) => {
    expect(splitInstructions(source)).toEqual(expected)
  })

  it('keeps temperature and ingredient quantities out of timers', () => {
    expect(timedStep('Bake 1.5 kg potatoes at 180 °C with 2 tbsp. oil.', 3)).toEqual({
      stepNumber: 3,
      instruction: 'Bake 1.5 kg potatoes at 180 °C with 2 tbsp. oil.',
      durationMinutes: null,
      timerRequired: false
    })
  })

  it('respects cooking verb boundaries and the sentence length limit', () => {
    expect(cookingSentences('He baked bread. Addition is easy. Simmering soup smells good.')).toEqual([])
    expect(cookingSentences('Ψήστε για 5 λεπτά.')).toEqual(['Ψήστε για 5 λεπτά.'])
    expect(cookingSentences('Mix ' + 'a'.repeat(396))).toHaveLength(1)
    expect(cookingSentences('Mix ' + 'a'.repeat(397))).toEqual([])
  })
})

describe('adversarial duration semantics', () => {
  it.each([
    ['20-25 minutes', [1200]], ['25–20 minutes', [1200]],
    ['20 to 25 minutes', [1200]], ['20 έως 25 λεπτά', [1200]],
    ['20 ως 25 λεπτά', [1200]], ['1.5–2 hours', [5400]],
    ['½ hour', [1800]], ['¼ hour', [900]], ['¾ hour', [2700]],
    ['1½ hours', [5400]], ['1/2 hour', [1800]], ['1 1/2 hours', [5400]],
    ['1/4–1/2 hour', [900]], ['1½–2 hours', [5400]],
    ['1 ώρα και 30 λεπτά', [5400]], ['2 ώρες', [7200]],
    ['1 ώρας', [3600]], ['2 ωρών', [7200]], ['1 λεπτό', [60]],
    ['5 λεπτών', [300]], ['30 δευτερόλεπτα', [30]],
    ['1 δευτερόλεπτο', [1]], ['30 δευτερολέπτων', [30]], ['30 δευτ.', [30]],
    ['ΨΗΣΤΕ ΓΙΑ 5 ΛΕΠΤΆ', [300]],
    ['1 hour and 15 minutes', [4500]],
    ['Bake for 10 minutes. Rest for 5 minutes.', [600, 300]],
    ['5-minute rest', [300]], ['30 seconds', [30]],
    ['0 minutes', []], ['-5 minutes', []], ['−5 minutes', []],
    ['1/0 hours', []], ['1 1/0 hours', []],
    ['169 hours', []], ['168 hours', [604800]], ['168 hours and 1 second', []],
    ['5 minimum, 2 history, 3 secondsworth, 4 λεπτακι', []],
    ['1.5 kg, 180 °C, 2 tbsp.', []], ['', []]
  ])('parses %j', (source, expected) => {
    expect(parseDurations(source)).toEqual(expected)
    // Stateful global regexes must also behave identically on repeated calls.
    expect(parseDurations(source)).toEqual(expected)
  })

  it('derives timers from fractions and rounds partial minutes upward', () => {
    expect(timedStep('Simmer for 1½–2 hours.', 1)).toMatchObject({ durationMinutes: 90, timerRequired: true, heatLevel: 'low' })
    expect(timedStep('Wait for 90 seconds.', 2)).toMatchObject({ durationMinutes: 2, timerRequired: true })
  })
})

describe('10k-character ReDoS regression budget', () => {
  const cases = [
    ['digit run without a fraction', '9'.repeat(10000)],
    ['unterminated fraction', '1/' + '9'.repeat(9998)],
    ['unterminated mixed fraction', '1 ' + '9'.repeat(9998)],
    ['whitespace before missing unit', '1' + ' '.repeat(9998) + '!'],
    ['range before missing unit', '1–' + ' '.repeat(9997) + '!'],
    ['repeated numbering near misses', '99: '.repeat(2500)],
    ['repeated abbreviation joins', 'a. '.repeat(3333) + '!'],
    ['repeated continuation joins', 'Mix. It is fine. '.repeat(588).padEnd(10000)],
    ['unit near misses', '1 minutesx '.repeat(909) + '!'],
    ['heat cue near miss', 'bring the ' + 'a'.repeat(9989) + '!'],
    ['punctuation', '.!?;'.repeat(2500)]
  ]

  it.each(cases)('bounds %s', (_label, source) => {
    expect(source).toHaveLength(10000)
    // Vitest timeouts cannot interrupt a synchronous regex. A separate process
    // provides a hard stop even if a future change introduces exponential work.
    const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
      import { performance } from 'node:perf_hooks'
      import { parseDurations } from './shared/culinary/durations.ts'
      import { splitInstructions, cookingSentences, heatLevelOf, timedStep } from './shared/culinary/method-steps.ts'
      const input = JSON.parse(process.argv[1])
      const timings = {}
      for (const fn of [parseDurations, splitInstructions, cookingSentences, heatLevelOf, timedStep]) {
        fn('Mix for 1 minute.', 1)
        const start = performance.now()
        const result = fn(input, 1)
        timings[fn.name] = performance.now() - start
        if (fn === parseDurations && result.length !== 0) throw new Error('Unexpected duration')
        if (fn === timedStep && (result.timerRequired || result.instruction.length !== 10000)) throw new Error('Unexpected step')
      }
      console.log(JSON.stringify(timings))
    `, JSON.stringify(source)], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 64 * 1024
    })
    expect(child.error?.message, child.stderr).toBeUndefined()
    expect(child.status, child.stderr).toBe(0)
    const timings = JSON.parse(child.stdout) as Record<string, number>
    // Excludes process/TypeScript startup; ample headroom for normal 10k scans.
    for (const [name, elapsed] of Object.entries(timings)) {
      expect(elapsed, `${name}: ${elapsed.toFixed(1)}ms`).toBeLessThan(200)
    }
  }, 10000)
})
