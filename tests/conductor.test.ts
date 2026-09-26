import { describe, expect, it, vi } from 'vitest'
import { createApp, createRouter, toWebHandler } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { fileURLToPath } from 'node:url'
import { classifyStep, conduct, parseClock, relativeLabel, stepMinutes, type ConductorCourse } from '../shared/culinary/conductor'
import { db } from '../server/db'
import orchestrate from '../server/api/meal-plan/orchestrate.post'
import csrf from '../server/middleware/csrf'
import { saveRecipe } from '../server/utils/recipes'

vi.mock('../server/db', async () => {
  vi.stubEnv('DATABASE_URL', ':memory:')
  return await vi.importActual('../server/db')
})

const recipe = (id: string, title: string, steps: (string | { instruction: string, durationMinutes?: number, heatLevel?: string })[]) =>
  ({ id, title, steps: steps.map((step, index) => ({ stepNumber: index + 1, ...(typeof step === 'string' ? { instruction: step } : step) })) })
const course = (value: ConductorCourse, r: ReturnType<typeof recipe>, serveAt?: string) => ({ course: value, recipe: r, serveAt })
const dinner = () => [
  course('appetizer', recipe('a', 'Scallops', ['Make pea puree and chill 2 hours.', 'Sear scallops 2 minutes in a hot pan.', 'Plate and serve.'])),
  course('main', recipe('m', 'Rack of lamb', ['Marinate the lamb overnight.', 'Preheat the oven to 200°C.', 'Roast the potatoes at 200°C for 45 minutes.', 'Sear the lamb, then roast 20 minutes at 200°C.', 'Rest the lamb 15 minutes.', 'Carve and serve.'])),
  course('dessert', recipe('d', 'Lava cakes', ['Mix the batter and refrigerate.', 'Bake at 180°C for 12 minutes.', 'Unmold, dust with sugar and serve.']))
]

describe('step analysis', () => {
  it.each([
    ['Marinate the lamb overnight.', 'prep', false, 0], ['Chop the onions finely.', 'prep', false, 0], ['Let the dough rise for 1 hour.', 'prep', false, 0],
    ['Roast at 200°C for 45 minutes.', 'cook', true, 0], ['Sear the lamb in a skillet, then roast in the oven.', 'cook', true, 1], ['Simmer the sauce 20 minutes.', 'cook', false, 1],
    ['Fry the potatoes in two pans.', 'cook', false, 2], ['Ψήστε στους 180 βαθμούς για 40 λεπτά.', 'cook', true, 0], ['Τηγανίστε τα κολοκυθάκια.', 'cook', false, 1],
    ['Ψήστε τα μπιφτέκια στη σχάρα.', 'cook', false, 0], ['Rest the meat 10 minutes.', 'rest', false, 0], ['Carve and serve.', 'plate', false, 0], ['Σερβίρετε ζεστό.', 'plate', false, 0],
    ['Remove from heat, garnish and serve.', 'plate', false, 0], ['Add the rest of the flour.', 'cook', false, 0], ['Garnish, add a drizzle of oil and serve.', 'plate', false, 0], ['Chop the onions and add them to a bowl.', 'cook', false, 0], ['Dust the chicken with flour.', 'prep', false, 0]
  ] as const)('%s → %s, oven %s, burners %i', (instruction, phase, oven, burners) => {
    expect(classifyStep({ stepNumber: 1, instruction })).toMatchObject({ phase, oven, burners })
  })
  it('reads oven temperatures in Celsius, converting Fahrenheit, and treats a heat level as a burner', () => {
    expect(classifyStep({ stepNumber: 1, instruction: 'Bake at 350 F for 30 minutes' }).ovenTempC).toBe(177)
    expect(classifyStep({ stepNumber: 1, instruction: 'Stir constantly', heatLevel: 'medium' }).burners).toBe(1)
    expect(classifyStep({ stepNumber: 1, instruction: 'Stir constantly', heatLevel: 'none' }).burners).toBe(0)
  })
  it('uses explicit durations, then parsed text, then phase defaults', () => {
    expect(stepMinutes({ stepNumber: 1, instruction: 'Bake 10 minutes', durationMinutes: 25 }, 'cook')).toBe(25)
    expect(stepMinutes({ stepNumber: 1, instruction: 'Roast 20 minutes, then rest 10 minutes' }, 'cook')).toBe(30)
    expect(stepMinutes({ stepNumber: 1, instruction: 'Marinate overnight' }, 'prep')).toBe(480)
    expect(stepMinutes({ stepNumber: 1, instruction: 'Plate' }, 'plate')).toBe(5)
  })
  it('validates clocks and labels relative times', () => {
    expect(parseClock('20:30')).toBe(1230)
    expect(() => parseClock('24:00')).toThrow(RangeError)
    expect(() => parseClock('8:30')).toThrow(RangeError)
    expect([relativeLabel(-120), relativeLabel(0), relativeLabel(30)]).toEqual(['T-120m', 'T-0m', 'T+30m'])
  })
})

