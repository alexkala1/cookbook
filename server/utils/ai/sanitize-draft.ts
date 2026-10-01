import { difficulties, recipeCreateSchema, recipeTypes } from '../validation'

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const numeric = (value: unknown) => typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value.match(/[+-]?(?:\d+\.?\d*|\.\d+)/)?.[0] ?? '') : NaN
const integer = (value: unknown, max: number, min = 0) => Math.max(min, Math.min(max, Math.floor(numeric(value) || 0)))
function pick(value: unknown, keys: readonly string[]): Record<string, unknown> {
  return object(value) ? Object.fromEntries(keys.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]])) : {}
}
function optionalText(row: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) if (key in row) {
    if (typeof row[key] === 'string') row[key] = text(row[key])
    else if (row[key] !== null) delete row[key]
  }
}

// Cleanup is limited to model output; API request validation remains strict.
export function sanitizeAiDraft(raw: unknown): unknown {
  if (!object(raw)) return raw
  const draft = pick(raw, Object.keys(recipeCreateSchema.shape))
  const type = text(draft.recipeType).toLowerCase()
  draft.recipeType = recipeTypes.includes(type as typeof recipeTypes[number]) ? type : 'food'
  const difficulty = text(draft.difficulty).toLowerCase()
  draft.difficulty = ['medium', 'moderate'].includes(difficulty) ? 'intermediate'
    : ['hard', 'expert'].includes(difficulty) ? 'advanced'
      : difficulties.includes(difficulty as typeof difficulties[number]) ? difficulty : 'easy'
  if (typeof draft.title === 'string') draft.title = text(draft.title)
  if (draft.description === undefined || draft.description === null) draft.description = ''
  if (typeof draft.description === 'string') draft.description = text(draft.description)
  for (const key of ['servings', 'prepTimeMinutes', 'cookTimeMinutes', 'totalTimeMinutes']) {
    if (key in draft) draft[key] = integer(draft[key], key === 'servings' ? 1000 : 100000, key === 'servings' ? 1 : 0)
  }
  if ('sourceUrl' in draft) {
    const url = text(draft.sourceUrl)
    try { draft.sourceUrl = ['http:', 'https:'].includes(new URL(url).protocol) && url.length <= 2000 ? url : null }
    catch { draft.sourceUrl = null }
  }
  if (Array.isArray(draft.ingredients)) draft.ingredients = draft.ingredients.map((value, index) => {
    const row = pick(value, ['name', 'amount', 'unit', 'gramsEquivalent', 'category', 'notes'])
    row.name = text(typeof value === 'string' ? value : row.name) || 'Ingredient'
    const amount = numeric(row.amount)
    row.amount = Number.isFinite(amount) && amount >= 0 ? amount : 0
    row.unit = text(row.unit) || 'item'
    row.sortOrder = index + 1
    if ('gramsEquivalent' in row && row.gramsEquivalent !== null) {
      const grams = numeric(row.gramsEquivalent)
      if (Number.isFinite(grams) && grams >= 0) row.gramsEquivalent = grams
      else delete row.gramsEquivalent
    }
    if ('category' in row) {
      if (text(row.category)) row.category = text(row.category)
      else delete row.category
    }
    optionalText(row, ['notes'])
    return row
  })
  if (Array.isArray(draft.steps)) draft.steps = draft.steps.map((value, index) => {
    const row = pick(value, ['instruction', 'heatLevel', 'durationMinutes', 'timerRequired', 'scienceWhy', 'failurePrevention', 'sensoryVisual', 'sensoryAudio', 'sensoryAroma', 'sensoryTexture', 'internalTempTargetC'])
    row.stepNumber = index + 1
    row.instruction = text(typeof value === 'string' ? value : row.instruction)
    const heat = text(row.heatLevel).toLowerCase()
    const aliases: Record<string, string> = { med: 'medium', moderate: 'medium', 'med-high': 'medium-high', 'medium high': 'medium-high', 'med-low': 'medium-low', 'medium low': 'medium-low' }
    const normalized = aliases[heat] ?? heat
    row.heatLevel = ['none', 'low', 'medium-low', 'medium', 'medium-high', 'high'].includes(normalized) ? normalized : undefined
    if ('durationMinutes' in row && row.durationMinutes !== null) row.durationMinutes = integer(row.durationMinutes, 100000)
    if ('timerRequired' in row && typeof row.timerRequired !== 'boolean') delete row.timerRequired
    if ('internalTempTargetC' in row && row.internalTempTargetC !== null) {
      const temperature = numeric(row.internalTempTargetC)
      if (Number.isFinite(temperature) && temperature >= -273.15 && temperature <= 500) row.internalTempTargetC = temperature
      else delete row.internalTempTargetC
    }
    optionalText(row, ['scienceWhy', 'failurePrevention', 'sensoryVisual', 'sensoryAudio', 'sensoryAroma', 'sensoryTexture'])
    return row
  })
  if (Array.isArray(draft.equipment)) draft.equipment = draft.equipment.map(value => {
    const row = pick(value, ['name', 'isEssential', 'substituteTool'])
    row.name = text(typeof value === 'string' ? value : row.name)
    if ('isEssential' in row && typeof row.isEssential !== 'boolean') delete row.isEssential
    optionalText(row, ['substituteTool'])
    return row
  })
  return draft
}
