import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { load } from 'cheerio'
import { db } from '../db/index'
import { recipes } from '../db/schema'
import { getRecipe, listRecipes, saveRecipe } from '../utils/recipes'
import { listPantry, savePantry, pantryMatches, pantryInput } from '../utils/pantry'
import { safeFetch } from '../utils/ai/safe-fetch'
import { extractJsonLd, extractHtml } from '../utils/ai/normalize'
import { enrichScience } from '../../shared/culinary/science'
import { recipeCreateSchema, validate } from '../utils/validation'

const server = new McpServer({
  name: 'heirloom',
  version: '1.0.0'
})

function youtubeId(input: string): string | null {
  if (/^[\w-]{11}$/.test(input)) return input
  try {
    const url = new URL(input)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null
    const id = url.hostname === 'youtu.be'
      ? url.pathname.slice(1)
      : ['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(url.hostname)
        ? url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})$/)?.[1]
        : null
    if (id && /^[\w-]{11}$/.test(id)) return id
  } catch { /* Invalid URL */ }
  return null
}

function parsePlayerData(html: string): Record<string, any> | null {
  const start = html.indexOf('ytInitialPlayerResponse = ')
  if (start < 0) return null
  const content = html.slice(start + 'ytInitialPlayerResponse = '.length)
  let depth = 0, quoted = false, escaped = false
  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
    } else if (char === '"') {
      quoted = true
    } else if (char === '{') {
      depth++
    } else if (char === '}' && --depth === 0) {
      try { return JSON.parse(content.slice(0, i + 1)) } catch { return null }
    }
  }
  return null
}

// 1. Fetch Source: Pull video transcript, description, or web JSON-LD
server.tool(
  'heirloom_fetch_source',
  'Fetches raw recipe data from a URL (YouTube video or web page). For YouTube, returns title, author, description, and full spoken transcript so an agent can analyze the dialogue. For web pages, returns title, schema.org Recipe JSON-LD, and page text.',
  {
    url: z.string().url().describe('The URL of the recipe page or YouTube video')
  },
  async ({ url }) => {
    try {
      const vId = youtubeId(url)
      if (vId) {
        const watchUrl = `https://www.youtube.com/watch?v=${vId}`
        const html = await safeFetch(watchUrl)
        const player = parsePlayerData(html)
        const title = player?.videoDetails?.title || ''
        const author = player?.videoDetails?.author || ''
        const description = player?.videoDetails?.shortDescription || ''
        let transcript = ''

        // Try web player caption track
        const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks
        const track = Array.isArray(tracks) ? tracks[0] : undefined
        if (track?.baseUrl) {
          try {
            const xml = await safeFetch(track.baseUrl)
            const $ = load(xml, { xml: true })
            transcript = $('text, p').map((_i, el) => $(el).text()).get().join(' ').replace(/\s+/g, ' ').trim()
          } catch { /* Fallback to Innertube */ }
        }

        // Innertube Android fallback if needed
        if (!transcript) {
          const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/)
          if (apiKeyMatch?.[1]) {
            try {
              const androidResp = await (await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKeyMatch[1]}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
                  videoId: vId
                })
              })).json()
              const androidTrack = androidResp?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.[0]
              if (androidTrack?.baseUrl) {
                const xml = await safeFetch(androidTrack.baseUrl)
                const $ = load(xml, { xml: true })
                transcript = $('text, p').map((_i, el) => $(el).text()).get().join(' ').replace(/\s+/g, ' ').trim()
              }
            } catch { /* Captions unavailable */ }
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              kind: 'video',
              videoId: vId,
              title,
              author,
              url: watchUrl,
              description,
              transcript: transcript || null,
              hasTranscript: !!transcript
            }, null, 2)
          }]
        }
      }

      // Standard web URL
      const html = await safeFetch(url)
      const jsonLd = extractJsonLd(html)
      const plain = extractHtml(html)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            kind: 'url',
            url,
            title: plain.title,
            jsonLd,
            textSnippet: plain.text.slice(0, 10000)
          }, null, 2)
        }]
      }
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err?.message || String(err) }) }],
        isError: true
      }
    }
  }
)

