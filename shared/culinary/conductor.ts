import { parseDurations } from './durations'
import { fold } from './grocery'
import { ovenTemperature } from './heat'

export const conductorCourses = ['appetizer', 'main', 'side', 'dessert', 'beverage'] as const
export type ConductorCourse = typeof conductorCourses[number]
export type Phase = 'prep' | 'cook' | 'rest' | 'plate'
export const phaseLabels: Record<Phase, string> = { prep: 'Advance prep', cook: 'Active cooking', rest: 'Resting & holding', plate: 'Plating & serving' }
// Serving offsets after the first course, following the docs/05 dinner scenario (starter, main +25, dessert +60).
const courseOffsets: Record<ConductorCourse, number> = { appetizer: 0, beverage: 0, main: 25, side: 25, dessert: 60 }
const serviceBuffer = 30

export type ConductorStep = { stepNumber: number, instruction: string, durationMinutes?: number | null, heatLevel?: string | null }
export type ConductorRecipe = { id: string, title: string, steps: ConductorStep[] }
export type ConductorInput = { courses: { course: ConductorCourse, recipe: ConductorRecipe, serveAt?: string }[], targetTime: string, burners?: number, ovens?: number }

const word = (stems: string) => new RegExp(`(?:^| )(?:${stems})`)
const advance = word('marinat|soak|overnight|prove|proof|rise|chill|refrigerat|μαριναρ|μουλια|φουσκω|ψυγει')
const cooking = word('bake|roast|broil|sear|fry|fried|saute|simmer|boil|braise|poach|steam|toast|caramel|reduce|heat|cook|preheat|blanch|brown|melt|ψησ|ψην|ψηστ|τηγαν|σοταρ|βρασ|βραζ|σιγοβρασ|μαγειρ|ζεσταν|προθερμ|λιων|καβουρδ|ροδιζ')
const resting = /(?:^| )(?:let rest|allow to rest|rest\b(?!\s+(?:of|of the|of your)\b)|cool|stand|keep warm|hold|ξεκουραστ|κρυωσ|κρυωνε)/
const plating = /(?:^| )(?:serve|plate|garnish|drizzle|unmold|unmould|carve|dust\b(?!\s+.*with flour)|σερβιρ|γαρνιρ|πασπαλ)/
const ovenUse = word('oven|bake|roast|broil|preheat|φουρν|ψησ|ψην|ψηστ|προθερμ')
const burnerUse = word('sear|fry|fried|saute|simmer|boil|braise|poach|steam|blanch|melt|reduce|stovetop|stove|hob|skillet|pan|pot|saucepan|wok|burner|τηγαν|σοταρ|βρασ|βραζ|σιγοβρασ|κατσαρολ|λιων|καβουρδ')

export function classifyStep(step: ConductorStep) {
  const text = fold(step.instruction)
  const isPlate = plating.test(text)
  const offHeat = /(?:remove from\s+|off\s+(?:the\s+)?)heat/
  const isCooking = cooking.test(text) && !offHeat.test(text)
  const isAdvance = advance.test(text) || /dust\b.*with flour/.test(text)
  const isRest = resting.test(text)

  const phase: Phase = isAdvance ? 'prep'
    : (isPlate && (!isCooking || offHeat.test(text))) ? 'plate'
    : isCooking ? 'cook'
    : isRest ? 'rest'
    : isPlate ? 'plate'
    : 'prep'
  // Greek ψήνω also means grilling; a grill or frying pan is not the oven.
  const oven = ovenUse.test(text) && !/(?:^| )(?:σχαρ|τηγαν|grill pan)/.test(text)
  const heated = step.heatLevel != null && step.heatLevel !== 'none'
  const burners = (burnerUse.test(text) || (heated && !oven)) ? (word('two (?:pans|pots|skillets)|δυο (?:τηγαν|κατσαρολ)').test(text) ? 2 : 1) : 0
  const reading = oven ? ovenTemperature(step.instruction) : null
  const ovenTempC = reading ? Math.round(reading.unit === 'F' ? (reading.temperature - 32) * 5 / 9 : reading.temperature) : null
  return { phase, oven, ovenTempC, burners }
}

export function stepMinutes(step: ConductorStep, phase: Phase) {
  if (step.durationMinutes && step.durationMinutes > 0) return step.durationMinutes
  const parsed = parseDurations(step.instruction)
  if (parsed.length) return Math.max(1, Math.ceil(parsed.reduce((sum, seconds) => sum + seconds, 0) / 60))
  const text = fold(step.instruction)
  if (/overnight|απο το βραδυ/.test(text)) return 480
  if (word('prove|proof|rise|φουσκω').test(text)) return 60
  if (word('marinat|μαριναρ').test(text)) return 60
  if (word('chill|refrigerat|ψυγει').test(text)) return 30
  if (word('preheat|προθερμ').test(text)) return 15
  return { prep: 10, cook: 10, rest: 5, plate: 5 }[phase]
}

