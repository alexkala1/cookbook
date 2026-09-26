# Heirloom: Multimodal Ingestion Pipeline

## 1. Pipeline Overview

Recipes exist in many formats: food blogs with SEO clutter, dynamic YouTube videos, TikTok reels with silent cooking, crumpled handwritten index cards, or fond childhood memories. Heirloom provides a unified ingestion gateway that normalizes any input into the canonical `RecipeSchema`.

```mermaid
flowchart LR
    A1[Web URL / Blog] --> B1[HTML & JSON-LD Extractor]
    A2[YouTube / TikTok Video] --> B2[Audio & Transcript Extractor]
    A3[Handwritten Recipe Card] --> B3[Vision OCR Model]
    A4[User Freeform Voice/Text] --> B4[Direct Semantic Parser]

    B1 --> C[Multimodal Ingestion Normalizer]
    B2 --> C
    B3 --> C
    B4 --> C

    C --> D[AI "Fill-The-Gaps" & Food Science Engine]
    D --> E[Canonical Recipe Card & Drizzle DB]
```

---

## 2. Ingestion Channel 1: Web Pages & Food Blogs

### The Extraction Hierarchy:
1. **Tier 1: Structured Metadata (Zero LLM Tokens):**
   - Attempt to parse embedded `application/ld+json` (`schema.org/Recipe`).
   - If present, extract `name`, `recipeIngredient`, `recipeInstructions`, `prepTime`, `cookTime`, and `nutrition`.
2. **Tier 2: DOM Content Extraction (Cheerio + Readability):**
   - If JSON-LD is missing or incomplete, extract the main content using Mozilla Readability or Cheerio.
   - Strip navigation, sidebars, cookie banners, ad slots, comments, and footer junk.
3. **Tier 3: LLM Normalization & Enhancement:**
   - Send the extracted text to Tier 1 fast model (Gemini Flash or Groq Llama 3.3).
   - The model maps raw text to the `RecipeSchema`, converts volumetric measurements to metric grams, and flags any missing steps or parameters for Tier 2 reasoning.

---

## 3. Ingestion Channel 2: Video Cooking Content (YouTube, TikTok, Instagram)

Cooking videos are the #1 source of modern culinary inspiration, yet the hardest to cook from.

### Technical Workflow:
1. **Metadata & Caption Retrieval:**
   - For YouTube: Call YouTube Data API or fetch transcript tracks directly via `youtube-transcript-api` or `yt-dlp`.
   - For TikTok / Instagram Reels: Extract audio stream using `yt-dlp` and transcribe via Whisper Turbo (Groq / OpenAI).
2. **Video Description & Pinned Comments Parsing:**
   - Frequently, video creators include partial ingredient lists or sponsored links in the video description or top pinned comment. The scraper ingests both description and top comments.
3. **The Video "Gap-Fill" Challenge:**
   - *Problem:* In 70% of cooking videos, the chef says: "Pour in some olive oil, toss in a bunch of garlic, cook until golden, then season to taste."
   - *Solution:* The AI cross-references:
     - The type and size of the dish (e.g. "Braised beef stew for 4 people").
     - Culinary baseline ratios (e.g., standard mirepoix ratio = 2 parts onion, 1 part carrot, 1 part celery by weight).
     - Calculates precise estimated metrics: "30ml olive oil (2 tbsp)", "4 cloves garlic, minced (12g)", "1.5 tsp kosher salt (9g)".
     - Labels reconstructed metrics with an *[Inferred by AI]* badge so the user knows it was calculated scientifically rather than stated in the video.

---

## 4. Ingestion Channel 3: Handwritten Recipe Cards & Photos

Family recipes are often written on faded cards, indexed in vintage metal boxes, or scribbled on napkins in cursive.

### Technical Workflow:
1. **Image Preprocessing:**
   - Browser or server contrast enhancement, perspective correction, and noise reduction.
2. **Vision Model Analysis:**
   - Processed via Gemini 2.5 Pro Vision or GPT-4o Vision.
   - **Handwriting Deciphering Prompt:**
     - Specifically instructed to handle faded ink, stains, shorthand abbreviations (e.g., "T" = Tablespoon vs "t" = teaspoon, "oleo" = margarine/butter, "smidgen", "dash").
3. **Contextual Confidence Validation:**
   - If handwriting is ambiguous (e.g., "1/2 cup or 1 1/2 cup?"), the AI uses baking chemistry to detect which amount makes chemical sense for the surrounding flour and leavening agents, and prompts the user with an explicit clarification option.

---

## 5. Ingestion Channel 4: Freeform Conversational Prompts & Voice Memory

Users can speak or type freely:
> *"My grandmother used to make a Sunday Greek lemon chicken with roasted potatoes. She used dry oregano, lots of yellow mustard, fresh lemon juice, garlic cloves, olive oil, and some water in the baking dish so it stayed juicy. She roasted it until the potatoes had crispy edges."*

### Semantic Reconstruction:
- Parses the conversational memory.
- Builds an authentic, mathematically sound recipe structure:
  - Chicken pieces weight (e.g. 1.2kg chicken thighs/drumsticks).
  - Potato ratio (800g Yukon Gold or Agria potatoes, cut into wedges).
  - Liquid emulsion (60ml extra virgin olive oil, 50ml fresh lemon juice, 30g Dijon or Greek yellow mustard, 120ml chicken broth/water).
  - Oven temperature and time (200°C / 400°F convection for 55–65 minutes, turning potatoes once).
- Attaches the story to `heirloomNotes` preserving the familial memory alongside the recipe.
