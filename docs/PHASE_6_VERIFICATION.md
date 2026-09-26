# Phase 6 — self-hosted Docker packaging

Verified 2026-09-26 on Linux amd64 with Docker Engine 29.8.1 and Compose 5.5.1.

## Implementation

- `Dockerfile`: Node 24 Bookworm slim build and runner stages; pinned pnpm 11.22.0 and frozen lockfile; native SQLite build prerequisites only in the build stage. Explicit native dependency rebuild and Nuxt prepare precede the production build.
- Runner: Nitro `.output` and its generated production dependency manifest, committed migrations, non-root `node` user (UID/GID 1000), `/app/data` volume, and a database-backed HTTP healthcheck.
- Entrypoint: apply committed Drizzle migrations, close the migration connection, then `exec` Nitro. Startup fails if the database cannot be opened or migrated. Direct local development retains explicit migrations.
- Compose: bind `./data`, loopback host port 3000 (overridable with `HEIRLOOM_PORT`), init process, bounded logs, restart policy, dropped capabilities, and no-new-privileges. Missing bind directories are rejected rather than created with unsuitable ownership.
- `.dockerignore`: excludes local dependencies/build output, Git metadata, environment files, databases, data directories, logs, and backup archives. `.gitignore` now excludes the data directory and documented backup names.
- README: current Phases 0–5 feature inventory, Docker setup, ownership, migrations, backup/update/restore guidance, and explicit proxy/Ollama/authentication limitations.

## Results

| Check | Result |
|---|---|
| `docker compose build` | Pass; production Nuxt/Nitro build and native SQLite dependency included |
| Compose startup with fresh `./data` | Pass; all committed migrations applied and container became healthy |
| `docker exec cookbook-heirloom-1 id` | `uid=1000(node) gid=1000(node)` |
| Runtime isolation | No application Git directory, `.env`, root-level local database, pnpm executable, or C++ compiler |
| API recipe create/read with nested ingredients and steps | Pass; HTTP 201 and rendered recipe |
| Force-recreate container against existing data | Pass; migrations reran idempotently, recipe and ingredient survived |
| Invalid database location (`/proc/heirloom.db`) | Expected exit 1 before serving; SQLite open failure propagated |
| Cross-origin mutation and unlisted Host | Both rejected with HTTP 403 |
| `pnpm test` | 528 tests in 29 files pass |
| `pnpm run typecheck` | Pass; zero errors |
| `git diff --check` | Pass |
| Chromium desktop 1280×900 | Recipe page rendered from container |
| Chromium mobile 375×812 | Kitchen Mode rendered; Start Timer transitioned to running; no horizontal overflow |
| Browser console on checked pages | Zero warnings/errors |

Host port 3000 was already occupied by another process. Verification used `HEIRLOOM_PORT=3107`; the existing process was left alone. The repository's original `heirloom.db` was not used. A new ignored `data/heirloom.db` was initialized for container verification.

## Reproduce the container checks

After preparing data ownership as described in the README:

```sh
export HEIRLOOM_PORT=3107
docker compose build
docker compose up -d --wait --wait-timeout 60
docker compose ps
docker compose logs --tail=30
docker compose exec heirloom id
docker compose up -d --force-recreate --wait --wait-timeout 60
```

Temporary evidence: `/tmp/heirloom-phase6-build.log`, `/tmp/heirloom-phase6-final-build.log`, `/tmp/heirloom-phase6-tests.log`, `/tmp/heirloom-phase6-typecheck.log`, `/tmp/heirloom-phase6-invalid-volume.log`, `/tmp/heirloom-phase6-desktop.png`, and `/tmp/heirloom-phase6-mobile.png`.

## Final review and boundaries

Reviewed startup ordering, dependency resolution in the trimmed Nitro runtime, native ABI compatibility, signal forwarding, file permissions, database persistence, failure propagation, build-context exclusions, healthcheck behavior, and README claims. No unresolved blocker found in the packaging change.

The base image is a maintained Node 24 tag, not a digest pin. Rebuild with `--pull` for upstream updates and retain versioned images alongside backups. Only Linux amd64 was executed; ARM, Docker Desktop filesystem mapping, physical camera/audio hardware, live AI providers, and reverse-proxy deployment were not verified. Health checks do not automatically restart unhealthy-but-running containers. Existing application limitations remain: no authentication, no trusted TLS-proxy origin policy, and Ollama's fixed loopback address refers to the container in this setup.