const clockPattern = /^([01]\d|2[0-3]):([0-5]\d)$/
export function parseClock(value: string) {
  const match = clockPattern.exec(value)
  if (!match) throw new RangeError('Use a 24-hour HH:MM time')
  return Number(match[1]) * 60 + Number(match[2])
}
const pad = (value: number) => String(value).padStart(2, '0')
export const relativeLabel = (minutes: number) => minutes <= 0 ? `T-${-minutes}m` : `T+${minutes}m`

export type TimelineEvent = {
  id: string, course: ConductorCourse, courseIndex: number, recipeId: string, recipeTitle: string, stepNumber: number | null, instruction: string,
  phase: Phase, oven: boolean, ovenTempC: number | null, burners: number, start: number, end: number, duration: number, label: string, clock: string, dayOffset: number, synthetic: boolean
}
export type Bottleneck = {
  type: 'oven_temperature' | 'burner_overload', start: number, end: number, label: string, clock: string, message: string, resolutions: string[],
  steps: { id: string, course: ConductorCourse, recipeTitle: string, instruction: string, ovenTempC: number | null, burners: number }[]
}

export function conduct(input: ConductorInput) {
  const target = parseClock(input.targetTime), burners = input.burners ?? 4, ovens = input.ovens ?? 1
  const at = (offset: number) => { const total = target + offset; return { clock: `${pad(Math.floor(((total % 1440) + 1440) % 1440 / 60))}:${pad(((total % 60) + 60) % 60)}`, dayOffset: Math.floor(total / 1440) } }
  const first = Math.min(...input.courses.map(row => courseOffsets[row.course]))
  const events: TimelineEvent[] = [], serves: { course: ConductorCourse, recipeId: string, recipeTitle: string, offset: number, label: string, clock: string, dayOffset: number }[] = [], warnings: string[] = []
  // Explicit serve times are the nearest occurrence to the target (so 00:15 after a 23:30 target is +45).
  const offsets = input.courses.map(({ course, serveAt }) => serveAt ? ((parseClock(serveAt) - target + 720 + 1440) % 1440) - 720 : courseOffsets[course] - first)
  // The host is plating once service starts, so advance prep must be finished before then.
  const prepDeadline = Math.min(...offsets) - serviceBuffer
  input.courses.forEach(({ course, recipe }, courseIndex) => {
    const offset = offsets[courseIndex]!
    serves.push({ course, recipeId: recipe.id, recipeTitle: recipe.title, offset, label: relativeLabel(offset), ...at(offset) })
    const steps = [...recipe.steps].sort((a, b) => a.stepNumber - b.stepNumber).map(step => ({ step, ...classifyStep(step), synthetic: false }))
    if (!steps.length) warnings.push(`${recipe.title} has no method steps; add them to include it in the timeline.`)
    const firstOven = steps.findIndex(row => row.oven)
    if (firstOven >= 0 && !steps.slice(0, firstOven + 1).some(row => word('preheat|προθερμ').test(fold(row.step.instruction)))) {
      const tempC = steps.slice(firstOven).find(row => row.oven && row.ovenTempC != null)?.ovenTempC ?? null
      steps.splice(firstOven, 0, { step: { stepNumber: 0, instruction: tempC ? `Preheat the oven to ${tempC} °C` : 'Preheat the oven', durationMinutes: 15 }, phase: 'cook', oven: true, ovenTempC: tempC, burners: 0, synthetic: true })
    }
    let end = offset
    const scheduled: TimelineEvent[] = []
    for (let index = steps.length - 1; index >= 0; index--) {
      const row = steps[index]!, duration = stepMinutes(row.step, row.phase), start = end - duration
      scheduled.unshift({
        id: `${courseIndex}-${index}`, course, courseIndex, recipeId: recipe.id, recipeTitle: recipe.title, stepNumber: row.synthetic ? null : row.step.stepNumber,
        instruction: row.step.instruction, phase: row.phase, oven: row.oven, ovenTempC: row.ovenTempC, burners: row.burners, start, end, duration, label: relativeLabel(start), ...at(start), synthetic: row.synthetic
      })
      end = start
    }
    // Leading prep (mise en place, chilling, marinating) only ever moves earlier; food waits safely in the fridge.
    const firstActive = scheduled.findIndex(event => event.phase !== 'prep')
    const leading = scheduled.slice(0, firstActive === -1 ? scheduled.length : firstActive)
    const shift = leading.length ? leading.at(-1)!.end - prepDeadline : 0
    if (shift > 0) for (const event of leading) Object.assign(event, { start: event.start - shift, end: event.end - shift, label: relativeLabel(event.start - shift), ...at(event.start - shift) })
    events.push(...scheduled)
  })
  events.sort((a, b) => a.start - b.start || a.courseIndex - b.courseIndex || a.end - b.end)
  const bottlenecks = [...ovenConflicts(events, ovens), ...burnerConflicts(events, burners)].map(item => ({ ...item, label: relativeLabel(item.start), clock: at(item.start).clock }))
  return { targetTime: input.targetTime, serves: serves.sort((a, b) => a.offset - b.offset), timeline: events, bottlenecks: bottlenecks.sort((a, b) => a.start - b.start), warnings }
}

