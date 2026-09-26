# Heirloom 🍳
### *The Heirloom Cookbook Reimagined — Grandma's Handwritten Secrets Powered by Modern Food Science & Autonomous AI Mentorship.*

---

## Local development (Phase 0)

Use Node.js 24 and pnpm 11.22.0. Installed versions are pinned in `pnpm-lock.yaml`.

```sh
pnpm install
pnpm run db:migrate
pnpm dev
```

SQLite defaults to `./heirloom.db`, relative to the working directory. Override it with an exported `DATABASE_URL` filesystem path (the parent directory must exist), for example `DATABASE_URL=/srv/heirloom.db pnpm run db:migrate`. Use the same environment variable when starting the app. Production does not load `.env` automatically. Migrations are explicit; importing the database does not apply them.

```sh
pnpm test
pnpm run typecheck
pnpm run build
pnpm run preview
```

After editing `server/db/schema.ts`, run `pnpm run db:generate`, review the generated SQL, and run `pnpm run db:migrate`. Tests apply the committed migrations to isolated in-memory SQLite databases.

`pnpm-workspace.yaml` retains the requested `onlyBuiltDependencies` list and includes equivalent `allowBuilds` entries because pnpm 11 uses the latter for native build approvals.

The homepage and layout wrappers are scaffolded. Recipe/pantry/shopping navigation is labelled “soon”; CRUD, cooking controls, AI, and PWA behavior belong to later work.

## 📖 Architecture & Design Documentation

Comprehensive architectural blueprints and specifications are documented in the [`docs/`](file:///home/alex/repos/cookbook/docs/) directory:

1. **[01. Project Vision & Core Concept](file:///home/alex/repos/cookbook/docs/01_PROJECT_VISION_AND_CORE_CONCEPT.md)**: The heirloom philosophy, solving the "blind following" problem, sensory milestones over timers, and de-obfuscating video cooking.
2. **[02. Architecture & Tech Stack](file:///home/alex/repos/cookbook/docs/02_ARCHITECTURE_AND_TECH_STACK.md)**: Nuxt 4 / latest Vue, Nuxt UI v3 (Tailwind v4), Nitro server, Drizzle ORM + SQLite, PWA offline caching, and Kitchen Mode.
3. **[03. AI Engine, Multi-Model Routing & BYOK](file:///home/alex/repos/cookbook/docs/03_AI_ENGINE_AND_MULTI_MODEL_BYOK.md)**: Bring-Your-Own-Key model, 3-tier routing (Speed, Culinary Reasoning, Multimodal OCR), and Zod schema contracts.
4. **[04. Multimodal Ingestion Pipeline](file:///home/alex/repos/cookbook/docs/04_MULTIMODAL_INGESTION_PIPELINE.md)**: Web scraping (JSON-LD + Readability), video transcript & portion reconstruction (YouTube/TikTok), handwritten card OCR, and freeform voice memory ingestion.
5. **[05. Feature Deep Dive & Expansions](file:///home/alex/repos/cookbook/docs/05_FEATURE_DEEP_DIVE_AND_EXPANSIONS.md)**: Culinary Science "Why" layer, dynamic metric scaling & pan physics, Kitchen Mode with WakeLock, smart pantry & molecular substitutions, and multi-course dinner conductor.
6. **[06. Team Roles & MCP Ecosystem](file:///home/alex/repos/cookbook/docs/06_TEAM_ROLES_AGENTS_AND_MCP_ECOSYSTEM.md)**: The autonomous trio (Gemini = Logic/Specs, Codex = Dev/QA, Claude = Review/Planner) and MCP servers (`context7`, `playwright`, `fetch`, `agent-core_memory`).
7. **[07. Database Schema & API Contracts](file:///home/alex/repos/cookbook/docs/07_DATABASE_SCHEMA_AND_API_CONTRACTS.md)**: Complete Drizzle ORM schema definitions and Nitro server route endpoints.
8. **[08. Implementation Roadmap & First Steps](file:///home/alex/repos/cookbook/docs/08_IMPLEMENTATION_ROADMAP_AND_FIRST_STEPS.md)**: Phased milestones and dev-crew execution plan.
9. **[09. Monetization & Open-Core Strategy](file:///home/alex/repos/cookbook/docs/09_MONETIZATION_AND_OPEN_CORE_STRATEGY.md)**: Open-core FOSS community architecture, BYOK economics, managed "Heirloom Cloud" sync, App Store binaries, and physical hardcover print-on-demand keepsake.

---

## 🛠️ Tech Stack Snapshot

- **Frontend:** Nuxt 4 / Vue 3 (Composition API), Nuxt UI v3, Tailwind CSS v4, `@vueuse/core` (WakeLock, Speech API).
- **Backend:** Nitro Server Engine (H3), Server-Sent Events (SSE) for AI streaming.
- **Database:** Drizzle ORM with SQLite (`better-sqlite3` / `@libsql/client`).
- **Offline / Mobile:** Vite PWA, IndexedDB local cache.
- **AI Integration:** Multi-provider BYOK (OpenAI, Anthropic, Google Gemini, Groq, OpenRouter, Ollama).
- **Core Pillars:** Food Science "Why", Sensory Milestones, Salt Density Normalization, Rescue My Dish Triage, Cocktail & Mixology Craft, Hardware & Stove Thermodynamics (Gas/Induction/Convection), Contactless Air-Wave Gestures, Guest Allergen Shield, Regional Greek Market Routing, and Multi-Course Dinner Conductor.
