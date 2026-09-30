import type { RecipeInput } from '../../server/utils/validation'
import { parseDurations } from './durations'

type StepDraft = NonNullable<RecipeInput['steps']>[number]
export type HeatLevel = NonNullable<StepDraft['heatLevel']>

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export function heatLevelOf(text: string): HeatLevel | null {
  const value = fold(text)
  if (/medium[- ]high heat/.test(value)) return 'medium-high'
  if (/medium[- ]low heat/.test(value)) return 'medium-low'
  if (/medium heat/.test(value)) return 'medium'
  if (/\bhigh heat|\bbring (?:it |them |everything |the \w+ )?to (?:a |the )?(?:rolling )?boil/.test(value)) return 'high'
  if (/\blow heat|\bsimmer/.test(value)) return 'low'
  return null
}

/** Step with its timer and heat derived from the instruction text; ranges use the lower bound. */
export function timedStep(instruction: string, stepNumber: number): StepDraft {
  const seconds = parseDurations(instruction).reduce((sum, value) => sum + value, 0)
  const heatLevel = heatLevelOf(instruction)
  return {
    stepNumber,
    instruction: instruction.slice(0, 10000),
    durationMinutes: seconds ? Math.min(100000, Math.ceil(seconds / 60)) : null,
    timerRequired: seconds > 0,
    ...(heatLevel ? { heatLevel } : {})
  }
}

// Inline numbering ("1. Heat… 2) Add… Step 3: Bake…") only counts when it runs 1, 2, 3 in order.
const INLINE_NUMBER = /(?:^|\s)(?:step\s*)?(\d{1,2})\s*[.):]\s+/giu
const ABBREVIATION = /\b(?:approx|appr|tbsp|tbs|tsp|oz|lb|lbs|min|mins|hr|hrs|sec|pkg|no|vs|e\.g|i\.e|etc|dr|st|mt|ca)\.$/i
// Lower-case initials ("a.", "c.") only; "180 °C." and "350 F." end real sentences.
const INITIAL = /(?:^|\s)[a-z]\.$/
// Follow-on sentences explain the previous action rather than start a new one.
const CONTINUATION = /^(?:this|that|these|those|it|it's|they|otherwise|which|so|because|note|tip|don't|do not|be careful|careful|if needed|if necessary)\b/i

function splitNumbered(text: string): string[] | null {
  const marks: { index: number, end: number }[] = []
  for (const match of text.matchAll(INLINE_NUMBER)) {
    if (Number(match[1]) !== marks.length + 1) continue
    marks.push({ index: match.index!, end: match.index! + match[0].length })
  }
  if (marks.length < 2) return null
  const lead = text.slice(0, marks[0]!.index).trim()
  const parts = marks.map((mark, i) => text.slice(mark.end, marks[i + 1]?.index ?? text.length).trim())
  return [...(lead ? [lead] : []), ...parts].filter(Boolean)
}

function splitSentences(text: string): string[] {
  const pieces = text.split(/(?<=[.!?;])\s+(?=["“‘(]?[\p{Lu}\d])/u)
  const sentences: string[] = []
  for (const piece of pieces) {
    const previous = sentences.at(-1)
    if (previous && (ABBREVIATION.test(previous) || INITIAL.test(previous) || CONTINUATION.test(piece) || piece.split(/\s+/).length < 2 || previous.split(/\s+/).length < 2)) sentences[sentences.length - 1] = previous + ' ' + piece
    else sentences.push(piece)
  }
  return sentences.map(sentence => sentence.trim()).filter(Boolean)
}

/** Split an instruction blob into discrete actions: explicit 1-2-3 numbering first, then sentences. */
export function splitInstructions(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return []
  return (splitNumbered(normalized) ?? [normalized]).flatMap(splitSentences)
}

// Imperative cooking verbs; inflected narrative forms ("roasted", "baked") deliberately do not match.
const COOKING_VERB = /(?:^|[\s,;:(])(?:preheat|heat|warm|add|rub|coat|stuff|fill|wrap|dust|dip|scatter|mix|stir|whisk|beat|cream|fold|combine|bake|roast|fry|saute|sauté|sear|brown|grill|broil|simmer|boil|poach|steam|braise|stew|cook|chop|slice|dice|mince|grate|peel|cut|trim|season|salt|marinate|pour|knead|shape|roll|rest|cover|drain|rinse|soak|bring|reduce|place|put|transfer|remove|spread|sprinkle|toss|blend|puree|purée|melt|cool|chill|refrigerate|freeze|serve|garnish|drizzle|squeeze|layer|arrange|brush|let|leave|wait|turn|flip|baste|strain|zest|juice|ψήνουμε|ψήστε|βράζουμε|βράστε|προσθέτουμε|προσθέστε|ανακατεύουμε|ανακατέψτε|κόβουμε|κόψτε|τσιγαρίζουμε|σοτάρουμε|αλατίζουμε|ρίχνουμε|αφήνουμε|αφήστε|σερβίρουμε|προθερμαίνουμε|ζυμώνουμε|πλένουμε|καθαρίζουμε|στραγγίζουμε|σκεπάζουμε|χτυπάμε|απλώνουμε|βάζουμε|μαγειρεύουμε)(?![\p{L}])/iu

export const EXTERNAL_URL = /https?:\/\/|\b(?:amzn\.to|bit\.ly|www\.)/i
const INGREDIENT_QUANTITY = /^(?:\d|[½¼¾⅓⅔⅛⅜⅝⅞])/
const INGREDIENT_DESCRIPTION = /^(?:(?:salt|pepper)(?:\s+and\s+(?:salt|pepper))?(?:\s*[,(:]|\s*$)|(?:chopped|minced|sliced|diced|ground|steamed|uncooked)\b.*\b(?:for garnish|for serving|to taste)\b)/i

/** Sentences from free text that describe a cooking action or carry a duration. */
export function cookingSentences(text: string): string[] {
  return text.split(/\n+/).filter(line => !EXTERNAL_URL.test(line))
    .flatMap(line => splitInstructions(line.replace(/^\s*[-•*·–]\s+/, '')))
    .filter(sentence => sentence.length <= 400 && !INGREDIENT_QUANTITY.test(sentence) && !INGREDIENT_DESCRIPTION.test(sentence)
      && (COOKING_VERB.test(sentence.toLowerCase()) || parseDurations(sentence).length > 0))
}
