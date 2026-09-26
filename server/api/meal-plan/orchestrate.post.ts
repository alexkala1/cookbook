import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { getRecipe } from '../../utils/recipes'
import { validate } from '../../utils/validation'
import { conduct, conductorCourses, type ConductorCourse } from '../../../shared/culinary/conductor'
import { assessIngredients } from '../../../shared/culinary/seasonality'

const recipeId = z.string().trim().min(1).max(100)
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour HH:MM time')
// Exactly one menu shape: explicit courses, or the documented recipeIds list (course inferred from recipe type).
const requestSchema = z.object({
  courses: z.array(z.object({ recipeId, course: z.enum(conductorCourses).default('main'), serveAt: clock.optional() }).strict()).min(1).max(8).optional(),
  recipeIds: z.array(recipeId).min(1).max(8).optional(),
  targetServeTime: clock,
  guestCount: z.number().int().min(1).max(100).optional(),
  burners: z.number().int().min(1).max(10).default(4),
  ovens: z.number().int().min(1).max(2).default(1),
  month: z.number().int().min(1).max(12).optional()
}).strict().refine(value => !!value.courses !== !!value.recipeIds, 'Provide exactly one of courses or recipeIds')

const courseFor = (type: string): ConductorCourse => type === 'dessert' ? 'dessert' : type === 'drink' || type === 'cocktail' ? 'beverage' : 'main'

export default defineEventHandler(async event => {
  const input = validate(requestSchema, await readBody(event))
  const rows = input.courses ?? input.recipeIds!.map(id => ({ recipeId: id, course: undefined, serveAt: undefined }))
  const courses = rows.map(row => {
    const recipe = getRecipe(row.recipeId)
    return { course: row.course ?? courseFor(recipe.recipeType), serveAt: row.serveAt, recipe }
  })
  const plan = conduct({ courses, targetTime: input.targetServeTime, burners: input.burners, ovens: input.ovens })
  const month = input.month ?? new Date().getMonth() + 1
  const guestWarnings = input.guestCount ? courses.filter(row => row.recipe.servings < input.guestCount!).map(row =>
    `${row.recipe.title} serves ${row.recipe.servings}; scale it for ${input.guestCount} guests. Larger batches may need searing in batches and longer oven times.`) : []
  return {
    ...plan, month, guestCount: input.guestCount ?? null, burners: input.burners, ovens: input.ovens,
    warnings: [...plan.warnings, ...guestWarnings],
    seasonality: courses.map(row => ({ course: row.course, recipeId: row.recipe.id, recipeTitle: row.recipe.title, items: assessIngredients(row.recipe.ingredients, month) }))
  }
})
