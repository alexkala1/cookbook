# Heirloom

**Heirloom: The calm, private, self-hosted kitchen companion.**

A cookbook for the recipes your family actually cooks, with the help a good cook wants at the counter: steady guidance in the kitchen, a shopping list that knows where Greek shops keep things, a pantry that remembers what is about to expire, and a plan that gets a whole dinner to the table at the same moment. It runs on your own computer, and your recipes, pantry and family notes never leave it.

## What it does

- **Kitchen Mode.** Large step text, steps read aloud on request, several timers at once with a chime and a visible alert, a wake lock to keep the screen on, hands-free camera gestures, and oven-temperature conversion for your own oven. Stuck? **Rescue My Dish** suggests a fix.
- **Smart grocery and Greek market routing.** A menu becomes one shopping list sorted by where you actually buy it: laiki, butcher, bakery, supermarket and the Κάβα (cellar). It merges quantities, suggests pack sizes, gives you the Greek words to say at the counter, can subtract what is already in your pantry and shows live supermarket prices. Share it by WhatsApp or QR code, or print it.
- **Pantry with shelf-life estimates.** Pantry, fridge, freezer and spices, with an estimated expiry when you do not enter one, low-stock warnings, receipt-text import and "Cook with what I have".
- **Multi-course Dinner Conductor.** Pick your courses and the time guests sit down. Heirloom works backwards to a single schedule, flags oven and burner clashes, writes a chef's briefing and suggests Greek wines and other drinks. The Guests page checks the same menu against everyone's allergies and diets.
- **Bring recipes home.** Import from a web page or a YouTube video, with offline fallbacks when no AI is available. Scale servings, convert units and keep your family's changes. Storage and reheating advice appears on most recipes.

## Quickstart (about a minute, plus the first build)

You need Docker with Compose and `git`.

```sh
git clone <your-heirloom-repo-url> heirloom && cd heirloom
cp .env.example .env
mkdir -p data && sudo chown 1000:1000 data && chmod 700 data
docker compose up -d --wait
```

Open **<http://localhost:3000>**. On an empty cookbook, choose **Load Starter Heirloom Recipes** to try five Greek dishes.

The first start builds the image, which takes a few minutes. By default Heirloom listens on this computer only and has no login: it is made for one household on a trusted network. For the Raspberry Pi, Unraid, TrueNAS, Synology and Portainer notes, reverse proxies, backups, restore and upgrades, read the **[Self-hosting guide](docs/SELF_HOSTING.md)**.

## Guides

- **[Cook's Handbook](docs/USER_GUIDE.md)** for everyday use: importing, Kitchen Mode, Dinner, shopping, pantry, guests and leftovers. It is also built into the app under Settings.
- **[Self-hosting guide](docs/SELF_HOSTING.md)** for installing, reaching it from other devices, backing it up and keeping it up to date.
- **[AI agents over MCP](docs/USER_GUIDE.md#connect-an-ai-agent-mcp).** Heirloom ships a Model Context Protocol server (`npm run mcp --silent`) so Claude Desktop, Cursor or Antigravity can list, read and save recipes and check your pantry. Setup and the eight tools are in the Handbook.

## Good to know

- Allergy checks, culinary advice and storage times are guidance that needs a person's judgement; they cannot guarantee food safety.
- Receipt import reads pasted text, including text from an OCR app; it does not scan photos. Camera gestures detect motion on your device and send no video anywhere.
- AI features are optional and bring-your-own-key. Keys stay in your browser's storage; with no key, offline fallbacks still work. Self-hosting means your data stays with you, so back it up.
- Timers survive a reload in the same browser tab. Background audio can be delayed, so keep an eye on the pan.
- Voice dictation and OpenRouter are not implemented.

Built with Nuxt 4, Vue 3, Nuxt UI 3, Tailwind 4, Nitro, Drizzle ORM and SQLite (`better-sqlite3`).

## Local development

Use Node.js 24 and pnpm 11.22.0. Resolved package versions are pinned in `pnpm-lock.yaml`.

```sh
pnpm install --frozen-lockfile
pnpm run db:migrate
pnpm dev
```

SQLite defaults to `./heirloom.db`. Export a filesystem path in `DATABASE_URL` to override it; create its parent directory first and use the same value for migrations and the server. Outside Docker, migrations remain explicit. Production does not automatically load `.env`.

An empty recipe collection offers **🌱 Load Starter Heirloom Recipes**: five Greek dishes with ingredients, equipment, science notes, sensory cues and family-table guidance. The same pack can be loaded locally with `pnpm run db:seed` (which applies migrations first). Both paths load all five atomically only when the cookbook contains zero recipes; existing recipes are never replaced or supplemented. Docker users can use the in-app action without installing development tools.

```sh
pnpm test
pnpm run typecheck
pnpm run build
pnpm run start
```

Development, preview, and `pnpm run start` bind to `127.0.0.1`. When launching Nitro directly outside Docker, set `NITRO_HOST=127.0.0.1` explicitly. API clients must supply the same-origin header on mutations:

```sh
curl --fail-with-body http://127.0.0.1:3000/api/recipes \
  -H 'Origin: http://127.0.0.1:3000' \
  -H 'Content-Type: application/json' \
  --data '{"title":"Φασολάδα","description":"Family soup","originalSaltType":null}'
```

After schema edits, run `pnpm run db:generate`, inspect the SQL, then run `pnpm run db:migrate`. Tests apply committed migrations to isolated SQLite databases. Native build approvals are recorded in `pnpm-workspace.yaml` (`allowBuilds` for pnpm 11, with the original `onlyBuiltDependencies` list retained).

## Documentation

- [Cook's Handbook](docs/USER_GUIDE.md), also available in Settings inside the app.
- [Self-hosting guide](docs/SELF_HOSTING.md)
- [Architecture and stack](docs/02_ARCHITECTURE_AND_TECH_STACK.md)
- [AI/BYOK design](docs/03_AI_ENGINE_AND_MULTI_MODEL_BYOK.md) and [ingestion design](docs/04_MULTIMODAL_INGESTION_PIPELINE.md)
- [Feature deep dive](docs/05_FEATURE_DEEP_DIVE_AND_EXPANSIONS.md)
- [Database schema and API contracts](docs/07_DATABASE_SCHEMA_AND_API_CONTRACTS.md) and [backup format](docs/backup-api.md)
- Implementation notes: [Phase 2](docs/PHASE_2_IMPLEMENTATION.md), [Phase 3](docs/PHASE_3_IMPLEMENTATION.md), [Phase 4](docs/PHASE_4_IMPLEMENTATION.md), [Phase 5](docs/PHASE_5_IMPLEMENTATION.md)
- [Phases 0–5 adversarial audit](docs/ADVERSARIAL_AUDIT_PHASES_0_5.md)
- [Phase 6 packaging verification](docs/PHASE_6_VERIFICATION.md)

The numbered design documents include future plans; this README and the Handbook describe current behavior.
