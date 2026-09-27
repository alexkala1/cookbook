import { describe, expect, it } from 'vitest'
import { isPlaceholderIngredients, parseStructuredRecipe, splitNotesUpdate, stepCountPhrase, stripPromotional } from '../shared/culinary/structured-recipe'
import { parseDurations } from '../shared/culinary/durations'
import { ovenTemperature } from '../shared/culinary/heat'
import { fallbackRecipe, structuredDraft } from '../server/utils/ai/normalize'
import { recipeCreateSchema } from '../server/utils/validation'

// Synthetic description with the same shape as a typical cooking-channel video description.
const braise = `🚨 Big News: Memberships Are Here! 🚨 Hit the Join button to join the community!
A slow red-wine braise that turns an inexpensive cut into something glossy and elegant. Serves 4.
Everything happens in one heavy pot.

Ingredients
4 beef short ribs, bone-in (about 1.5–2 kg total)
2 bottles red wine
30 ml vegetable oil
Plain flour, for dredging (seasoned with salt and pepper)
2 tbsp tomato paste
1.5 L beef stock
Salt and pepper, to taste

For the Celeriac Purée
1 medium celeriac, peeled and chopped
500 ml milk
Knob of butter, for finishing

Method
1. Reduce the wine
Pour the wine into a saucepan and bring to a gentle boil.
Reduce by half. Set aside.

2. Brown the ribs
Preheat your oven to 140°C (275°F).
Sear the ribs on all sides over medium-high heat until deeply browned.

3. Build the base
Stir in the tomato paste and cook for 2 minutes over medium heat.

4. Braise
Return the ribs to the pot and pour over the stock.

Cover tightly and transfer to the oven. Braise for 3½–4 hours, until tender.

5. Rest
Let the ribs cool in the liquid for 30–45 minutes.

To Serve
Spoon purée onto each plate and top with a rib.

Notes
Subscribe for more recipes!
Music by Someone`

