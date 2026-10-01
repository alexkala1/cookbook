import { asc, eq } from 'drizzle-orm'
import { createError } from 'h3'
import { z } from 'zod'
import { db } from '../db'
import { cookLogs, ingredients, pantryItems, recipeEquipment, recipes, steps } from '../db/schema'
import { storageLocations } from '../../shared/culinary/pantry'
import { cookLogInputSchema } from './cook-logs'
import { recipeCreateSchema, validate } from './validation'

const id = z.string().min(1).max(200)
const childIdentity = { id, recipeId: id }
const recipeSchema = recipeCreateSchema.required().extend({
  id,
  // Repeated forks append their variation names to the original title.
  title: z.string().trim().min(1),
  parentRecipeId: id.nullable().optional(),
  variationName: z.string().max(200).nullable().optional(),
  // saveRecipe can derive this sum from two individually valid 100000-minute fields.
  totalTimeMinutes: z.number().int().nonnegative().max(200000),
  createdAt: z.iso.datetime({ offset: true }).nullable(),
  updatedAt: z.iso.datetime({ offset: true }).nullable(),
  ingredients: z.array(recipeCreateSchema.shape.ingredients.unwrap().element.required().extend(childIdentity)).max(500),
  steps: z.array(recipeCreateSchema.shape.steps.unwrap().element.required().extend(childIdentity)).max(500),
  equipment: z.array(recipeCreateSchema.shape.equipment.unwrap().element.required().extend(childIdentity)).max(100)
})
const pantrySchema = z.object({
  id, name: z.string().min(1).max(200), normalizedName: z.string().min(1).max(200),
  quantity: z.number().finite().nonnegative().max(1_000_000),
  unit: z.string().min(1).max(40),
  storageLocation: z.enum(storageLocations),
  expiresAt: z.number().int().nonnegative().nullable(),
  createdAt: z.number().int().nonnegative(), updatedAt: z.number().int().nonnegative()
}).strict()

export const backupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.iso.datetime({ offset: true }),
  recipes: z.array(recipeSchema),
  pantry: z.array(pantrySchema),
  cookLogs: z.array(cookLogInputSchema.required().extend({
    id, recipeId: id, cookedAt: z.iso.datetime({ offset: true }).nullable(),
    notes: z.string().max(10000).nullable(), rating: z.number().finite().min(1).max(5).nullable()
  })).optional()
}).strict().superRefine((backup, context) => {
  const seen = new Map<string, Set<string>>()
  const unique = (table: string, value: string) => {
    const ids = seen.get(table) ?? new Set<string>()
    if (ids.has(value)) context.addIssue({ code: 'custom', message: `Duplicate ${table} ID`, path: [table] })
    ids.add(value)
    seen.set(table, ids)
  }
  for (const recipe of backup.recipes) {
    unique('recipes', recipe.id)
    for (const table of ['ingredients', 'steps', 'equipment'] as const) {
      for (const row of recipe[table]) {
        unique(table, row.id)
        if (row.recipeId !== recipe.id) context.addIssue({ code: 'custom', message: 'Child recipeId must match its parent', path: ['recipes', recipe.id, table] })
      }
    }
    if (new Set(recipe.steps.map(row => row.stepNumber)).size !== recipe.steps.length) {
      context.addIssue({ code: 'custom', message: 'Step numbers must be unique', path: ['recipes', recipe.id, 'steps'] })
    }
  }
  for (const row of backup.pantry) unique('pantry', row.id)
  const recipeIds = new Set(backup.recipes.map(recipe => recipe.id))
  for (const row of backup.cookLogs ?? []) {
    unique('cookLogs', row.id)
    if (!recipeIds.has(row.recipeId)) context.addIssue({ code: 'custom', message: 'Cook log must reference a recipe in the backup', path: ['cookLogs', row.id, 'recipeId'] })
  }
})

export type CookbookBackup = z.infer<typeof backupSchema>

function groupByRecipe<T extends { recipeId: string }>(rows: T[]) {
  const grouped = new Map<string, T[]>()
  for (const row of rows) {
    const group = grouped.get(row.recipeId)
    if (group) group.push(row)
    else grouped.set(row.recipeId, [row])
  }
  return grouped
}

