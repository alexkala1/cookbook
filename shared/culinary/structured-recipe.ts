import type { RecipeInput } from '../../server/utils/validation'
import { EXTERNAL_URL, timedStep } from './method-steps'
import { ovenTemperature } from './heat'
import { parseIngredientLine, type IngredientDraft } from './ingredient-line'
import { enrichScience } from './science'

type StepDraft = NonNullable<RecipeInput['steps']>[number]

export interface StructuredRecipe {
  description: string | null
  notes: string
  servings: number | null
  ingredients: IngredientDraft[]
  steps: StepDraft[]
  cookTimeMinutes: number
}

// Channel promotion, calls to action and link farms found in video descriptions and blog footers.
const PROMOTIONAL = new RegExp([
  'memberships? (?:are|is) here', 'hit the join button', 'join (?:the|my|our) (?:community|channel|membership)',
  '\\bsubscribe\\b', 'turn on (?:the )?notifications', 'patreon', 'buy me a coffee', '\\bmerch\\b', '\\baffiliate\\b',
  'use (?:my )?code', '\\bsponsored\\b', 'business (?:enquiries|inquiries)', 'follow (?:me|us) on', 'link in (?:bio|description)',
  'get my cookbook', 'kitchen products i own', 'discount code', '^follow me\\s*:',
  '^https?://', '^(?:www\\.|instagram|tiktok|facebook|twitter|x\\.com)', '^#\\w+(?:\\s+#\\w+)+$', '^\\d{1,2}:\\d{2}(?::\\d{2})?\\s'
].join('|'), 'i')

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const heading = (line: string) => fold(line.replace(/^[#*\s]+|[*:\s]+$/g, ''))
const isIngredientsHeading = (line: string) => {
  const h = heading(line)
  if (/^(?:ingredients?|what you(?:'|’)?ll need|you will need|shopping list|υλικα)$/.test(h)) return true
  if (h.length <= 35 && !/^(?:it|this|that|how|why|i|you|we|there|when|what)\b/.test(h) && /(?:^|\s)(?:recipe|ingredients|shopping list)$/.test(h)) return true
  return false
}
const isMethodHeading = (line: string) => /^(?:method|instructions?|directions?|preparation|steps|how to make(?: it)?|εκτελεση|οδηγιες|παρασκευη|μεθοδος)$/.test(heading(line))
const isServeHeading = (line: string) => /^(?:to serve|serving|serve|to finish|plating|σερβιρισμα)$/.test(heading(line))
const isStopHeading = (line: string) => /^(?:notes?|tips?|equipment|nutrition|chapters?|timestamps?|breakdown|video breakdown|video chapters?|music|credits|thanks|enjoy|find |follow |σημειωσεις|συμβουλες)/.test(heading(line))
const groupHeading = (line: string) => {
  const match = line.replace(/[:\s]+$/, '').match(/^(?:for (?:the )?|για (?:το |τη |την |τα |τον |τις )?)(.{2,50})$/i)
  return match ? match[1]!.trim() : null
}
const NUMBERED = /^(?:step\s*|βημα\s*)?(\d{1,2})\s*[.):–-]\s+(.+)$/i
const BULLET = /^[-•*·–]\s+/
const HAS_QUANTITY = /^(?:\d|[½¼¾⅓⅔⅛])/

/** Remove promotional lines (channel memberships, subscribe prompts, links, timestamps). */
export function stripPromotional(text: string): string {
  return text.split(/\r?\n/)
    .filter(line => !EXTERNAL_URL.test(line) && !PROMOTIONAL.test(line.replace(/[\p{Extended_Pictographic}️]/gu, '').trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}


function ingredientFrom(line: string, group: string | null, servings: number): IngredientDraft {
  const text = line.replace(BULLET, '').trim()
  const groupNote = group ? `For the ${group.toLocaleLowerCase()}` : null
  if (HAS_QUANTITY.test(text)) {
    const parsed = parseIngredientLine(text, servings)
    const notes = [groupNote, parsed.notes].filter(Boolean).join(' · ')
    return { ...parsed, ...(notes ? { notes } : {}) }
  }
  // "Salt, to taste", "Knob of butter": keep the source wording; never invent an amount.
  return { name: text.slice(0, 200), amount: 0, unit: 'as needed', ...(groupNote ? { notes: groupNote } : {}) }
}

/**
 * Parse recipe text that already carries its own structure — an ingredients section and a method,
 * usually numbered — as found in video descriptions, blog text and pasted notes.
 * Ingredient-only descriptions retain their measurements with a video-method placeholder.
 */
export function parseStructuredRecipe(text: string | null | undefined, fallbackServings = 4): StructuredRecipe | null {
  if (!text?.trim()) return null
  const lines = stripPromotional(text).split('\n').map(line => line.trim())
  const explicitIngredients = lines.some(isIngredientsHeading)
  const intro: string[] = []
  const ingredientLines: { line: string, group: string | null }[] = []
  const blocks: { title: string | null, body: string[] }[] = []
  let state: 'intro' | 'ingredients' | 'method' | 'serve' | 'tail' = 'intro'
  let group: string | null = null
  let numbered = false

  for (const line of lines) {
    if (isIngredientsHeading(line)) {
      state = 'ingredients'
      group = /\srecipe$/i.test(heading(line)) ? line.replace(/^[#*\s]+|[*:\s]+$/g, '').replace(/\s+recipe$/i, '') : null
      continue
    }
    if (isMethodHeading(line)) { state = 'method'; continue }
    if (isServeHeading(line) && (state === 'method' || state === 'ingredients')) { state = 'serve'; blocks.push({ title: 'To serve', body: [] }); continue }
    if (isStopHeading(line) && state !== 'intro') { state = 'tail'; continue }
    if (state === 'tail') continue
    const step = line.match(NUMBERED)
    if (step && (state === 'method' || state === 'ingredients' || state === 'serve')) {
      state = 'method'
      numbered = true
      blocks.push({ title: step[2]!.trim(), body: [] })
      continue
    }
    if (state === 'intro') {
      if (!explicitIngredients && HAS_QUANTITY.test(line)) {
        state = 'ingredients'
        const prev = intro.pop()
        if (prev && prev.length <= 60 && !/[.!?]$/.test(prev) && !groupHeading(prev)) {
          group = prev
        } else if (prev) {
          intro.push(prev)
        }
        ingredientLines.push({ line, group })
        continue
      }
      intro.push(line); continue
    }
    if (state === 'ingredients') {
      if (!line) continue
      const name = groupHeading(line)
      if (name && !HAS_QUANTITY.test(line)) { group = name; continue }
      if (line.length <= 160) ingredientLines.push({ line, group })
      continue
    }
    // Method or serve text: numbered methods collect sub-lines; unnumbered methods split on paragraphs.
    if (!line) { if (state === 'method' && !numbered) blocks.push({ title: null, body: [] }); continue }
    if (!blocks.length) blocks.push({ title: null, body: [] })
    blocks.at(-1)!.body.push(line.replace(BULLET, ''))
  }

  let lastOven: { temperature: number, unit: 'C' | 'F' } | null = null
  const steps: StepDraft[] = blocks
    .filter(block => block.title || block.body.length)
    .map((block, index) => {
      const body = block.body.join(' ').replace(/\s+/g, ' ').trim()
      const title = block.title?.trim() ?? ''
      let instruction = title && body ? `${title}${/[.!?:]$/.test(title) ? '' : '.'} ${body}` : title || body
      const oven = ovenTemperature(instruction)
      if (oven && /oven|preheat|φουρν|προθερμ/i.test(fold(instruction))) lastOven = oven
      else if (!oven && lastOven && /\boven\b|φουρν/.test(fold(instruction))) instruction += ` (oven at ${lastOven.temperature}°${lastOven.unit})`
      return timedStep(instruction, index + 1)
    })
  const ingredientsOnly = steps.length === 0 && ingredientLines.length >= 2
  if (steps.length < 2 && !ingredientsOnly) return null
  if (ingredientsOnly) steps.push(timedStep("Follow video for cooking method. Ingredients and proportions are saved from the creator's description.", 1))

  const servingsMatch = fold(text).match(/\bserves\s+(\d{1,3})|(\d{1,3})\s+servings|μεριδες\s*:?\s*(\d{1,3})/)
  const servings = servingsMatch ? Number(servingsMatch[1] ?? servingsMatch[2] ?? servingsMatch[3]) : null
  const paragraphs = intro.join('\n').split(/\n\s*\n|\n/).map(paragraph => paragraph.trim()).filter(Boolean)
  const lede = paragraphs.find(paragraph => paragraph.length >= 25)
  const description = lede ? (lede.match(/^(?:[^.!?]+[.!?]+\s*){1,2}/)?.[0] ?? lede).trim().slice(0, 300) : null

  return {
    description: ingredientsOnly ? 'Imported from video description.' : description,
    notes: paragraphs.join('\n\n').slice(0, 9000),
    servings: servings && servings > 0 && servings <= 1000 ? servings : null,
    ingredients: ingredientLines.map(item => ingredientFrom(item.line, item.group, servings ?? fallbackServings)),
    steps,
    cookTimeMinutes: steps.reduce((sum, step) => sum + (step.durationMinutes ?? 0), 0)
  }
}

/** True when every ingredient is an offline starting-draft placeholder rather than a source measurement. */
export function isPlaceholderIngredients(ingredients: { notes?: string | null }[]): boolean {
  return ingredients.length > 0 && ingredients.every(row => (row.notes ?? '').includes('Deterministic baseline'))
}

export const OFFLINE_DRAFT_DESCRIPTION = 'Deterministic culinary starting point, not a reconstruction of the source.'

type SplitSource = {
  title: string
  description?: string | null
  prepTimeMinutes?: number | null
  ingredients: { notes?: string | null }[]
  steps: unknown[]
}

/**
 * Update that replaces a recipe's steps with the numbered method found in its notes.
 * Ingredients are replaced only when the current ones are offline placeholders, and the
 * description only when it is the offline-draft disclaimer; the notes keep just the story.
 */
export function splitNotesUpdate(recipe: SplitSource, plan: StructuredRecipe) {
  const replaceIngredients = plan.ingredients.length > 0 && (recipe.ingredients.length === 0 || isPlaceholderIngredients(recipe.ingredients))
  const ingredients = replaceIngredients ? plan.ingredients : undefined
  const steps = enrichScience({ title: recipe.title, description: recipe.description ?? '', ingredients: plan.ingredients, steps: plan.steps }).steps ?? plan.steps
  const prep = recipe.prepTimeMinutes ?? 15
  return {
    steps,
    ...(ingredients ? { ingredients } : {}),
    heirloomNotes: plan.notes,
    ...((recipe.description ?? '').startsWith(OFFLINE_DRAFT_DESCRIPTION) && plan.description ? { description: plan.description } : {}),
    ...(plan.cookTimeMinutes > 0 ? { cookTimeMinutes: plan.cookTimeMinutes, totalTimeMinutes: Math.min(100000, prep + plan.cookTimeMinutes) } : {})
  }
}

/** "a 7-step" / "an 8-step" / "an 11-step" — English article by pronunciation of the number. */
export const stepCountPhrase = (count: number) => `${/^(?:8\d*|11|18)$/.test(String(count)) ? 'an' : 'a'} ${count}-step`
