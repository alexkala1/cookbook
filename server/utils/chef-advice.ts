import { z } from 'zod'
import type { H3Event } from 'h3'
import { aiClient } from './ai/client'
import { culinarySubstitutions } from './ai/substitute'
import { listPantry, pantryMatches } from './pantry'
import { chefAdvice, type ChefAdvice, type SwapOption } from '../../shared/culinary/chef-advice'

const option = z.object({ name: z.string().trim().min(1).max(200), ratio: z.string().trim().min(1).max(500), adjustment: z.string().trim().min(1).max(1000) }).strict()
const refinement = z.object({
  swaps: z.array(z.object({ recipeId: z.string().max(100), options: z.array(option).min(1).max(3) }).strict()).max(10),
  useItUp: z.array(z.object({ itemId: z.string().max(100), tip: z.string().trim().min(1).max(400) }).strict()).max(10)
}).strict()

function offlineSwaps(ingredient: string): SwapOption[] {
  try { return culinarySubstitutions(ingredient).options.map(({ name, ratio, adjustment }) => ({ name, ratio, adjustment })) } catch { return [] }
}

/** Offline advice always exists; a live model may only reword tips and swaps for items and recipes we already found. */
export async function pantryChefAdvice(event: H3Event): Promise<ChefAdvice & { mode: 'live' | 'fallback' }> {
  const stock = listPantry()
  const base = chefAdvice(pantryMatches(), stock, offlineSwaps)
  const client = aiClient(event)
  if (client.mode !== 'live' || (!base.swaps.length && !base.useItUp.length)) return { ...base, mode: 'fallback' }
  try {
    const refined = await client.generate(refinement, 'You are a warm, practical home-cooking mentor. For each entry in swaps, give 1–3 realistic ingredient substitutions with a ratio and a texture/moisture adjustment. For each entry in useItUp, write one friendly tip (max 2 sentences) that helps the cook use the item before it spoils. Use only the recipeId and itemId values provided, never allergen-safety claims.',
      JSON.stringify({ swaps: base.swaps.map(({ recipeId, title, missing }) => ({ recipeId, title, missing })), useItUp: base.useItUp.map(({ itemId, item, daysLeft, tip }) => ({ itemId, item, daysLeft, offlineTip: tip })) }),
      () => ({ swaps: base.swaps.map(({ recipeId, options }) => ({ recipeId, options })), useItUp: base.useItUp.map(({ itemId, tip }) => ({ itemId, tip })) }))
    return {
      ready: base.ready,
      swaps: base.swaps.map(swap => ({ ...swap, options: refined.swaps.find(item => item.recipeId === swap.recipeId)?.options ?? swap.options })),
      useItUp: base.useItUp.map(entry => ({ ...entry, tip: refined.useItUp.find(item => item.itemId === entry.itemId)?.tip ?? entry.tip })),
      mode: 'live'
    }
  } catch { return { ...base, mode: 'fallback' } }
}