describe('backwards timeline', () => {
  it('serves courses at T, T+25, and T+60 and ends each course on its serving time', () => {
    const plan = conduct({ targetTime: '20:00', courses: dinner() })
    expect(plan.serves.map(row => [row.course, row.clock, row.label])).toEqual([['appetizer', '20:00', 'T-0m'], ['main', '20:25', 'T+25m'], ['dessert', '21:00', 'T+60m']])
    for (const serve of plan.serves) expect(Math.max(...plan.timeline.filter(event => event.recipeId === serve.recipeId).map(event => event.end))).toBe(serve.offset)
    const lamb = plan.timeline.filter(event => event.recipeId === 'm')
    expect(lamb.map(event => [event.label, event.clock, event.phase])).toEqual([
      ['T-555m', '10:45', 'prep'], ['T-75m', '18:45', 'cook'], ['T-60m', '19:00', 'cook'], ['T-15m', '19:45', 'cook'], ['T+5m', '20:05', 'rest'], ['T+20m', '20:20', 'plate']
    ])
    expect(plan.timeline.map(event => event.start)).toEqual([...plan.timeline.map(event => event.start)].sort((a, b) => a - b))
  })
  it('moves advance prep before service starts instead of during the first course', () => {
    const plan = conduct({ targetTime: '20:00', courses: dinner() })
    const batter = plan.timeline.find(event => event.instruction.startsWith('Mix the batter'))!
    expect(batter.end).toBeLessThanOrEqual(-30)
    expect(plan.timeline.find(event => event.instruction.startsWith('Make pea puree'))!.end).toBeLessThanOrEqual(-30)
    // Cooking steps stay anchored to serving time.
    expect(plan.timeline.find(event => event.instruction.startsWith('Bake at 180'))).toMatchObject({ start: 43, end: 55 })
  })
  it('inserts a preheat step only when the recipe lacks one', () => {
    const plan = conduct({ targetTime: '20:00', courses: dinner() })
    const dessertPreheat = plan.timeline.find(event => event.recipeId === 'd' && event.synthetic)!
    expect(dessertPreheat).toMatchObject({ instruction: 'Preheat the oven to 180 °C', ovenTempC: 180, duration: 15, end: 43, stepNumber: null })
    expect(plan.timeline.filter(event => event.recipeId === 'm' && event.synthetic)).toHaveLength(0)
  })
  it('honours explicit serve times, including across midnight', () => {
    const plan = conduct({ targetTime: '23:30', courses: [course('main', recipe('x', 'Late roast', ['Roast 60 minutes at 200°C', 'Serve'])), course('dessert', recipe('y', 'Loukoumades', ['Fry the dough 10 minutes', 'Serve']), '00:15')] })
    expect(plan.serves.map(row => [row.course, row.offset, row.clock, row.dayOffset])).toEqual([['main', 0, '23:30', 0], ['dessert', 45, '00:15', 1]])
    expect(plan.timeline.find(event => event.instruction.startsWith('Roast'))).toMatchObject({ clock: '22:25', dayOffset: 0 })
  })
  it('starts the earliest present course at the target and warns about recipes without steps', () => {
    const plan = conduct({ targetTime: '14:00', courses: [course('main', recipe('m', 'Gemista', ['Bake 60 minutes at 180°C'])), course('dessert', recipe('d', 'Fruit', []))] })
    expect(plan.serves.map(row => [row.course, row.clock])).toEqual([['main', '14:00'], ['dessert', '14:35']])
    expect(plan.warnings).toEqual(['Fruit has no method steps; add them to include it in the timeline.'])
  })
})