// 2. Save Recipe: Create or update a recipe in Heirloom
server.tool(
  'heirloom_save_recipe',
  'Saves a new recipe or updates an existing recipe in Heirloom SQLite database. Enforces schema validation, safe cooking temperatures, and culinary science enrichments.',
  {
    recipe: z.object({
      title: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      recipeType: z.enum(['food', 'drink', 'cocktail', 'baking', 'dessert']).optional(),
      originalSaltType: z.enum(['table_salt', 'morton_kosher', 'diamond_crystal_kosher', 'greek_fine_sea_salt']).nullable().optional(),
      sourceUrl: z.string().nullable().optional(),
      sourceType: z.enum(['url', 'video', 'prompt', 'handwritten_ocr', 'manual']).optional(),
      servings: z.number().int().min(1).optional(),
      prepTimeMinutes: z.number().int().min(0).optional(),
      cookTimeMinutes: z.number().int().min(0).optional(),
      totalTimeMinutes: z.number().int().min(0).optional(),
      difficulty: z.enum(['easy', 'intermediate', 'advanced', 'master']).optional(),
      cuisine: z.string().nullable().optional(),
      imageUrl: z.string().nullable().optional(),
      heirloomNotes: z.string().optional(),
      ingredients: z.array(z.object({
        name: z.string().min(1),
        amount: z.number().min(0),
        unit: z.string().min(1),
        gramsEquivalent: z.number().nullable().optional(),
        category: z.string().default('pantry'),
        notes: z.string().nullable().optional()
      })).min(1).optional(),
      steps: z.array(z.object({
        stepNumber: z.number().int().min(1),
        instruction: z.string().min(1),
        durationMinutes: z.number().int().nullable().optional(),
        timerRequired: z.boolean().default(false),
        heatLevel: z.enum(['none', 'low', 'medium-low', 'medium', 'medium-high', 'high']).nullable().optional(),
        scienceWhy: z.string().nullable().optional(),
        failurePrevention: z.string().nullable().optional(),
        sensoryVisual: z.string().nullable().optional(),
        sensoryAudio: z.string().nullable().optional(),
        sensoryAroma: z.string().nullable().optional(),
        sensoryTexture: z.string().nullable().optional(),
        internalTempTargetC: z.number().nullable().optional()
      })).min(1).optional(),
      equipment: z.array(z.union([
        z.string().transform(name => ({ name })),
        z.object({
          name: z.string().min(1),
          isEssential: z.boolean().optional(),
          substituteTool: z.string().nullable().optional()
        })
      ])).optional()
    }),
    id: z.string().uuid().optional().describe('Optional recipe ID if updating an existing recipe')
  },
  async ({ recipe, id }) => {
    try {
      const existing = id ? getRecipe(id) : undefined
      const current = existing ? {
        ...Object.fromEntries(Object.keys(recipeCreateSchema.shape).map(key => [key, existing[key as keyof typeof existing]])),
        ingredients: existing.ingredients.map(({ id: _id, recipeId: _recipeId, ...row }) => row),
        steps: existing.steps.map(({ id: _id, recipeId: _recipeId, ...row }) => row),
        equipment: existing.equipment.map(({ id: _id, recipeId: _recipeId, ...row }) => row)
      } : { description: '', recipeType: 'food', sourceType: 'manual', servings: 4, prepTimeMinutes: 15, cookTimeMinutes: 30, totalTimeMinutes: 45, difficulty: 'intermediate', heirloomNotes: '', equipment: [] }
      // Creation still requires a title, ingredients and steps; updates can omit them.
      if (!existing) validate(z.object({ title: z.string().min(1), ingredients: z.array(z.unknown()).min(1), steps: z.array(z.unknown()).min(1) }), recipe)
      const provided = Object.fromEntries(Object.entries(recipe).filter(([, value]) => value !== undefined))
      const enriched = enrichScience({ ...current, ...provided } as any)
      const validated = validate(recipeCreateSchema, enriched)
      const result = saveRecipe(existing ? {
        ...validated,
        ingredients: recipe.ingredients === undefined ? undefined : validated.ingredients,
        steps: recipe.steps === undefined ? undefined : validated.steps,
        equipment: recipe.equipment === undefined ? undefined : validated.equipment
      } : validated, id)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: id ? 'Recipe updated successfully' : 'Recipe created successfully',
            recipe: result
          }, null, 2)
        }]
      }
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err?.message || String(err) }) }],
        isError: true
      }
    }
  }
)

