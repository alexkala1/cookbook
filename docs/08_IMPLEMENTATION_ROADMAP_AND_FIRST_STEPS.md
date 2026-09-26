# Heirloom: Implementation Roadmap & Execution Plan

## 1. Phased Development Roadmap

The project is structured into 6 sequential phases, ensuring every feature is empirically verified before moving to the next.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 0: Foundation, Design Tokens & Fullstack Scaffolding             │
│ • Nuxt 4 / 3.x baseline with Nuxt UI v3 (Tailwind v4)                 │
│ • Drizzle ORM + SQLite setup with initial migrations                   │
│ • PWA configuration and responsive layout scaffolding                  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Core Recipe & Drink Models with BYOK Settings                 │
│ • Recipe & Cocktail CRUD with Heirloom editorial aesthetic             │
│ • Multi-model BYOK settings panel (OpenAI, Anthropic, Gemini, Groq)    │
│ • Unit & Salt Density engine (Grams/Ounces/Cups, Kosher vs Table)     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 2: AI Ingestion & "Fill-The-Gaps" Reasoning Engine              │
│ • Web URL cleaner (JSON-LD + Readability + LLM normalization)          │
│ • Video transcript ingestion (YouTube / TikTok -> portion reconstruction)│
│ • Drink & cocktail thermodynamic parser (shaken vs stirred)            │
│ • Food Science "Why" generator & sensory milestone injector            │
│ • Real-time SSE streaming for live recipe creation                     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 3: Kitchen Mode, "Rescue My Dish" & Hands-Free Interaction       │
│ • Screen WakeLock integration (@vueuse/core)                           │
│ • "Mise en Place" advance prep & equipment checklist                   │
│ • "🚨 Rescue My Dish" live emergency troubleshooter                    │
│ • Giant typography step-by-step navigation & multi-step timers         │
│ • Voice commands ("Next", "Back", "Timer") via Web Speech API          │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 4: Pantry, Receipt Scanning & Smart Grocery Consolidation        │
│ • Virtual pantry with receipt OCR and fridge shelf scanning            │
│ • "Cook with what I have" recipe matcher                               │
│ • Molecular & culinary substitution advisor (flavor, moisture, structure)│
│ • Consolidated grocery list with pantry deduplication & aisle sorting  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 5: Multi-Course Dinner Conductor & Heirloom Keepsake             │
│ • Dinner party orchestrator: unified backwards cooking schedule        │
│ • Equipment bottleneck detector (oven temp & burner conflicts)         │
│ • Heirloom family memories, ratings & photo logs                       │
│ • Printable vintage heirloom PDF export & Hardcover print hook         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 6: Open-Core Ecosystem, Cloud Sync & App Store Deployment        │
│ • Open-source community packaging (Docker / self-hosted instructions) │
│ • Optional "Heirloom Cloud" encrypted multi-device sync hooks          │
│ • Mobile app binaries packaging (Capacitor / native wrapper)           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Dev-Crew Execution Protocol (Gemini -> Codex -> Claude)

Once we review and confirm the architectural plan, we will execute each phase through the `dev-crew` protocol:

1. **Gemini (Logic)** uses `prompt-sharpener` to generate a tight, checkable goal.
2. We launch via:
   ```bash
   crew launch /home/alex/repos/cookbook "<Sharpened Goal>"
   ```
3. **Claude** inspects the repo, breaks down the goal into testable tasks with acceptance tests.
4. **Codex** builds each task in its own Herdr pane/worktree, executing tests until green.
5. **Claude** conducts adversarial code review on the diff.
6. A notification fires when ready for the user's final merge approval (`crew merge`).

---

## 3. Immediate Next Step: Phase 0 Scaffolding

The first implementation goal will establish the repo baseline:
- Initialize clean Nuxt 4 / latest Nuxt project with pnpm.
- Install `@nuxt/ui`, `@vueuse/nuxt`, `drizzle-orm`, `better-sqlite3`, `zod`, `lucide-vue-next`.
- Configure Tailwind theme tokens for the Heirloom palette (warm cream/linen background, deep espresso serif typography, vibrant sage/terracotta accents).
- Setup Drizzle ORM configuration (`drizzle.config.ts`, `server/db/schema.ts`).
- Verify build and basic dev server cleanly.
