# Heirloom: Database Schema & API Contracts

## 1. Drizzle ORM Schema (TypeScript Definition)

The database uses SQLite via Drizzle ORM for zero-overhead local-first performance, with instant migration capabilities.

```typescript
import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// -------------------------------------------------------------
// RECIPES TABLE
// -------------------------------------------------------------
export const recipes = sqliteTable('recipes', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  recipeType: text('recipe_type', { enum: ['food', 'drink', 'cocktail', 'baking', 'dessert'] }).notNull().default('food'),
  originalSaltType: text('original_salt_type', { enum: ['table_salt', 'morton_kosher', 'diamond_crystal_kosher', 'greek_fine_sea_salt'] }),
  sourceUrl: text('source_url'),
  sourceType: text('source_type', { enum: ['url', 'video', 'prompt', 'handwritten_ocr', 'manual'] }).notNull().default('manual'),
  servings: integer('servings').notNull().default(4),
  prepTimeMinutes: integer('prep_time_minutes').notNull().default(15),
  cookTimeMinutes: integer('cook_time_minutes').notNull().default(30),
  totalTimeMinutes: integer('total_time_minutes').notNull().default(45),
  difficulty: text('difficulty', { enum: ['easy', 'intermediate', 'advanced', 'master'] }).notNull().default('intermediate'),
  cuisine: text('cuisine'),
  imageUrl: text('image_url'),
  heirloomNotes: text('heirloom_notes'), // Grandma's tips, family stories
  
  // Storage & reheating instructions (JSON stringified)
  storageReheating: text('storage_reheating'),
  
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  rating: real('rating'), // Unrated recipes remain null
  createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text('updated_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`).$onUpdate(() => new Date().toISOString())
});

