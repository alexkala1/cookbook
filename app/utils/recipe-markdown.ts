import type { RecipeDetail } from '#shared/types/recipe'

export function slugifyTitle(title: string): string {
  return title.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'recipe'
}

export function formatRecipeMarkdown(recipe: RecipeDetail): string {
  const quote = (value: string | null | undefined) => JSON.stringify(value ?? '')
  const lines = [
    '---', `title: ${quote(recipe.title)}`, `type: ${quote(recipe.recipeType)}`,
    `cuisine: ${quote(recipe.cuisine)}`, `servings: ${recipe.servings}`,
    `prepTimeMinutes: ${recipe.prepTimeMinutes}`, `cookTimeMinutes: ${recipe.cookTimeMinutes}`,
    `totalTimeMinutes: ${recipe.totalTimeMinutes}`, `difficulty: ${quote(recipe.difficulty)}`, '---'
  ]
  if (recipe.description?.trim()) lines.push('', recipe.description.trim())
  lines.push('', '## Ingredients')
  for (const item of recipe.ingredients) {
    const amount = item.amount === 0 && item.unit.trim().toLowerCase() === 'as needed' ? '' : String(item.amount)
    const text = [amount, item.unit.trim(), item.name.trim()].filter(Boolean).join(' ')
    lines.push(`- ${text}${item.notes?.trim() ? ` (${item.notes.trim()})` : ''}`)
  }
  lines.push('', '## Method')
  for (const [index, step] of recipe.steps.entries()) {
    lines.push(`${index + 1}. ${step.instruction.trim()}${step.durationMinutes ? ` (${step.durationMinutes} min)` : ''}`)
  }
  if (recipe.equipment?.length) {
    lines.push('', '## Equipment')
    for (const item of recipe.equipment) lines.push(`- ${item.name.trim()}${item.substituteTool?.trim() ? ` (Substitute: ${item.substituteTool.trim()})` : ''}`)
  }
  if (recipe.heirloomNotes?.trim()) lines.push('', '## Heirloom Notes', recipe.heirloomNotes.trim())
  if (recipe.storageReheating?.trim()) lines.push('', '## Storage & Reheating', recipe.storageReheating.trim())
  return lines.join('\n').replace(/\r\n?/g, '\n') + '\n'
}

export function downloadRecipeMarkdown(recipe: RecipeDetail): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const blob = new Blob([formatRecipeMarkdown(recipe)], { type: 'text/markdown;charset=utf-8' })
  const anchor = document.createElement('a')
  const url = URL.createObjectURL(blob)
  try {
    anchor.href = url
    anchor.download = `${slugifyTitle(recipe.title)}.md`
    document.body.appendChild(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    URL.revokeObjectURL(url)
  }
}
