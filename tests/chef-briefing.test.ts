import { describe, expect, it } from 'vitest'
import { conduct, type ConductorCourse } from '../shared/culinary/conductor'
import type { DietaryAudit } from '../shared/culinary/dietary'
import { chefBriefing, milestones, spokenMinutes } from '../app/utils/chef-briefing'

const recipe = (id: string, title: string, steps: string[]) => ({ id, title, steps: steps.map((instruction, index) => ({ stepNumber: index + 1, instruction })) })
const course = (value: ConductorCourse, r: ReturnType<typeof recipe>) => ({ course: value, recipe: r })
const sunday = (ovens = 1) => conduct({
  targetTime: '15:00', ovens,
  courses: [
    course('appetizer', recipe('s', 'Spanakopita', ['Layer the filo and filling.', 'Bake at 180°C for 45 minutes.', 'Rest 10 minutes, then cut.'])),
    course('main', recipe('l', 'Arni me Patates', ['Season the lamb and potatoes.', 'Roast at 200°C for 2 hours.', 'Rest the lamb for 15 minutes.']))
  ]
})

describe('spokenMinutes', () => {
  it('reads like a person would say it', () => {
    expect([spokenMinutes(45), spokenMinutes(60), spokenMinutes(135)]).toEqual(['45 min', '1 h', '2 h 15 min'])
  })
})

describe('milestones', () => {
  it('lists when each dish starts, goes in the oven and is served, in clock order', () => {
    const times = milestones(sunday()).map(item => `${item.clock} ${item.text}`)
    expect(times.filter(line => /Start|oven|Serve/.test(line))).toEqual(times)
    expect(times.at(-1)).toMatch(/^15:25 Serve the main: Arni me Patates$/)
    expect(times).toContain('15:00 Serve the appetizer: Spanakopita')
    expect(times.some(line => /Arni me Patates in the oven at 200 °C$/.test(line))).toBe(true)
    const starts = times.filter(line => line.includes('Start'))
    expect(starts).toHaveLength(2)
    expect(starts[0]).toContain('Arni me Patates')
    expect(milestones(sunday()).map(item => item.start)).toEqual([...milestones(sunday()).map(item => item.start)].sort((a, b) => a - b))
  })
})

describe('chefBriefing', () => {
  const noGuests = { names: [], audit: null }
  it('opens with the sit-down time and the longest-runway dish', () => {
    const plan = sunday()
    const [first] = chefBriefing(plan, 1, noGuests)
    const lamb = plan.timeline.filter(event => event.recipeId === 'l').sort((a, b) => a.start - b.start)[0]!
    expect(first).toBe(`Guests sit down at 15:00. Begin at ${lamb.clock} with Arni me Patates: it needs the longest runway, ${spokenMinutes(25 - lamb.start)} before it is served.`)
  })
  it('explains oven use and either the clash or the all-clear without the schedule banner’s wording', () => {
    const one = chefBriefing(sunday(1), 1, noGuests).join(' ')
    expect(one).toMatch(/The oven works for .*Spanakopita \(180 °C\) from \d\d:\d\d/)
    expect(one).toMatch(/The oven works for .*Arni me Patates \(200 °C\) from \d\d:\d\d/)
    const plan = sunday(1)
    const firstOven = (id: string) => plan.timeline.filter(event => event.recipeId === id && event.oven).sort((a, b) => a.start - b.start)[0]!.clock
    expect(one).toContain(`Arni me Patates (200 °C) from ${firstOven('l')}`)
    expect(one).toContain(`Spanakopita (180 °C) from ${firstOven('s')}`)
    expect(one.indexOf('Arni me Patates (200')).toBeLessThan(one.indexOf('Spanakopita (180'))
    expect(one).toContain(plan.bottlenecks.length ? 'the workarounds are right below' : 'can handle everything')
    const two = chefBriefing({ ...sunday(2), bottlenecks: [] }, 2, noGuests).join(' ')
    expect(two).toContain('Your 2 ovens and burners can handle everything as scheduled.')
    expect(`${one} ${two}`).not.toMatch(/No oven or burner clashes/)
  })
  it('summarises guest allergen flags, all-clears and failed checks', () => {
    const audit: DietaryAudit = { notice: '', reviewWarnings: [], conflicts: [
      { type: 'critical_allergen', guestId: 'e', guestName: 'Eleni', recipeId: 's', recipeTitle: 'Spanakopita', ingredient: 'feta', restriction: 'dairy', message: '', crossContaminationWarning: null, substitutions: [] },
      { type: 'critical_allergen', guestId: 'e', guestName: 'Eleni', recipeId: 's', recipeTitle: 'Spanakopita', ingredient: 'filo', restriction: 'gluten', message: '', crossContaminationWarning: null, substitutions: [] },
      { type: 'dislike_warning', guestId: 'n', guestName: 'Nikos', recipeId: 'l', recipeTitle: 'Arni me Patates', ingredient: 'lamb', restriction: 'lamb', message: '', crossContaminationWarning: null, substitutions: [] }
    ] }
    expect(chefBriefing(sunday(), 1, { names: ['Eleni', 'Nikos'], audit }).join(' ')).toContain('Check with Eleni: feta and filo in Spanakopita (allergen).')
    expect(chefBriefing(sunday(), 1, { names: ['Maria', 'Nikos'], audit: { ...audit, conflicts: [] } }).join(' ')).toContain('No ingredient flags for Maria and Nikos.')
    expect(chefBriefing(sunday(), 1, { names: ['Maria'], audit: 'failed' }).join(' ')).toContain('could not be checked')
    expect(chefBriefing(sunday(), 1, noGuests).join(' ')).not.toMatch(/Check with|flags|allergens/)
  })
  it('warns about day-before prep', () => {
    const plan = conduct({ targetTime: '07:00', courses: [course('main', recipe('m', 'Souvlaki', ['Marinate the pork overnight.', 'Grill for 12 minutes.']))] })
    expect(chefBriefing(plan, 1, noGuests).at(-1)).toContain('the day before')
  })
})
