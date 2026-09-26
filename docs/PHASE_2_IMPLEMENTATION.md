# Phase 2: ingestion and culinary assistance

## Request contracts

All mutation routes retain the existing Host allowlist and same-origin checks. AI credentials come exclusively from `x-byok-key`, `x-byok-provider`, and `x-byok-model` request headers. They are never written to the database or application logs. No environment API key is read. Provider errors are sanitized; provider redirects are disabled.

| Route | JSON body | Result |
| --- | --- | --- |
| POST `/api/ingest/url` | `{ "url": "https://example.com/recipe" }` | Validated RecipeInput draft |
| POST `/api/ingest/video` | `{ "videoUrl": "YouTube URL or ID", "language": "en" }` | Validated RecipeInput draft |
| POST `/api/ingest/prompt` | `{ "prompt": "Grandma’s lemon chicken" }` | Validated RecipeInput draft |
| POST `/api/ai/recipe/stream` | `{ "kind": "prompt", "prompt": "Grandma’s lemon chicken" }` or `kind: url/video` with corresponding fields | SSE progress and validated draft |
| POST `/api/ai/substitute` | `{ "ingredientName": "butter", "recipeContext": "A moist cake" }` | `{ options: [{ name, ratio, science, adjustment }], mode }` |

Imports never save automatically. The import view submits the reviewed draft to the existing POST `/api/recipes` endpoint only when **Save to Cookbook** is selected.

SSE events are `status`, `thought`, `recipe_chunk`, and `complete`; failures after opening the stream emit `error`. `thought` contains short public progress descriptions, never private model reasoning. Complete payload: `{ recipe, mode, provenance, warnings }`. Progress begins before retrieval; the recipe chunk is emitted after validation, followed by completion. This is workflow streaming, not raw provider token streaming. Heartbeats continue during retrieval/generation. Cancellation closes the stream and aborts active provider/source HTTP requests. Native streams avoid H3 1.15.11 EventStream cancellation rejection behavior.

## Providers and fallback

OpenAI and Groq use Chat Completions; Anthropic uses Messages; Gemini uses generateContent; Ollama uses `/api/chat` on fixed `http://127.0.0.1:11434`. Select a supported model ID in Settings. Ollama requires an installed local model and explicit model selection, but no key. Cloud providers require a request key and model. Sources cannot override provider endpoints.

No cloud key means deterministic mode: complete JSON-LD recipes retain their measurements; unstructured pages and memories receive a clearly labeled culinary starting draft. This fallback is deliberately limited to a vegetable skillet, lemon chicken, or a basic stirred cocktail. It does not claim to reconstruct arbitrary recipes. Inferred amounts carry `[Inferred by AI]`; missing JSON-LD amounts with no reliable offline ratio remain 0 with an explicit unset-quantity note. Live-provider failures never silently become mock success.

Offline substitutions cover butter, egg, milk, and lemon/lime/vinegar with contextual limits. Unsupported ingredients return 422; a live model can provide additional options. Suggestions do not modify stored recipes.

## Source and science boundaries

Source requests permit public HTTP(S) on standard ports, reject credentials and local/reserved IPs, inspect every DNS answer, pin the connection to the validated IP, and revalidate redirects. Limits: three redirects, 2 MB response, 15 seconds per HTTP request. TLS certificate validation remains enabled. Source requests never carry BYOK credentials. JSON-LD supports arrays, graphs, nested instruction sections, ISO durations, fractions, images, and servings. HTML fallback removes scripts and page chrome.

YouTube ingestion uses accessible player caption tracks, then the video-specific description. Generic error/consent-page descriptions do not count as video content. Private, blocked, or transcriptless/descriptionless videos may require pasting notes into Memory. No audio download/transcription or visual video analysis is included.

Science enrichment preserves authored cues and adds relevant browning, emulsification, convection, diffusion, or stirring explanations. Poultry cooking steps receive a 74 °C thermometer target. Sensory cues alone never establish food safety. Drink dilution/cooling values are approximate heuristics, not measured thermodynamic simulation; carbonated drinks are built without shaking. Unknown original salt types remain unknown.

## Primary references

- [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat)
- [Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create)
- [Gemini generateContent](https://ai.google.dev/api/generate-content)
- [Groq OpenAI compatibility](https://console.groq.com/docs/openai)
- [Ollama chat](https://docs.ollama.com/api/chat)
- [FoodSafety.gov minimum internal temperatures](https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures)
