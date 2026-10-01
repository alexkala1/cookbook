# CI and Docker hardening

Goal: reproducible GitHub checks and turnkey non-root SQLite persistence on `ops/ci-and-docker`.

- Add the requested master push/PR workflow, frozen pnpm 11.22.0 install, Node 24 cache, quality checks, dependent Docker build, read-only permissions and bounded jobs.
- Replace the host bind with a project-scoped named volume inheriting UID/GID 1000 and mode 0700 from the image. Preserve loopback publishing, dropped capabilities, startup migrations and the database-backed port-3000 healthcheck.
- Document port/origin defaults and preserve the existing exact-host / same-origin policy while accepting an HTTP(S) origin configuration.
- Update startup, backup and migration instructions; existing bind-directory data requires explicit migration and is never silently deleted.
- Validate YAML and Compose, run all tests/typecheck/build, and exercise a fresh isolated Compose project, SQLite write/restart persistence and healthcheck before review, Jev assessment and commit.

Verification (2026-10-01):

- PyYAML syntax parse and assertions for both master triggers and the Docker job dependency: PASS. Node YAML probes failed because that transitive parser was unavailable; no dependency changes were needed.
- `docker compose config --quiet`: PASS.
- `npm run test`: 61 files, 1,394 tests passed, one existing skip.
- `npx nuxi typecheck`: PASS.
- `docker build -t heirloom:ci .`: PASS, including frozen pnpm installation, native SQLite rebuild and the production Nuxt build.
- Isolated Compose project `heirloom-ci-smoke`, port 3198: fresh named volume inherits UID 1000 and mode 0700; non-root SQLite writes and restart persistence PASS. HTTP kitchen endpoint and container health status PASS. Test containers/network/volume removed afterward.
- Final adversarial review: no blocking findings. Existing bind-mount data requires explicit migration; named volume deletion and host-only origin semantics are documented. GitHub-hosted execution remains to be observed after push; no deploy or publication step was requested.
- Jev assessment of the staged implementation diff: 8.98/10 (ordinal label 10).
