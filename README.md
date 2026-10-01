# Heirloom — Cookbook OS

A local-first family cookbook with food-science guidance, Greek market shopping, and a hands-free cooking interface. Built with Nuxt 4, Vue 3, Nuxt UI 3, Tailwind 4, Nitro, Drizzle ORM, and SQLite (`better-sqlite3`).

## Available features

| Phase | Implemented |
|---|---|
| 0 · Foundation | Typed SQLite schema, versioned migrations, Nuxt layouts, and automated tests. |
| 1 · Cookbook | Recipe and drink CRUD, accent-insensitive Greek search, favorites, servings scaling, metric/imperial units, original-salt tracking and density conversion, kitchen hardware profile, browser-local BYOK settings. |
| 2 · AI ingestion | Web Recipe JSON-LD extraction and HTML normalization; YouTube transcript/description ingestion; conversational memory prompts; SSE progress; inferred-quantity labels; food science and sensory milestones; scientific substitutions; cocktail technique, dilution, and glassware. OpenAI, Anthropic, Gemini, Groq, and Ollama clients plus deterministic offline fallbacks. |
| 3 · Kitchen Mode | Large step text, pagination, wake lock, concurrent timers with synthesized alerts, keyboard and client-only camera motion navigation, offline/BYOK Rescue My Dish, oven conversion and burner guidance. |
| 4 · Pantry and planning | Pantry locations and expiry tracking, quantity-aware recipe matching, receipt-text review, reload-persistent timers, Greek regional grocery assignment and butcher instructions, package guidance, seasonal suggestions, and a multi-course dinner conductor with oven/burner conflict detection. |
| 5 · Guests and keepsakes | Guest allergy/dietary/dislike profiles, structured meal audits with cross-contact guidance, tasting logs and family memories, vintage printable recipe cards. |
| 6 · Self-hosting | Multi-stage Docker image, non-root runtime, persistent SQLite storage, automatic startup migrations, healthcheck, and Docker Compose. |

Receipt input accepts raw text or text from an OCR app; it does not perform image OCR. Camera gestures use local motion detection, not MediaPipe. Voice ingestion and OpenRouter are not implemented. Allergy checks and culinary inference need human review and cannot guarantee food safety. Timers survive reload in the same browser tab; background audio can be delayed.

The responsive shell uses self-hosted Literata and Commissioner (Latin and Greek), mobile destination tabs, and 44px controls. Kitchen Mode adds touch swipes, fixed step controls, five-second timer Undo, and an exit warning while timers run.

## Self-host with Docker Compose

Install Docker Engine or Docker Desktop with Compose. From this repository:

```sh
docker compose up -d
# Optional: wait until startup migrations and the healthcheck succeed.
docker compose up -d --wait
docker compose ps
```

Open **http://localhost:3000**. Compose publishes port 3000 only on the host's loopback interface. Nitro listens on `0.0.0.0` inside the container so Docker can forward that port. The application runs as `node` (UID 1000), with dropped Linux capabilities and no privilege escalation.

The installable PWA requires **HTTPS or localhost** for its service worker. Home, static assets/fonts, previously visited pages, and selected GET API responses are available offline after loading online. Offline writes and AI calls are not queued; never assume an unsaved edit was persisted. AI/BYOK requests and mutations are excluded from runtime caching. Cached reads can be up to seven days old when offline; clear this site's browser storage when using a shared device. Updates offer an explicit Reload action outside Kitchen Mode rather than interrupting cooking.

If port 3000 is occupied, set `HEIRLOOM_PORT=3107` in your shell or Compose `.env` file before starting, then open `http://localhost:3107`. Retain the setting for subsequent Compose commands.

Compose creates a project-scoped `heirloom-data` named volume at `/app/data`; `DATABASE_URL=/app/data/heirloom.db`. A fresh volume inherits UID/GID 1000 ownership and mode 0700 from the image, so startup needs no host-directory ownership changes. Copy `.env.example` to `.env` for optional port and public-host overrides. The Compose database path is fixed independently of the local-development `DATABASE_URL` example.

Existing `./data` installations are **not automatically imported**. Stop the old service and back up its complete directory, then copy that directory's contents into the named volume using a temporary container and grant only those files UID/GID 1000 ownership before starting. Keep the original data until the migrated application has been verified.