/** Read all tables in one snapshot, without one query per recipe. */
export function exportBackup(): CookbookBackup {
  return db.transaction(tx => {
    const ingredientRows = groupByRecipe(tx.select().from(ingredients).orderBy(asc(ingredients.sortOrder), asc(ingredients.id)).all())
    const stepRows = groupByRecipe(tx.select().from(steps).orderBy(asc(steps.stepNumber), asc(steps.id)).all())
    const equipmentRows = groupByRecipe(tx.select().from(recipeEquipment).orderBy(asc(recipeEquipment.id)).all())
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      recipes: tx.select().from(recipes).orderBy(asc(recipes.id)).all().map(recipe => ({
        ...recipe,
        ingredients: ingredientRows.get(recipe.id) ?? [],
        steps: stepRows.get(recipe.id) ?? [],
        equipment: equipmentRows.get(recipe.id) ?? []
      })),
      pantry: tx.select().from(pantryItems).orderBy(asc(pantryItems.id)).all(),
      cookLogs: tx.select().from(cookLogs).orderBy(asc(cookLogs.id)).all()
    }
  })
}

/** Merge by stable ID, preserving unrelated entries and recipe-linked memories/sessions. */
export function importBackup(input: unknown) {
  validate(backupSchema, input)
  // Validation reuses editor constraints, but a restore must preserve original whitespace.
  const backup = input as CookbookBackup
  return db.transaction(tx => {
    const logOwners = new Map(tx.select({ id: cookLogs.id, recipeId: cookLogs.recipeId }).from(cookLogs).all().map(row => [row.id, row.recipeId]))
    for (const row of backup.cookLogs ?? []) {
      const owner = logOwners.get(row.id)
      if (owner !== undefined && owner !== row.recipeId) throw createError({ statusCode: 409, statusMessage: 'Cook log ID belongs to a different recipe' })
    }
    for (const [key, table] of [['ingredients', ingredients], ['steps', steps], ['equipment', recipeEquipment]] as const) {
      const owners = new Map(tx.select({ id: table.id, recipeId: table.recipeId }).from(table).all().map(row => [row.id, row.recipeId]))
      for (const recipe of backup.recipes) {
        for (const row of recipe[key]) {
          const owner = owners.get(row.id)
          if (owner !== undefined && owner !== recipe.id) {
            throw createError({ statusCode: 409, statusMessage: 'Backup child ID belongs to a different recipe' })
          }
        }
      }
    }
    for (const recipe of backup.recipes) {
      const { ingredients: ingredientRows, steps: stepRows, equipment: equipmentRows, ...parent } = recipe
      // Upsert, not SQLite REPLACE: deleting the parent would cascade into other data.
      const fields = { ...parent, parentRecipeId: parent.parentRecipeId ?? null, variationName: parent.variationName ?? null }
      tx.insert(recipes).values(fields).onConflictDoUpdate({ target: recipes.id, set: fields }).run()
      tx.delete(ingredients).where(eq(ingredients.recipeId, parent.id)).run()
      tx.delete(steps).where(eq(steps.recipeId, parent.id)).run()
      tx.delete(recipeEquipment).where(eq(recipeEquipment.recipeId, parent.id)).run()
      // Individual statements avoid SQLite variable limits for large recipes.
      for (const row of ingredientRows) tx.insert(ingredients).values(row).run()
      for (const row of stepRows) tx.insert(steps).values(row).run()
      for (const row of equipmentRows) tx.insert(recipeEquipment).values(row).run()
    }
    for (const row of backup.pantry) {
      tx.insert(pantryItems).values(row).onConflictDoUpdate({ target: pantryItems.id, set: row }).run()
    }
    for (const row of backup.cookLogs ?? []) {
      tx.insert(cookLogs).values(row).onConflictDoUpdate({ target: cookLogs.id, set: row }).run()
    }
    return { imported: { recipes: backup.recipes.length, pantry: backup.pantry.length } }
  })
}
