# Multi-recipe compilation ingest

Implement chapter parsing and timed caption windows in the existing ingest pipeline. Preserve all chapter boundaries while filtering utility chapters from output. Normalize each dish separately, with chapter-local description text and timed captions, deep-linked source URLs, and a first-recipe compatibility alias. Untimed captions and shared description preambles never enter multi-recipe prompts.

The video route retains its existing top-level recipe fields and adds the complete envelope. SSE completion sends the same envelope; draft chunks continue to describe the first recipe. Single-recipe ingestion keeps its existing source and normalization behavior with additive `recipes`, `isMulti` and `count` fields.

Verify timestamp formats, utility filtering, XML seconds/milliseconds, half-open windows, AI prompt isolation, offline sections, missing timing, deep links, single-recipe behavior, video route and SSE completion. Run focused/full tests, typecheck and Jev before review and commit.

Verification (2026-10-01):

- Focused command `npx vitest run tests/multi-recipe-ingest.test.ts tests/ingest-url.test.ts`: 48 passed, including 23 new regression tests.
- `npm run test`: 62 files, 1,417 tests passed and one existing skip.
- `npx nuxi typecheck`: PASS.
- Production build: PASS with `DATABASE_URL="$PWD/.data/multi-ingest-build.db" npm run build`. The unconfigured build hit the existing prerender SQLite relative-path issue; verification used an isolated database inside this worktree.
- H3 integration tests verify video envelopes, SSE full completion, and no partial completion after a later provider failure. Android caption fallback retains timing. Missing chapter coverage produces an explicit warning.
- Adversarial diff review: no blocking findings. Recognition uses chapter-title heuristics rather than semantic classification; missing timed captions use only chapter-local description sections, and the offline fallback remains explicitly inferred. Shared description preambles are omitted to prevent ingredient contamination. External live YouTube availability was not required for deterministic verification.
- Jev assessment of the staged implementation diff: 9.00/10 (ordinal label 10).