describe('equipment bottlenecks', () => {
  const ovenClash = (dessertTemp: number, extra: Partial<Parameters<typeof conduct>[0]> = {}) => conduct({
    targetTime: '20:00', ...extra, courses: [
      course('main', recipe('m', 'Kleftiko', ['Preheat oven to 200°C', 'Roast at 200°C for 90 minutes', 'Serve'])),
      course('dessert', recipe('d', 'Portokalopita', [`Preheat oven to ${dessertTemp}°C`, `Bake at ${dessertTemp}°C for 45 minutes`, 'Serve']), '20:05')
    ]
  })
  it('flags oven temperature conflicts over 15 °C with sequencing and fan resolutions', () => {
    const [conflict, ...rest] = ovenClash(180).bottlenecks
    expect(rest).toEqual([])
    expect(conflict).toMatchObject({ type: 'oven_temperature', label: 'T-60m', clock: '19:00', end: -5 })
    expect(conflict!.steps.map(step => step.instruction)).toEqual(['Preheat oven to 180°C', 'Bake at 180°C for 45 minutes', 'Roast at 200°C for 90 minutes'])
    expect(conflict!.message).toBe('Oven conflict: Portokalopita at 180 °C vs Kleftiko at 200 °C (20 °C apart) with 1 oven.')
    expect(conflict!.resolutions[0]).toContain('Bake Portokalopita earlier')
    expect(conflict!.resolutions[0]).toContain('rewarm at 150 °C')
    expect(conflict!.resolutions[1]).toContain('run Kleftiko at 180 °C (its fan equivalent)')
    expect(conflict!.resolutions.at(-1)).toContain('internal temperature')
  })
  it('allows oven sharing within 15 °C, drops the fan tip for large gaps, and respects a second oven', () => {
    expect(ovenClash(190).bottlenecks).toEqual([])
    expect(ovenClash(185).bottlenecks).toEqual([])
    expect(ovenClash(150).bottlenecks[0]!.resolutions.some(tip => tip.includes('fan equivalent'))).toBe(false)
    expect(ovenClash(180, { ovens: 2 }).bottlenecks).toEqual([])
  })
  it('flags burner overload beyond four and suggests staggering a holdable step', () => {
    const pans = (id: string, title: string, instruction: string) => course('main', recipe(id, title, [instruction, 'Serve']))
    const five = [pans('a', 'Fasolakia', 'Simmer the beans 30 minutes'), pans('b', 'Rice', 'Boil the rice 30 minutes'), pans('c', 'Keftedes', 'Fry the keftedes 30 minutes'),
      pans('d', 'Horta', 'Blanch the greens 30 minutes'), pans('e', 'Patates', 'Fry the potatoes 30 minutes')]
    const [overload] = conduct({ targetTime: '20:00', courses: five }).bottlenecks
    expect(overload).toMatchObject({ type: 'burner_overload', start: -35, end: -5, message: 'Burner overload: 5 burners needed at once, 4 available.' })
    expect(overload!.resolutions[0]).toContain('"Simmer the beans 30 minutes" (Fasolakia) earlier')
    expect(conduct({ targetTime: '20:00', courses: five.slice(0, 4) }).bottlenecks).toEqual([])
    expect(conduct({ targetTime: '20:00', courses: five, burners: 6 }).bottlenecks).toEqual([])
  })
})

