import { randomUUID } from 'node:crypto'
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { z } from 'zod'
import { db } from '../../db'
import { groceryItems, groceryLists } from '../../db/schema'
import { getRecipe } from '../../utils/recipes'
import { validate } from '../../utils/validation'
import { buildGroceryList, menuCourses, type MenuCourse } from '../../../shared/culinary/grocery'

const recipeId = z.string().trim().min(1).max(100)
const servings = z.number().int().min(1).max(1000)
// Exactly one menu shape. Pantry deduction and non-Greek regions are not supported, so they are rejected rather than ignored.
const requestSchema = z.object({
  courses: z.array(z.object({ recipeId, course: z.enum(menuCourses).default('main'), servings: servings.optional() }).strict()).min(1).max(12).optional(),
  recipeIds: z.array(recipeId).min(1).max(12).optional(),
  menu: z.object({ appetizerId: recipeId.optional(), mainCourseId: recipeId.optional(), dessertId: recipeId.optional(), beverageId: recipeId.optional() }).strict().optional(),
  servings: servings.optional(),
  title: z.string().trim().min(1).max(200).optional()
}).strict()
  .refine(value => [value.courses, value.recipeIds, value.menu].filter(Boolean).length === 1, 'Provide exactly one of courses, recipeIds, or menu')
  .refine(value => !value.menu || Object.values(value.menu).some(Boolean), 'Choose at least one menu course')

export default defineEventHandler(async event => {
  const input = validate(requestSchema, await readBody(event))
  const menuIds: [string | undefined, MenuCourse][] = input.menu ? [[input.menu.appetizerId, 'appetizer'], [input.menu.mainCourseId, 'main'], [input.menu.dessertId, 'dessert'], [input.menu.beverageId, 'beverage']] : []
  const courses = input.courses ?? input.recipeIds?.map(id => ({ recipeId: id, course: 'main' as const, servings: undefined }))
    ?? menuIds.filter((row): row is [string, MenuCourse] => !!row[0]).map(([id, course]) => ({ recipeId: id, course, servings: undefined }))
  const menu = courses.map(row => ({ course: row.course, servings: row.servings ?? input.servings, recipe: getRecipe(row.recipeId) }))
  const plan = buildGroceryList(menu)
  const listId = randomUUID(), title = input.title ?? menu.map(row => row.recipe.title).join(' · ').slice(0, 200)
  const destinations = plan.sections.map(({ category: _category, items, ...section }) => ({
    ...section, items: items.map(item => ({ ...item, id: randomUUID() }))
  }))
  db.transaction(tx => {
    tx.insert(groceryLists).values({ id: listId, title }).run()
    const rows = destinations.flatMap(section => section.items.map(item => {
      const recipes = new Set(item.usedIn.map(use => use.recipeId))
      const byCourse: Record<string, number> = {}
      for (const use of item.usedIn) byCourse[use.course] = Math.round(((byCourse[use.course] ?? 0) + use.amount) * 100) / 100
      return {
        id: item.id, listId, name: item.name, amount: item.amount, unit: item.unit, category: section.section, storeDestination: section.storeType,
        counterPhrase: item.counterPhrase ?? null, packageSizeToBuy: item.packageSizeToBuy ?? null, surplusLeftoverTip: item.surplusLeftoverTip ?? null,
        courseBreakdown: JSON.stringify(byCourse), recipeOriginId: recipes.size === 1 ? [...recipes][0]! : null
      }
    }))
    if (rows.length) tx.insert(groceryItems).values(rows).run()
  })
  setResponseStatus(event, 201)
  return { listId, title, destinations, prepAlerts: plan.prepAlerts }
})
