# Heirloom: AI Engine, Multi-Model Routing & BYOK Architecture

## 1. Bring Your Own Key (BYOK) Design

Heirloom is designed with an open, privacy-centric **Bring Your Own Key** model:
- **No Locked Subscription:** Users paste their API keys for the providers they use (or connect to a local Ollama instance for 100% free offline privacy).
- **Client-Side & Session Security:**
  - Keys can be stored in the browser's encrypted local storage or passed via request headers (`x-api-key-openai`, `x-api-key-anthropic`, `x-api-key-gemini`, etc.).
  - The server acts as a pass-through proxy using the user's key without logging or storing credentials permanently in plaintext databases.
- **Provider Selector in App Settings:**
  - Easy toggle between OpenAI, Anthropic, Google Gemini, Groq, OpenRouter, DeepSeek, and Ollama.
  - Ability to set different models for different tasks (e.g. use Groq/Gemini Flash for fast scraping, use Claude 3.5 Sonnet / Gemini Pro for culinary science and course scheduling).

---

## 2. Multi-Model Tiering & Smart Routing

Not every culinary task requires an expensive reasoning model. Heirloom organizes AI tasks into three specialized tiers:

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI TASK ROUTER                              │
└─────────────────────────────────────────────────────────────────┘
         │                               │                      │
         ▼                               ▼                      ▼
┌──────────────────┐           ┌──────────────────┐    ┌──────────────────┐
│  TIER 1: SPEED   │           │  TIER 2: REASON  │    │ TIER 3: VISION   │
│  Fast Extraction │           │  Culinary Brain  │    │ Multimodal OCR   │
├──────────────────┤           ├──────────────────┤    ├──────────────────┤
│• Gemini Flash    │           │• Claude 3.5 Son. │    │• Gemini 2.5/3 Pro│
│• Groq Llama 3.3  │           │• Gemini 2.5 Pro  │    │• GPT-4o Vision   │
│• GPT-4o-mini     │           │• DeepSeek R1/V3  │    │• Whisper Turbo   │
├──────────────────┤           ├──────────────────┤    ├──────────────────┤
│• Clean HTML raw  │           │• "Fill Gaps"     │    │• Handwritten OCR │
│• Video subtitles │           │• Food Science Why│    │• Video keyframes │
│• Normalization   │           │• Multi-course syn│    │• Plate photos    │
│• Unit conversions│           │• Complex subs    │    │• Voice input     │
└──────────────────┘           └──────────────────┘    └──────────────────┘
```

### Tier 1: High-Speed Extractors & Parsers
- **Target Models:** Google Gemini 2.5 Flash, Groq (Llama 3.3 70B Versatile), OpenAI GPT-4o-mini, Claude 3.5 Haiku.
- **Role:**
  - Strip HTML and parse raw text into preliminary JSON structures.
  - Convert volume approximations to grams (density lookups).
  - Categorize ingredients and determine grocery aisle locations.
- **Latency:** Sub-second to 2 seconds.

### Tier 2: Deep Culinary Reasoning & Food Science
- **Target Models:** Anthropic Claude 3.5 Sonnet, Google Gemini 2.5 Pro, DeepSeek R1 / V3, OpenAI GPT-4o / o1.
- **Role:**
  - The **"Fill the Gaps"** Engine: Analyze incomplete recipes and infer exact missing measurements based on culinary proportions.
  - Generate the **"Food Science Why"** layer: Explain chemical and physical transformations occurring at each step.
  - Formulate **Sensory Milestones**: Translate vague instructions like "cook for 5 mins" into sight, sound, smell, and tactile cues.
  - **Course Orchestrator:** Compute synchronized prep and cooking schedules for multi-dish dinner parties.
- **Latency:** 3–8 seconds (streamed via Server-Sent Events).

### Tier 3: Multimodal Vision & Audio
- **Target Models:** Gemini 2.5 Pro Vision, GPT-4o Vision, Whisper (OpenAI / Groq Whisper Large v3 Turbo).
- **Role:**
  - Transcribe audio from spoken recipes, video files, or dictations.
  - OCR vintage handwritten recipe cards, cookbooks, or restaurant menus.
  - Visually estimate dish portions and doneness from food photographs.

---

## 3. The "Fill-The-Gaps" Prompt Engineering Framework

When a raw recipe is ingested, Heirloom runs it through a specialized prompt pipeline designed to de-obfuscate the recipe:

### Prompt System Directive (Culinary Food Scientist Persona):
> *"You are Heirloom's Executive Culinary Scientist and Master Chef. Your goal is to transform incomplete, ambiguous, or conversational recipes into foolproof, professional-grade guides. You never guess blindly; you use classic culinary ratios, food physics, and sensory feedback."*

### Key Analysis Tasks:
1. **Metric Standardization:**
   - Every ingredient must have an exact metric weight in **grams (g)** or volume in **milliliters (ml)**.
   - For volumetric items (e.g. "1 cup flour"), apply standard culinary densities (e.g. 1 cup all-purpose flour = 120g spooned & leveled; 1 cup granulated sugar = 200g).
2. **Step Deconstruction & The "Why":**
   - For every major cooking step, formulate a concise "Why" badge:
     - *Example:* "Searing at high heat causes the Maillard reaction (amino acids + reducing sugars), developing deep savory umami flavors, not 'locking in juices'."
     - *Example:* "Salting eggplant beforehand draws out excess moisture through osmosis and prevents oil saturation during frying."
3. **Sensory Milestones & Internal Temperatures:**
   - Replace arbitrary times with observable sensory cues:
     - Visual: "Edges turn deep golden-brown with small bubbling pockets."
     - Audio: "The violent frying sizzle subsides into a steady, gentle crackle."
     - Aroma: "A fragrant, nutty, toasted scent replaces the raw garlic odor."
     - Internal Temp: "Target internal temperature: 74°C (165°F) for chicken breast, or 54°C (130°F) for medium-rare beef."
4. **Salt Density & Chemistry Normalization:**
   - Salt type variation is the #1 silent killer of recipes. The AI applies density corrections:
     - 1 tsp Table Salt = ~6.0g
     - 1 tsp Morton Kosher Salt = ~4.8g
     - 1 tsp Diamond Crystal Kosher Salt = ~2.8g (less than half the saltiness of table salt!)
   - The AI explicitly tags salt measurements with the recommended variety and exact grams to prevent over/under-salting.
5. **Mise en Place & Equipment Detection:**
   - Detects all required tools (Dutch oven, immersion blender, meat probe, 9x13 pan, cocktail shaker).
   - Generates an advance preparation checklist (e.g. "Soak dried mushrooms in warm water 30 mins prior", "Chill martini glass").
6. **Drinks & Mixology Thermodynamics:**
   - For beverage recipes, evaluates dilution ratio, chilling method (shaken vs stirred), and acid/sugar balance (Brix calculation).

---

## 4. Structured Output Contract (Zod Schema)

All AI completions in Heirloom are strictly validated against a TypeScript/Zod contract before reaching the frontend:

```typescript
import { z } from 'zod';