describe('POST /api/meal-plan/orchestrate', () => {
  migrate(db, { migrationsFolder: fileURLToPath(new URL('../server/db/migrations', import.meta.url)) })
  const handle = toWebHandler(createApp().use(csrf).use(createRouter().post('/api/meal-plan/orchestrate', orchestrate)))
  const post = (body: unknown, origin = 'http://localhost') => handle(new Request('http://localhost/api/meal-plan/orchestrate', { method: 'POST', headers: { Host: 'localhost', Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
  const salad = saveRecipe({ title: 'Horiatiki', description: '', servings: 4, ingredients: [{ name: 'ντομάτες', amount: 4, unit: 'piece' }, { name: 'feta', amount: 200, unit: 'g' }], steps: [{ stepNumber: 1, instruction: 'Chop the vegetables.' }, { stepNumber: 2, instruction: 'Dress and serve.' }] })
  const roast = saveRecipe({ title: 'Kleftiko', description: '', servings: 6, ingredients: [{ name: 'lamb shoulder', amount: 1.5, unit: 'kg' }], steps: [{ stepNumber: 1, instruction: 'Roast at 200°C for 90 minutes.' }, { stepNumber: 2, instruction: 'Serve.' }] })
  const cake = saveRecipe({ title: 'Portokalopita', description: '', servings: 8, recipeType: 'dessert', ingredients: [{ name: 'πορτοκάλια', amount: 3, unit: 'piece' }], steps: [{ stepNumber: 1, instruction: 'Bake at 180°C for 45 minutes.' }, { stepNumber: 2, instruction: 'Serve.' }] })

  it('conducts explicit courses with bottlenecks, seasonality badges, and guest warnings', async () => {
    const response = await post({ courses: [{ recipeId: salad.id, course: 'appetizer' }, { recipeId: roast.id, course: 'main' }, { recipeId: cake.id, course: 'dessert', serveAt: '20:35' }], targetServeTime: '20:00', guestCount: 6, month: 1 })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.serves.map((row: { course: string, clock: string }) => [row.course, row.clock])).toEqual([['appetizer', '20:00'], ['main', '20:25'], ['dessert', '20:35']])
    expect(body.bottlenecks.map((row: { type: string }) => row.type)).toEqual(['oven_temperature'])
    expect(body.seasonality[0]).toMatchObject({ course: 'appetizer', recipeTitle: 'Horiatiki', items: [{ ingredient: 'ντομάτες', status: 'greenhouse' }] })
    expect(body.seasonality[0].items[0].advice.join(' ')).toContain('tomato paste')
    expect(body.warnings).toEqual(['Horiatiki serves 4; scale it for 6 guests. Larger batches may need searing in batches and longer oven times.'])
    expect(body).toMatchObject({ month: 1, guestCount: 6, burners: 4, ovens: 1 })
  })
  it('accepts the documented recipeIds shape and infers dessert from the recipe type', async () => {
    const body = await (await post({ recipeIds: [roast.id, cake.id], targetServeTime: '21:00', guestCount: 4, month: 8 })).json()
    expect(body.serves.map((row: { course: string, clock: string }) => [row.course, row.clock])).toEqual([['main', '21:00'], ['dessert', '21:35']])
    expect(body.seasonality[1].items[0]).toMatchObject({ ingredient: 'πορτοκάλια', status: 'off_season' })
    expect(body.warnings).toEqual([])
  })
  it('rejects invalid, missing, and cross-origin requests', async () => {
    for (const body of [{ recipeIds: [roast.id] }, { recipeIds: [roast.id], targetServeTime: '25:00' }, { recipeIds: [], targetServeTime: '20:00' },
      { recipeIds: [roast.id], courses: [{ recipeId: roast.id }], targetServeTime: '20:00' }, { recipeIds: [roast.id], targetServeTime: '20:00', burners: 0 },
      { recipeIds: [roast.id], targetServeTime: '20:00', ovens: 3 }, { recipeIds: [roast.id], targetServeTime: '20:00', month: 13 }, { courses: [{ recipeId: roast.id, serveAt: '9pm' }], targetServeTime: '20:00' }]) {
      expect((await post(body)).status, JSON.stringify(body)).toBe(400)
    }
    expect((await post({ recipeIds: ['missing'], targetServeTime: '20:00' })).status).toBe(404)
    expect((await post({ recipeIds: [roast.id], targetServeTime: '20:00' }, 'https://evil.example')).status).toBe(403)
  })
})
