import { difficulties, recipeCreateSchema, recipeTypes } from '../validation'

export function repairTruncatedJson(str: string): string {
  if (str.length > 300_000) return str
  const s = str.trim()
  try { JSON.parse(s); return s } catch { /* Repair only incomplete JSON. */ }
  type Frame = { close: string, state: 'key' | 'colon' | 'value' | 'comma' }
  const frames: Frame[] = []
  let safeCut = 0, lastBrace = -1, rootDone = false
  for (let i = 0; i < s.length;) {
    const ch = s[i]
    const frame = frames.at(-1)
    if (/\s/.test(ch!)) { i++; continue }
    const valueExpected = frame ? frame.state === 'value' : !rootDone
    if (ch === '{' || ch === '[') {
      if (!valueExpected) break
      if (frame) frame.state = 'comma'
      else rootDone = true
      frames.push({ close: ch === '{' ? '}' : ']', state: ch === '{' ? 'key' : 'value' })
      safeCut = ++i
    } else if (ch === '}' || ch === ']') {
      if (!frame || frame.close !== ch || frame.state === 'colon' || (ch === '}' && frame.state === 'value')) break
      frames.pop()
      if (ch === '}') lastBrace = i
      safeCut = ++i
    } else if (ch === ',' && frame?.state === 'comma') {
      frame.state = frame.close === '}' ? 'key' : 'value'
      i++
    } else if (ch === ':' && frame?.state === 'colon') {
      frame.state = 'value'
      i++
    } else if (ch === '"') {
      const isKey = frame?.state === 'key'
      if (!isKey && !valueExpected) break
      let end = i + 1, escaped = false
      for (; end < s.length; end++) {
        if (escaped) escaped = false
        else if (s[end] === '\\') escaped = true
        else if (s[end] === '"') break
      }
      if (end === s.length) break
      // Invalid escape sequences cannot be salvaged as completed strings.
      try { JSON.parse(s.slice(i, end + 1)) } catch { break }
      i = end + 1
      if (isKey) frame!.state = 'colon'
      else {
        if (frame) frame.state = 'comma'
        else rootDone = true
        safeCut = i
      }
    } else {
      if (!valueExpected) break
      const token = s.slice(i).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/)?.[0]
      if (!token || (i + token.length < s.length && !/[\s,}\]]/.test(s[i + token.length]!))) break
      i += token.length
      if (frame) frame.state = 'comma'
      else rootDone = true
      safeCut = i
    }
  }
  // Preserve completed objects; otherwise keep the latest syntactically complete value.
  const prefix = s.slice(0, lastBrace >= 0 ? lastBrace + 1 : safeCut)
  if (!prefix) return s
  const stack: string[] = []
  let inString = false, escaped = false
  for (const ch of prefix) {
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
    } else if (ch === '"') inString = true
    else if (ch === '{') stack.push('}')
    else if (ch === '[') stack.push(']')
    else if (ch === '}' || ch === ']') stack.pop()
  }
  return prefix + stack.reverse().join('')
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const fractions: Record<string, number> = { '½': 1 / 2, '¼': 1 / 4, '¾': 3 / 4, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8, '⅙': 1 / 6, '⅚': 5 / 6 }
const numeric = (value: unknown): number => {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return NaN
  const s = value.trim().replace(/,(?=\d)/g, '.')
  const unicode = s.match(/^(\d+)?\s*([½¼¾⅓⅔⅛⅜⅝⅞⅙⅚])(?=$|\s|\p{L})/u)
  if (unicode) return Number(unicode[1] || 0) + fractions[unicode[2]!]!
  const fraction = s.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)(?=$|\s|\p{L})/u)
  if (fraction) return Number(fraction[3]) > 0 ? Number(fraction[1] || 0) + Number(fraction[2]) / Number(fraction[3]) : NaN
  return Number.parseFloat(s.match(/^[+-]?(?:\d+\.?\d*|\.\d+)(?=$|\s|\p{L})/u)?.[0] ?? '')
}
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
export function sanitizeAiDraft(raw: unknown, warn: (message: string) => void = () => {}): unknown {
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
    if (!Number.isFinite(amount) || amount < 0) {
      row.notes = [text(row.notes), '[Inferred by AI: amount unreadable]'].filter(Boolean).join(' ')
      warn(`The amount for "${row.name}" could not be read. Review its quantity.`)
    }
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