// 3. List Recipes: Search and filter saved recipes
server.tool(
  'heirloom_list_recipes',
  'Searches and lists recipes saved in Heirloom. Supports text search, cuisine filter, recipe type, and difficulty.',
  {
    search: z.string().optional().describe('Text query to search title and description'),
    cuisine: z.string().optional().describe('Filter by cuisine (e.g. Greek, Italian, Filipino)'),
    type: z.enum(['food', 'drink', 'cocktail', 'baking', 'dessert', 'drinks']).optional(),
    difficulty: z.enum(['easy', 'intermediate', 'advanced', 'master']).optional(),
    isFavorite: z.boolean().optional(),
    limit: z.number().int().min(1).max(100).default(50)
  },
  async ({ search, cuisine, type, difficulty, isFavorite, limit }) => {
    try {
      const all = listRecipes({ search, cuisine, type, difficulty, isFavorite })
      const sliced = all.slice(0, limit).map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        recipeType: r.recipeType,
        cuisine: r.cuisine,
        servings: r.servings,
        totalTimeMinutes: r.totalTimeMinutes,
        difficulty: r.difficulty,
        sourceUrl: r.sourceUrl,
        rating: r.rating,
        isFavorite: r.isFavorite
      }))
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ count: all.length, recipes: sliced }, null, 2)
        }]
      }
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err?.message || String(err) }) }],
        isError: true
      }
    }
  }
)

// 4. Get Recipe: Retrieve full recipe details
server.tool(
  'heirloom_get_recipe',
  'Retrieves complete recipe details by ID, including all ingredients with gram weights, timed steps, temperatures, and culinary science notes.',
  {
    id: z.string().describe('The UUID of the recipe to retrieve')
  },
  async ({ id }) => {
    try {
      const recipe = getRecipe(id)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(recipe, null, 2)
        }]
      }
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err?.message || String(err) }) }],
        isError: true
      }
    }
  }
)

// 5. Delete Recipe
server.tool(
  'heirloom_delete_recipe',
  'Deletes a recipe from Heirloom by ID.',
  {
    id: z.string().describe('The UUID of the recipe to delete')
  },
  async ({ id }) => {
    try {
      const result = db.delete(recipes).where(eq(recipes.id, id)).run()
      if (!result.changes) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Recipe not found' }) }],
          isError: true
        }
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, deletedId: id }) }]
      }
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err?.message || String(err) }) }],
        isError: true
      }
    }
  }
)

// 6. List Pantry
server.tool(
  'heirloom_list_pantry',
  'Lists all items currently stored in your pantry, fridge, and freezer, including quantities, units, and expiration dates.',
  {},
  async () => {
    try {
      const items = listPantry()
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ count: items.length, items }, null, 2)
        }]
      }
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err?.message || String(err) }) }],
        isError: true
      }
    }
  }
)

// 7. Upsert Pantry Items
server.tool(
  'heirloom_upsert_pantry',
  'Adds or updates items in the pantry, fridge, or freezer. Automatically normalizes names and merges compatible units.',
  {
    items: z.array(pantryInput).min(1).describe('Array of pantry items to add or update')
  },
  async ({ items }) => {
    try {
      const updated = savePantry(items)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ count: updated.length, items: updated }, null, 2)
        }]
      }
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err?.message || String(err) }) }],
        isError: true
      }
    }
  }
)

// 8. Match Pantry with Recipes
server.tool(
  'heirloom_match_pantry',
  'Matches available pantry ingredients against all saved recipes to see what can be cooked immediately and what ingredients are missing.',
  {},
  async () => {
    try {
      const matches = pantryMatches()
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ count: matches.length, matches }, null, 2)
        }]
      }
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err?.message || String(err) }) }],
        isError: true
      }
    }
  }
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  process.stderr.write('Heirloom MCP server running on stdio\n')
}

main().catch(err => {
  process.stderr.write(`Heirloom MCP server failed to start: ${err}\n`)
  process.exit(1)
})