// -------------------------------------------------------------
// INGREDIENTS TABLE
// -------------------------------------------------------------
export const ingredients = sqliteTable('ingredients', {
  id: text('id').primaryKey(),
  recipeId: text('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  unit: text('unit').notNull(), // 'g', 'ml', 'tsp', 'tbsp', 'piece', etc.
  gramsEquivalent: real('grams_equivalent'), // Exact weight in grams for precision
  category: text('category').notNull().default('pantry'), // produce, meat, dairy, pantry, spices
  notes: text('notes'), // e.g., 'diced small', 'room temperature'
  sortOrder: integer('sort_order').notNull().default(0)
}, table => [index('ingredients_recipe_id_idx').on(table.recipeId)]);

// -------------------------------------------------------------
// STEPS TABLE (WITH FOOD SCIENCE & SENSORY MILESTONES)
// -------------------------------------------------------------
export const steps = sqliteTable('steps', {
  id: text('id').primaryKey(),
  recipeId: text('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  stepNumber: integer('step_number').notNull(),
  instruction: text('instruction').notNull(),
  durationMinutes: integer('duration_minutes'),
  timerRequired: integer('timer_required', { mode: 'boolean' }).notNull().default(false),
  heatLevel: text('heat_level', { enum: ['none', 'low', 'medium-low', 'medium', 'medium-high', 'high'] }),
  
  // The Culinary Science "Why"
  scienceWhy: text('science_why'),
  failurePrevention: text('failure_prevention'),
  
  // Sensory Milestones
  sensoryVisual: text('sensory_visual'),
  sensoryAudio: text('sensory_audio'),
  sensoryAroma: text('sensory_aroma'),
  sensoryTexture: text('sensory_texture'),
  internalTempTargetC: real('internal_temp_target_c'),
  
  sortOrder: integer('sort_order').notNull().default(0)
}, table => [index('steps_recipe_id_idx').on(table.recipeId)]);

// -------------------------------------------------------------
// PANTRY ITEMS TABLE
// -------------------------------------------------------------
export const pantryItems = sqliteTable('pantry_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  category: text('category').notNull().default('pantry'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
});

// -------------------------------------------------------------
// RECIPE EQUIPMENT TABLE
// -------------------------------------------------------------
export const recipeEquipment = sqliteTable('recipe_equipment', {
  id: text('id').primaryKey(),
  recipeId: text('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isEssential: integer('is_essential', { mode: 'boolean' }).notNull().default(true),
  substituteTool: text('substitute_tool') // e.g. "blender if food processor is unavailable"
}, table => [index('recipe_equipment_recipe_id_idx').on(table.recipeId)]);

// -------------------------------------------------------------
// GROCERY LISTS & ITEMS
// -------------------------------------------------------------
export const groceryLists = sqliteTable('grocery_lists', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
});

export const groceryItems = sqliteTable('grocery_items', {
  id: text('id').primaryKey(),
  listId: text('list_id').notNull().references(() => groceryLists.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  amount: real('amount'),
  unit: text('unit'),
  category: text('category').notNull().default('pantry'), // produce, dairy, meat, etc.
  
  // Store Department / Regional Destination Routing
  storeDestination: text('store_destination', { 
    enum: ['manavis_produce', 'chasapis_butcher', 'fournos_bakery', 'supermarket', 'kava_cellar', 'general'] 
  }).notNull().default('supermarket'),
  
  // Real-world counter assistance (e.g. phrase to tell the butcher in Greek/English)
  counterPhrase: text('counter_phrase'),
  
  // Commercial pack-size rounding (e.g. "1x 6-pack (leaves 1 egg)")
  packageSizeToBuy: text('package_size_to_buy'),
  surplusLeftoverTip: text('surplus_leftover_tip'),
  
  // Multi-Course traceability (JSON: { appetizer: 2, main: 3, dessert: 1 })
  courseBreakdown: text('course_breakdown'),
  
  isChecked: integer('is_checked', { mode: 'boolean' }).notNull().default(false),
  recipeOriginId: text('recipe_origin_id')
});

// -------------------------------------------------------------
// GUESTS & DIETARY PROFILES TABLE
// -------------------------------------------------------------
export const guests = sqliteTable('guests', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  allergies: text('allergies'), // JSON array: ['gluten', 'lactose', 'peanuts']
  dietaryRestrictions: text('dietary_restrictions'), // JSON: ['vegan', 'halal', 'pregnant']
  dislikes: text('dislikes'), // JSON: ['cilantro', 'liver']
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
});

// -------------------------------------------------------------
// USER KITCHEN HARDWARE PROFILE
// -------------------------------------------------------------
export const userKitchenProfile = sqliteTable('user_kitchen_profile', {
  id: text('id').primaryKey().default('default'),
  stoveType: text('stove_type', { enum: ['gas', 'induction', 'electric_radiant'] }).notNull().default('gas'),
  ovenType: text('oven_type', { enum: ['convection_fan', 'static_conventional'] }).notNull().default('convection_fan'),
  hasMicrowave: integer('has_microwave', { mode: 'boolean' }).default(true),
  hasAirFryer: integer('has_air_fryer', { mode: 'boolean' }).default(false),
  hasInstantPot: integer('has_instant_pot', { mode: 'boolean' }).default(false),
  hasCastIron: integer('has_cast_iron', { mode: 'boolean' }).default(true),
  hasClayGastra: integer('has_clay_gastra', { mode: 'boolean' }).default(false),
  preferredSaltType: text('preferred_salt_type', { enum: ['table_salt', 'morton_kosher', 'diamond_crystal_kosher', 'greek_fine_sea_salt'] }).default('table_salt')
});

// -------------------------------------------------------------
// COOKING SESSIONS & LOGS
// -------------------------------------------------------------
export const cookingSessions = sqliteTable('cooking_sessions', {
  id: text('id').primaryKey(),
  recipeId: text('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  startedAt: text('started_at').default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  completedAt: text('completed_at'),
  userRating: integer('user_rating'), // 1-5
  sessionNotes: text('session_notes'), // "Salted slightly too much, bake 5 mins less next time"
  photoUrl: text('photo_url')
});
```

---

## 2. Nitro Server API Endpoints

### 1. Recipes API
- `GET /api/recipes`: List all saved recipes with search, tag filters, and sorting.
- `GET /api/recipes/:id`: Full recipe details including ingredients, steps, science notes, equipment, and cooking history.
- `POST /api/recipes`: Create a new recipe manually or from AI pipeline.
- `PUT /api/recipes/:id`: Update recipe, ingredients, or grandma's notes.
- `DELETE /api/recipes/:id`: Delete a recipe.

### 2. Ingestion & AI Endpoints
- `POST /api/ingest/url`:
  - Request: `{ url: string, modelTier?: 'speed' | 'reason' }`
  - Response: Returns parsed `RecipeSchema` with stripped bloat and calculated gram metrics.
- `POST /api/ingest/video`:
  - Request: `{ videoUrl: string, language?: string }`
  - Response: Fetches transcript and reconstructs missing measurements.
- `POST /api/ai/recipe/stream`:
  - SSE endpoint (`Content-Type: text/event-stream`).
  - Streams real-time thoughts and progressive JSON recipe generation directly to the client.
- `POST /api/ai/substitute`:
  - Request: `{ ingredientName: string, recipeContext: string }`
  - Response: Returns 2–3 scientific substitution alternatives with moisture/texture adjustments.
- `POST /api/ai/rescue`:
  - Request: `{ issueDescription: string, recipeContext?: string, currentStep?: number }` (description 3–3000 characters; step 1–500).
  - Response: `{ title: string, actions: string[], science: string, caution: string, mode: 'live' | 'fallback' }`. Immediate triage recovery steps; request-header BYOK or deterministic offline fallback. See `PHASE_3_IMPLEMENTATION.md`.
- `POST /api/meal-plan/orchestrate`:
  - Request: `{ recipeIds: string[], targetServeTime: string, guestCount: number }`
  - Response: Returns unified backwards prep and cooking timeline with equipment conflict warnings.
- `POST /api/meal-plan/dietary-audit`:
  - Request: `{ recipeIds: string[], guestIds: string[] }`
  - Response: Returns collision matrix, allergen flags, and surgical ingredient micro-substitutions.

### 3. Pantry & Grocery Endpoints
- `GET /api/pantry`: Fetch all items in inventory.
- `POST /api/pantry`: Add new item or batch-add from grocery receipts.
- `POST /api/pantry/match`: Find recipes in the cookbook that maximize the use of currently expiring ingredients.
- `POST /api/grocery/generate` (implemented; persists a `grocery_lists` row and its `grocery_items`, returns 201):
  - Request — exactly one menu shape; `servings` rescales every course unless a course sets its own:
    ```typescript
    {
      courses?: { recipeId: string, course?: 'appetizer' | 'main' | 'side' | 'dessert' | 'beverage', servings?: number }[], // 1–12
      recipeIds?: string[],                                                   // 1–12, each treated as 'main'
      menu?: { appetizerId?: string, mainCourseId?: string, dessertId?: string, beverageId?: string },
      servings?: number,
      title?: string                                                          // defaults to recipe titles joined by " · "
    }
    ```
    `region` and `deductPantry` are rejected with 400 until Greek-only routing is extended and pantry deduction ships. Missing recipes return 404; nothing is written.
  - Response:
    ```typescript
    {
      listId: string, title: string,
      destinations: {                        // ordered laiki → chasapis → fournos → supermarket; empty sections omitted
        section: 'laiki' | 'chasapis' | 'fournos' | 'supermarket',
        storeType: 'manavis_produce' | 'chasapis_butcher' | 'fournos_bakery' | 'supermarket', // persisted store_destination
        name: string, localizedName: string, // e.g. "Χασάπης / Κρεοπωλείο"
        items: {
          id: string, key: string, name: string, amount: number, unit: 'g' | 'ml' | 'piece' | string,
          counterPhrase?: string,            // butcher order: "1,4 κιλά αρνίσια σπάλα, κομμένη σε μερίδες για γάστρα"
          packageSizeToBuy?: string,         // "1 × 250 ml carton"
          surplusLeftoverTip?: string,       // "About 50 ml left over: enrich a pan sauce or whip for dessert; …"
          note?: string,                     // e.g. egg parts "2 whole · 2 yolks", or an unconvertible second measure
          prepNotes: string[],
          usedIn: { course: string, recipeId: string, recipeTitle: string, name: string, amount: number, unit: string }[]
        }[]
      }[],
      prepAlerts: { course: string, recipeId: string, recipeTitle: string, text: string }[] // soak, marinate, thaw, overnight…
    }
    ```
  - Engine (`shared/culinary/grocery.ts`): catalog terms in English and accent-folded Greek stems; the longest match decides the section, and processed forms (canned, frozen, dried, stock, powder) never route to the laiki or butcher. Mass, volume, and count are summed across courses in g/ml/pieces; different dimensions of one ingredient stay separate lines. Separated eggs pool across courses (whole + max(yolks, whites)). Packs use the fewest sensible packs (each extra pack costs one smallest pack of waste). Butcher phrases agree in gender with the cut and take the dish (γάστρα, κοκκινιστό, στιφάδο, κλέφτικο, γιουβέτσι, σούπα) from the recipe; meat orders round up to 50 g. Fish routes to the supermarket.
- `PUT /api/grocery/items/:id/toggle`: Check or uncheck grocery item.