describe('parseStructuredRecipe', () => {
  const parsed = parseStructuredRecipe(braise)!

  it('turns a numbered method into one step per heading, with a final plating step', () => {
    expect(parsed.steps.map(step => step.instruction.split('.')[0])).toEqual(['Reduce the wine', 'Brown the ribs', 'Build the base', 'Braise', 'Rest', 'To serve'])
    expect(parsed.steps[0]!.instruction).toBe('Reduce the wine. Pour the wine into a saucepan and bring to a gentle boil. Reduce by half. Set aside.')
    expect(parsed.steps.map(step => step.stepNumber)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('keeps sub-lines separated by blank lines inside the same step', () => {
    expect(parsed.steps[3]!.instruction).toContain('pour over the stock. Cover tightly and transfer to the oven. Braise for 3½–4 hours')
  })

  it('records durations (lower bound of ranges) and marks timer steps', () => {
    expect(parsed.steps.map(step => step.durationMinutes)).toEqual([null, null, 2, 210, 30, null])
    expect(parsed.steps[3]!.timerRequired).toBe(true)
    expect(parseDurations(parsed.steps[3]!.instruction)).toEqual([12600])
    expect(parsed.cookTimeMinutes).toBe(242)
  })

  it('reads the oven temperature and carries it into a later oven step that omits it', () => {
    expect(ovenTemperature(parsed.steps[1]!.instruction)).toEqual({ temperature: 140, unit: 'C' })
    expect(parsed.steps[3]!.instruction).toMatch(/\(oven at 140°C\)$/)
    expect(ovenTemperature(parsed.steps[3]!.instruction)).toEqual({ temperature: 140, unit: 'C' })
  })

  it('infers explicit heat levels only', () => {
    expect(parsed.steps.map(step => step.heatLevel ?? null)).toEqual([null, 'medium-high', 'medium', null, null, null])
  })

  it('parses measured ingredients, groups sub-recipes, and never invents amounts for "to taste" lines', () => {
    const rows = parsed.ingredients.map(row => [row.amount, row.unit, row.name, row.notes ?? ''])
    expect(rows).toEqual([
      [4, 'piece', 'beef short ribs, bone-in (about 1.5–2 kg total)', ''],
      [2, 'bottle', 'red wine', ''],
      [30, 'ml', 'vegetable oil', ''],
      [0, 'as needed', 'Plain flour, for dredging (seasoned with salt and pepper)', ''],
      [2, 'tbsp', 'tomato paste', ''],
      [1.5, 'l', 'beef stock', ''],
      [0, 'as needed', 'Salt and pepper, to taste', ''],
      [1, 'piece', 'medium celeriac, peeled and chopped', 'For the celeriac purée'],
      [500, 'ml', 'milk', 'For the celeriac purée'],
      [0, 'as needed', 'Knob of butter, for finishing', 'For the celeriac purée']
    ])
  })

  it('removes promotion, keeps the story as notes, and uses it as the description', () => {
    expect(parsed.notes).not.toMatch(/Memberships|Join button|Subscribe|Music by/)
    expect(parsed.notes).toContain('A slow red-wine braise')
    expect(parsed.notes).not.toContain('Ingredients')
    expect(parsed.description).toBe('A slow red-wine braise that turns an inexpensive cut into something glossy and elegant. Serves 4.')
    expect(parsed.servings).toBe(4)
  })

  it('parses a Greek recipe with Greek headings and units', () => {
    const greek = parseStructuredRecipe(`Η γιαγιά την έφτιαχνε κάθε Κυριακή.\n\nΥλικά\n500 γρ. γίγαντες\n2 κ.σ. πελτές\nΑλάτι\n\nΕκτέλεση\n1. Μουλιάστε τους γίγαντες από το βράδυ.\n2. Βράστε για 40 λεπτά.\n3. Ψήστε στους 180 βαθμούς για 1 ώρα.`)!
    expect(greek.ingredients.map(row => [row.amount, row.unit])).toEqual([[500, 'g'], [2, 'tbsp'], [0, 'as needed']])
    expect(greek.steps.map(step => step.durationMinutes)).toEqual([null, 40, 60])
    expect(ovenTemperature(greek.steps[2]!.instruction)).toEqual({ temperature: 180, unit: 'C' })
    expect(greek.description).toBe('Η γιαγιά την έφτιαχνε κάθε Κυριακή.')
    expect(greek.notes).toBe('Η γιαγιά την έφτιαχνε κάθε Κυριακή.')
  })

  it('splits an unnumbered method on paragraphs', () => {
    const result = parseStructuredRecipe('Ingredients\n200 g rice\n\nMethod\nRinse the rice well.\n\nSimmer for 12 minutes, then rest for 5 minutes.')!
    expect(result.steps.map(step => step.instruction)).toEqual(['Rinse the rice well.', 'Simmer for 12 minutes, then rest for 5 minutes.'])
    expect(result.steps[1]!.durationMinutes).toBe(17)
  })

  it('returns null without a real method', () => {
    expect(parseStructuredRecipe('')).toBeNull()
    expect(parseStructuredRecipe(null)).toBeNull()
    expect(parseStructuredRecipe('A lovely stew my grandmother made with beef and wine.')).toBeNull()
    expect(parseStructuredRecipe('Ingredients\n2 eggs\n\nMethod\n1. Whisk and cook.')).toBeNull()
  })
})

describe('supporting helpers', () => {
  it('strips promotional lines but keeps cooking text', () => {
    expect(stripPromotional('🚨 Big News: Memberships Are Here! 🚨\nBrown the onions.\nhttps://example.com/shop\n0:00 Intro\nFollow me on Instagram\nSimmer gently.'))
      .toBe('Brown the onions.\nSimmer gently.')
  })
  it('recognises offline placeholder ingredients', () => {
    expect(isPlaceholderIngredients(fallbackRecipe('beef short ribs braise').ingredients!)).toBe(true)
    expect(isPlaceholderIngredients([{ notes: 'For the purée' }])).toBe(false)
    expect(isPlaceholderIngredients([])).toBe(false)
  })
})

describe('structuredDraft (import fallback)', () => {
  it('builds a valid recipe from structured source text instead of the generic template', () => {
    const draft = structuredDraft(braise, 'Red Wine Braised Short Ribs')!
    expect(recipeCreateSchema.safeParse(draft).success).toBe(true)
    expect(draft).toMatchObject({ title: 'Red Wine Braised Short Ribs', servings: 4, cookTimeMinutes: 242, totalTimeMinutes: 257 })
    expect(draft.steps).toHaveLength(6)
    expect(draft.ingredients).toHaveLength(10)
    expect(draft.heirloomNotes).not.toMatch(/Memberships/)
    expect(draft.description).toContain('slow red-wine braise')
  })
  it('falls back to null for unstructured text so the template path still applies', () => {
    expect(structuredDraft('grandma lemon chicken, roasted on Sundays')).toBeNull()
  })
})

describe('splitNotesUpdate', () => {
  const plan = parseStructuredRecipe(braise)!
  it('replaces placeholder ingredients, the offline disclaimer, notes and times, and enriches steps', () => {
    const offline = fallbackRecipe(braise, 'Short ribs')
    const update = splitNotesUpdate({ ...offline, title: 'Short ribs' }, plan)
    expect(update.steps).toHaveLength(6)
    expect(update.ingredients).toHaveLength(10)
    expect(update.description).toContain('slow red-wine braise')
    expect(update.heirloomNotes).not.toMatch(/Memberships/)
    expect(update).toMatchObject({ cookTimeMinutes: 242, totalTimeMinutes: offline.prepTimeMinutes! + 242 })
    expect(update.steps[1]!.scienceWhy).toMatch(/Maillard/)
  })
  it('keeps real ingredients and a written description', () => {
    const update = splitNotesUpdate({ title: 'Short ribs', description: 'Our family version.', ingredients: [{ notes: null }], steps: [{}] }, plan)
    expect(update.ingredients).toBeUndefined()
    expect(update.description).toBeUndefined()
  })
})

it('uses the right article before a step count', () => {
  expect([2, 7, 8, 11, 18, 80, 12].map(stepCountPhrase)).toEqual(['a 2-step', 'a 7-step', 'an 8-step', 'an 11-step', 'an 18-step', 'an 80-step', 'a 12-step'])
})