// Elementary time slices in which the active set is constant; contiguous slices involving the same recipes merge into one conflict.
function windows(events: TimelineEvent[], conflicting: (active: TimelineEvent[]) => TimelineEvent[] | null) {
  const points = [...new Set(events.flatMap(event => [event.start, event.end]))].sort((a, b) => a - b)
  const found: { start: number, end: number, steps: TimelineEvent[] }[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i]!, end = points[i + 1]!
    const steps = conflicting(events.filter(event => event.start < end && event.end > start))
    if (!steps) continue
    const last = found.at(-1), recipes = (list: TimelineEvent[]) => [...new Set(list.map(step => step.courseIndex))].sort().join()
    if (last && last.end === start && recipes(last.steps) === recipes(steps)) { last.end = end; last.steps.push(...steps.filter(step => !last.steps.includes(step))) }
    else found.push({ start, end, steps: [...steps] })
  }
  return found
}
const summary = (step: TimelineEvent) => ({ id: step.id, course: step.course, recipeTitle: step.recipeTitle, instruction: step.instruction, ovenTempC: step.ovenTempC, burners: step.burners })

function ovenConflicts(events: TimelineEvent[], ovens: number): Omit<Bottleneck, 'label' | 'clock'>[] {
  return windows(events.filter(event => event.oven && event.ovenTempC != null), active => {
    // Group settings within 15 °C; more groups than ovens means one oven is asked for two temperatures at once.
    const temps = [...new Set(active.map(step => step.ovenTempC!))].sort((a, b) => a - b)
    let groups = 0, groupStart = -Infinity
    for (const temp of temps) if (temp - groupStart > 15) { groups++; groupStart = temp }
    return groups > ovens ? [...active].sort((a, b) => a.ovenTempC! - b.ovenTempC!) : null
  }).map(({ start, end, steps }) => {
    steps.sort((a, b) => a.ovenTempC! - b.ovenTempC!)
    const cool = steps[0]!, hot = steps.at(-1)!, gap = hot.ovenTempC! - cool.ovenTempC!
    const settings = [...new Set(steps.map(step => `${step.recipeTitle} at ${step.ovenTempC} °C`))]
    const movable = steps.find(step => step.course === 'dessert') ?? steps.find(step => step.course === 'side' || step.course === 'appetizer')
    const resolutions = [
      movable ? `Bake ${movable.recipeTitle} earlier, before the other dish needs the oven, then hold it and rewarm at 150 °C for 5–8 minutes just before serving; or bake it after the main comes out.`
        : `Cook ${cool.recipeTitle} first and hold it covered, then raise the oven to ${hot.ovenTempC} °C for ${hot.recipeTitle}.`,
      ...(gap <= 35 ? [`With a fan oven, run ${hot.recipeTitle} at ${hot.ovenTempC! - 20} °C (its fan equivalent) so both share the oven; ${cool.recipeTitle} then cooks faster, so shorten its time by about 20% and check early.`] : []),
      'When sharing or shifting oven slots, confirm doneness by internal temperature rather than time.'
    ]
    return { type: 'oven_temperature' as const, start, end, steps: steps.map(summary), message: `Oven conflict: ${settings.join(' vs ')} (${gap} °C apart) with ${ovens} oven${ovens > 1 ? 's' : ''}.`, resolutions }
  })
}

function burnerConflicts(events: TimelineEvent[], burners: number): Omit<Bottleneck, 'label' | 'clock'>[] {
  return windows(events.filter(event => event.burners > 0), active => active.reduce((sum, step) => sum + step.burners, 0) > burners ? active : null).map(({ start, end, steps }) => {
    const required = steps.reduce((sum, step) => sum + step.burners, 0)
    // Simmered and braised components hold well, so they are the natural ones to start early.
    const holdable = steps.find(step => word('simmer|braise|boil|sauce|stock|σιγοβρασ|βρασ|σαλτσ').test(fold(step.instruction))) ?? steps[0]!
    return {
      type: 'burner_overload' as const, start, end, steps: steps.map(summary),
      message: `Burner overload: ${required} burners needed at once, ${burners} available.`,
      resolutions: [
        `Stagger: start "${holdable.instruction}" (${holdable.recipeTitle}) earlier and keep it warm over the lowest heat or in a 90 °C oven.`,
        'Finish a sauce or side in advance and reheat it, or move a braise into the oven, to free a burner.'
      ]
    }
  })
}
