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
docker compose up -d --wait
```

Open **<http://localhost:3000>**. On an empty cookbook, choose **Load Starter Heirloom Recipes** to try five classic Greek dishes.

Compose creates a project-scoped `heirloom-data` named volume for SQLite at `/app/data/heirloom.db`, so startup needs no host-directory permission changes. For reverse proxies (Caddy, Nginx, Cloudflare), Raspberry Pi, Unraid, TrueNAS, backups, and upgrades, read the **[Self-hosting guide](docs/SELF_HOSTING.md)**.

## Guides

- **[Cook's Handbook](docs/USER_GUIDE.md)** for everyday use: importing, Kitchen Mode, Dinner, shopping, pantry, guests, leftovers, and connecting AI agents over MCP. It is also built into the app under Settings.
- **[Self-hosting guide](docs/SELF_HOSTING.md)** for installing, reaching it from other devices, backing it up, reverse proxy configs, and keeping it up to date.
- **[AI agents over MCP](docs/USER_GUIDE.md#connect-an-ai-agent-mcp).** Heirloom ships a Model Context Protocol server (`npm run mcp`) so Claude Desktop, Cursor or Antigravity can list, read and save recipes and check your pantry.

## Good to know

- Allergy checks, culinary advice and storage times are guidance that needs a person's judgement; they cannot guarantee food safety.
- Receipt import reads pasted text, including text from an OCR app; it does not scan photos. Camera gestures detect motion on your device and send no video anywhere.
- AI features are optional and bring-your-own-key. Keys stay in your browser's storage; with no key, offline fallbacks still work. Self-hosting means your data stays with you, so back it up.
- Timers survive a reload in the same browser tab. Background audio can be delayed, so keep an eye on the pan.

## Continuous Integration

`.github/workflows/ci.yml` checks pushes and pull requests targeting `master`. The `quality` job installs the frozen pnpm lockfile with pnpm 11.22.0 and Node 24, then runs tests, typecheck, and the production build. The `docker` job validates that the container image builds cleanly.

Built with Nuxt 4, Vue 3, Nuxt UI 3, Tailwind 4, Nitro, Drizzle ORM and SQLite (`better-sqlite3`).

## Local Development

Use Node.js 24 and pnpm 11.22.0. Resolved package versions are pinned in `pnpm-lock.yaml`.

```sh
pnpm install --frozen-lockfile
pnpm run db:migrate
pnpm dev
```

SQLite defaults to `./heirloom.db`. Outside Docker, migrations remain explicit.

```sh
pnpm test
pnpm run typecheck
pnpm run build
pnpm run start
```