The entrypoint applies committed migrations before launching Nitro and exits on migration failure. The image contains Nitro's traced production dependencies and manifest, the SQLite native binary, and `server/db/migrations`; build tools and development dependencies stay in the build stage. No local database, `.env`, or browser API key is baked into the image. Never run multiple replicas against this SQLite directory.

```sh
docker compose logs --tail=100 heirloom
curl --fail http://localhost:3000/api/settings/kitchen
docker compose stop
docker compose start
```

Docker checks the kitchen endpoint every 30 seconds, with a 30-second startup grace period. It exercises database access as well as HTTP serving. An unhealthy status is diagnostic; Docker restart policies restart exited processes, not merely unhealthy ones.

### Updates and backups

Stop writes before copying SQLite storage; preserve the complete directory, including any WAL files. Protect backups as personal information.

```sh
docker compose stop
mkdir -m 700 heirloom-backup
docker compose cp heirloom:/app/data/. ./heirloom-backup/
# Update the checkout, review migration changes, then rebuild and start.
docker compose build --pull
docker compose up -d --wait
```

To restore, stop the service, back up the current volume, replace its contents with a selected complete backup, restore UID/GID 1000 write permissions, and start a compatible image. An older image may not understand a newer schema; retain the matching image/version with backups. `docker compose down` keeps the named volume; **`docker compose down -v` deletes it**.

### Network access, keys, and deployment limits

There is no multiuser authentication. Keep the default loopback binding; an SSH tunnel provides remote access without publishing the application:

```sh
ssh -L 3000:127.0.0.1:3000 user@your-server
```

Requests accept `localhost`, `127.0.0.1`, and `[::1]` hosts. Compose defaults `HEIRLOOM_PUBLIC_HOST` to `http://localhost:3000`. For an alternative hostname, use an exact hostname or HTTP(S) origin, such as `http://cookbook.example.com:3000`, without credentials, paths, queries, or wildcards. Only its hostname enters the Host allowlist; mutation origins must still match the direct connection. This does not add authentication or change port exposure.

Mutation requests require a matching `Origin` or `Referer`. Forwarded host/protocol headers are intentionally untrusted. A TLS-terminating reverse proxy is **not supported out of the box**: HTTPS browser origins will not match the internal HTTP connection. Do not bypass CSRF checks to make a proxy work; use the SSH tunnel or implement an explicit trusted-origin policy first. Camera and wake-lock features also depend on browser secure-context permissions.

## Continuous integration

`.github/workflows/ci.yml` checks pushes and pull requests targeting `master`. The `quality` job installs the frozen pnpm lockfile with pnpm 11.22.0 and Node 24, then runs tests, typecheck, and the production build. The `docker` job builds `heirloom:ci` only after quality passes. Workflow permissions are read-only and superseded runs are cancelled. No deployment or image publication is configured.

Configure AI providers in **Settings**. Keys live in that browser's localStorage and are sent in request headers only when used; the server does not persist them. Do not put keys in the Dockerfile or Compose file. Changing browser origin changes the storage scope. Offline fallbacks work without a live key. The current Ollama client targets `127.0.0.1:11434`; in Docker this is the container itself, so a host-installed Ollama is not reachable through the default Compose setup. Cloud providers need outbound HTTPS access.

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

- [Cook's Handbook](docs/USER_GUIDE.md) — practical kitchen workflows; also available in Settings inside the app.
- [Architecture and stack](docs/02_ARCHITECTURE_AND_TECH_STACK.md)
- [AI/BYOK design](docs/03_AI_ENGINE_AND_MULTI_MODEL_BYOK.md) and [ingestion design](docs/04_MULTIMODAL_INGESTION_PIPELINE.md)
- [Database schema and API contracts](docs/07_DATABASE_SCHEMA_AND_API_CONTRACTS.md)
- Implementation notes: [Phase 2](docs/PHASE_2_IMPLEMENTATION.md), [Phase 3](docs/PHASE_3_IMPLEMENTATION.md), [Phase 4](docs/PHASE_4_IMPLEMENTATION.md), [Phase 5](docs/PHASE_5_IMPLEMENTATION.md)
- [Phases 0–5 adversarial audit](docs/ADVERSARIAL_AUDIT_PHASES_0_5.md)
- [Phase 6 packaging verification](docs/PHASE_6_VERIFICATION.md)

The numbered design documents include future plans; the feature table above describes current behavior.
