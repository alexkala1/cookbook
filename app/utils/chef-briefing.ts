import type { Bottleneck, ConductorCourse, TimelineEvent } from '#shared/culinary/conductor'
import type { DietaryAudit } from '#shared/culinary/dietary'

export type BriefingServe = { course: ConductorCourse, recipeId: string, recipeTitle: string, offset: number, clock: string, dayOffset: number }
export type BriefingPlan = { serves: BriefingServe[], timeline: TimelineEvent[], bottlenecks: Bottleneck[] }
export type Milestone = { key: string, clock: string, dayOffset: number, start: number, kind: 'start' | 'oven' | 'serve', text: string }
/** audit: null when no guests were chosen; 'failed' when the check could not run. */
export type BriefingGuests = { names: string[], audit: DietaryAudit | null | 'failed' }

const courseNames: Record<ConductorCourse, string> = { appetizer: 'appetizer', main: 'main', side: 'side', dessert: 'dessert', beverage: 'drinks' }
const conflictNames = { critical_allergen: 'allergen', dietary_conflict: 'dietary conflict', dislike_warning: 'dislike' } as const

export function spokenMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60), rest = Math.round(minutes % 60)
  if (!hours) return `${rest} min`
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}
const list = (items: string[]) => items.length <= 1 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items.at(-1)
export const dayPrefix = (offset: number) => offset === -1 ? 'the day before, ' : offset < -1 ? `${-offset} days before, ` : offset === 1 ? 'the next day, ' : ''

/** Wall-clock milestones: when each dish starts, goes into the oven, and is served. */
export function milestones(plan: BriefingPlan): Milestone[] {
  const out: Milestone[] = []
  const byRecipe = new Map<string, TimelineEvent[]>()
  for (const event of [...plan.timeline].sort((a, b) => a.start - b.start)) byRecipe.set(event.recipeId + event.course, [...(byRecipe.get(event.recipeId + event.course) ?? []), event])
  for (const events of byRecipe.values()) {
    const first = events[0]!
    out.push({ key: 'start-' + first.id, clock: first.clock, dayOffset: first.dayOffset, start: first.start, kind: 'start', text: `Start ${first.recipeTitle}${first.oven ? ` in the oven${first.ovenTempC ? ` at ${first.ovenTempC} °C` : ''}` : ''}` })
    events.forEach((event, i) => {
      if (i > 0 && event.oven && !events[i - 1]!.oven) out.push({ key: 'oven-' + event.id, clock: event.clock, dayOffset: event.dayOffset, start: event.start, kind: 'oven', text: `${event.recipeTitle} in the oven${event.ovenTempC ? ` at ${event.ovenTempC} °C` : ''}` })
    })
  }
  for (const serve of plan.serves) out.push({ key: 'serve-' + serve.recipeId + serve.course, clock: serve.clock, dayOffset: serve.dayOffset, start: serve.offset, kind: 'serve', text: `Serve the ${courseNames[serve.course]}: ${serve.recipeTitle}` })
  const order = { start: 0, oven: 1, serve: 2 }
  return out.sort((a, b) => a.start - b.start || order[a.kind] - order[b.kind])
}

/** Plain-English strategy for the host: where to begin, what the oven is doing, what needs attention. */
export function chefBriefing(plan: BriefingPlan, ovens: number, guests: BriefingGuests): string[] {
  const lines: string[] = []
  const events = [...plan.timeline].sort((a, b) => a.start - b.start)
  const serves = [...plan.serves].sort((a, b) => a.offset - b.offset)
  const first = events[0], firstServe = serves[0]
  if (firstServe) {
    if (first) {
      const serveOf = serves.find(serve => serve.recipeId === first.recipeId && serve.course === first.course) ?? firstServe
      lines.push(`Guests sit down at ${firstServe.clock}. Begin at ${first.clock} ${dayPrefix(first.dayOffset)}with ${first.recipeTitle}: it needs the longest runway, ${spokenMinutes(serveOf.offset - first.start)} before it is served.`)
    } else lines.push(`Guests sit down at ${firstServe.clock}. Nothing needs cooking ahead; plate and serve.`)
  }
  // First oven step per dish (events are time-sorted), so "from" is when it goes in, not its last oven step.
  const ovenDishes: TimelineEvent[] = []
  for (const event of events) if (event.oven && !ovenDishes.some(dish => dish.recipeId === event.recipeId && dish.course === event.course)) ovenDishes.push(event)
  if (ovenDishes.length) lines.push(`The oven works for ${list(ovenDishes.map(event => `${event.recipeTitle}${event.ovenTempC ? ` (${event.ovenTempC} °C)` : ''} from ${event.clock}`))}.`)
  lines.push(plan.bottlenecks.length
    ? `${plan.bottlenecks.length === 1 ? 'One equipment clash needs' : `${plan.bottlenecks.length} equipment clashes need`} a decision; the workarounds are right below.`
    : `Your ${ovens === 1 ? 'oven' : `${ovens} ovens`} and burners can handle everything as scheduled.`)
  if (guests.names.length) {
    if (guests.audit === 'failed') lines.push('Guest allergens could not be checked just now. Review them on the Guests page before cooking.')
    else if (guests.audit) {
      // One entry per guest and dish, naming every flagged ingredient in it.
      const flagged = new Map<string, { guest: string, recipe: string, type: keyof typeof conflictNames, ingredients: string[] }>()
      for (const conflict of guests.audit.conflicts.filter(item => item.type !== 'dislike_warning')) {
        const key = conflict.guestName + '\u0000' + conflict.recipeTitle
        const entry = flagged.get(key) ?? { guest: conflict.guestName, recipe: conflict.recipeTitle, type: conflict.type, ingredients: [] }
        if (!entry.ingredients.includes(conflict.ingredient)) entry.ingredients.push(conflict.ingredient)
        if (conflict.type === 'critical_allergen') entry.type = 'critical_allergen'
        flagged.set(key, entry)
      }
      const entries = [...flagged.values()]
      lines.push(entries.length
        ? `Check with ${list([...new Set(entries.map(entry => entry.guest))])}: ${list(entries.slice(0, 3).map(entry => `${list(entry.ingredients)} in ${entry.recipe} (${conflictNames[entry.type]})`))}${entries.length > 3 ? ` and ${entries.length - 3} more` : ''}.`
        : `No ingredient flags for ${list(guests.names)}. Still confirm labels and cross-contact with them.`)
    }
  }
  if (events.some(event => event.dayOffset < 0)) lines.push('Some prep happens the day before, so start with the first lines of the schedule.')
  return lines
}
