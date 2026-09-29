import { expect, it } from 'vitest'
import { buildStepNarrative, detectLanguage } from '../app/utils/speech'

it.each([
  ['Stir gently.', 'en-US'], ['Ανακατέψτε απαλά.', 'el-GR'],
  ['Add φέτα and stir.', 'el-GR'], ['ἄλας', 'el-GR'], ['', 'en-US'], ['180 °C', 'en-US']
])('detects the language of %s', (text, lang) => {
  expect(detectLanguage(text)).toBe(lang)
})

it('narrates the step, instruction, temperature and watch-out in English', () => {
  expect(buildStepNarrative({ instruction: 'Roast the chicken', internalTempTargetC: 74, failurePrevention: 'Do not touch the hot pan' }, 2)).toEqual({
    text: 'Step 2. Roast the chicken. Target internal temperature: 74 degrees Celsius. Watch out: Do not touch the hot pan.', lang: 'en-US'
  })
})

it('uses Greek prefixes and preserves Greek text', () => {
  expect(buildStepNarrative({ instruction: 'Ψήστε το κοτόπουλο.', internalTempTargetC: 74, failurePrevention: 'Προσέξτε το καυτό ταψί!' }, 3)).toEqual({
    text: 'Βήμα 3. Ψήστε το κοτόπουλο. Εσωτερική θερμοκρασία: 74 βαθμοί Κελσίου. Προσοχή: Προσέξτε το καυτό ταψί!', lang: 'el-GR'
  })
})

it.each(['Stir gently', 'Stir gently.', 'Stir gently..', '  Stir gently.  '])('cleans period punctuation in %s', instruction => {
  expect(buildStepNarrative({ instruction })).toEqual({ text: 'Stir gently.', lang: 'en-US' })
})

it.each(['Stop!', 'Stop!!!', ' Stop! '])('preserves one exclamation in %s', instruction => {
  expect(buildStepNarrative({ instruction, failurePrevention: 'Hot pan!!' }).text).toBe('Stop! Watch out: Hot pan!')
})

it('omits absent and blank optional fields', () => {
  expect(buildStepNarrative({ instruction: 'Stir', internalTempTargetC: null, failurePrevention: null }).text).toBe('Stir.')
  expect(buildStepNarrative({ instruction: 'Stir', failurePrevention: ' \n ' }, 1).text).toBe('Step 1. Stir.')
  expect(buildStepNarrative({ instruction: '' })).toEqual({ text: '', lang: 'en-US' })
})

it('includes zero temperature and zero step number', () => {
  expect(buildStepNarrative({ instruction: 'Cool', internalTempTargetC: 0 }, 0).text).toBe('Step 0. Cool. Target internal temperature: 0 degrees Celsius.')
})

it('cleans whitespace without changing decimals or special characters', () => {
  expect(buildStepNarrative({ instruction: '  Add  1.5 tbsp\n& heat to 180 °C. ', failurePrevention: '  Don’t\t scorch.. ' }).text)
    .toBe('Add 1.5 tbsp & heat to 180 °C. Watch out: Don’t scorch.')
})

it('chooses language from the instruction alone and keeps the payload concise', () => {
  expect(buildStepNarrative({
    instruction: 'Stir', failurePrevention: 'Προσοχή στη φωτιά', durationMinutes: 5,
    sensoryVisual: 'Golden', sensoryAudio: 'Sizzling', sensoryAroma: 'Toasty',
    sensoryTexture: 'Smooth', scienceWhy: 'Proteins denature'
  })).toEqual({ text: 'Stir. Watch out: Προσοχή στη φωτιά.', lang: 'en-US' })
  expect(buildStepNarrative({ instruction: 'Add φέτα' }, 1)).toEqual({ text: 'Βήμα 1. Add φέτα.', lang: 'el-GR' })
})