export const EquipmentSchema = z.object({
  name: z.string(),
  isEssential: z.boolean().default(true),
  substitute: z.string().optional() // e.g. "blender if food processor is unavailable"
});

export const IngredientSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  amount: z.number().positive(),
  unit: z.enum(['g', 'ml', 'tsp', 'tbsp', 'oz', 'piece', 'clove', 'pinch', 'to_taste']),
  gramsEquivalent: z.number().positive().optional(),
  category: z.enum(['produce', 'meat', 'dairy', 'pantry', 'spices', 'bakery', 'liquids', 'spirits']),
  notes: z.string().optional(), // e.g. "chilled and cubed"
  substitutions: z.array(z.object({
    ingredient: z.string(),
    ratio: z.string(),
    flavorImpact: z.string(),
    structuralImpact: z.string()
  })).optional()
});

export const StepSchema = z.object({
  stepNumber: z.number().int().positive(),
  instruction: z.string(),
  durationMinutes: z.number().optional(),
  timerRequired: z.boolean().default(false),
  heatLevel: z.enum(['none', 'low', 'medium-low', 'medium', 'medium-high', 'high']).optional(),
  sensoryCues: z.object({
    visual: z.string().optional(),
    audio: z.string().optional(),
    aroma: z.string().optional(),
    texture: z.string().optional(),
    internalTempTargetC: z.number().optional()
  }),
  scienceWhy: z.string(), // The culinary science explanation
  failurePrevention: z.string().optional(), // Common mistakes to avoid
  ingredientsUsed: z.array(z.string()) // IDs or names of ingredients involved in this step
});

export const RecipeSchema = z.object({
  title: z.string(),
  description: z.string(),
  recipeType: z.enum(['food', 'drink', 'cocktail', 'baking', 'dessert']).default('food'),
  sourceUrl: z.string().url().optional(),
  sourceType: z.enum(['url', 'video', 'prompt', 'handwritten_ocr', 'manual']),
  servings: z.number().int().positive().default(4),
  prepTimeMinutes: z.number().int().nonnegative(),
  cookTimeMinutes: z.number().int().nonnegative(),
  totalTimeMinutes: z.number().int().nonnegative(),
  difficulty: z.enum(['easy', 'intermediate', 'advanced', 'master']),
  cuisine: z.string().optional(),
  dietaryTags: z.array(z.string()),
  
  // Advance preparation & tools
  equipmentNeeded: z.array(EquipmentSchema),
  advanceMiseEnPlace: z.array(z.string()), // Steps to do before starting (e.g. soften butter)
  
  ingredients: z.array(IngredientSchema),
  steps: z.array(StepSchema),
  
  // Drink/Cocktail-specific metadata (optional)
  drinkDetails: z.object({
    glassware: z.string().optional(),
    iceType: z.enum(['cubed', 'crushed', 'clear_large_cube', 'neat_none']).optional(),
    mixingMethod: z.enum(['shaken', 'stirred', 'built_in_glass', 'blended']).optional(),
    alcoholByVolumeEstimated: z.number().optional()
  }).optional(),

  // Storage, Leftovers & Proper Reheating
  storageAndReheating: z.object({
    fridgeLifespanDays: z.number().int().nonnegative(),
    canFreeze: z.boolean(),
    freezerLifespanMonths: z.number().int().nonnegative().optional(),
    bestReheatingMethod: z.string() // e.g. "Oven or skillet at 180°C to preserve crispy crust; avoid microwave"
  }).optional(),
  
  macroNutrientsPerServing: z.object({
    calories: z.number().optional(),
    proteinGrams: z.number().optional(),
    carbsGrams: z.number().optional(),
    fatGrams: z.number().optional(),
    fiberGrams: z.number().optional()
  }).optional(),
  
  heirloomNotes: z.string().optional() // Personal or family memories/tweaks
});

// -------------------------------------------------------------
// EMERGENCY TRIAGE CONTRACT ("Rescue My Dish")
// -------------------------------------------------------------
export const RescueTriageSchema = z.object({
  diagnosis: z.string(),
  immediateAction: z.string(), // Step 1: Remove from heat immediately
  scientificCause: z.string(), // Why the emulsion broke or why scorching occurred
  rescueSteps: z.array(z.string()), // Exact steps to recover the dish
  preventNextTime: z.string()
});
```
