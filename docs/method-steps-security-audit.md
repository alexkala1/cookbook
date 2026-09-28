# Method parser regex audit

Scope: `shared/culinary/method-steps.ts`, `shared/culinary/durations.ts`.
Regression suite: `tests/method-steps-security.test.ts` (Vitest 4.1.11).

## Fixed: quadratic fraction normalization

`parseDurations` previously used `(\d+)?([½¼¾])`. On a digit run
without a Unicode fraction, the engine retried the remaining digits at
every starting position. A 10,000-digit input took approximately 330–356 ms
on the audit machine; `timedStep` also invokes this parser.

The added `(?<!\d)` guard permits only one starting position per digit run.
The same 10,000-digit probe took approximately 5.4 ms after the fix
(including cold regex compilation). Existing fractional syntax is preserved.

## Boundary and duration coverage

- Decimal quantities (`1.5 kg`) remain intact, including beside real and
  non-sequential step markers.
- `180 °C.` and `350 F.` end sentences; `tbsp.` and `approx.` retain their
  following text. Continuation sentences stay with their action.
- Durations cover ascending/descending ranges, decimal and Unicode/ASCII
  fractions, Greek accented/decomposed/capitalized units and range words,
  compound durations, negative/zero/oversized values, zero denominators,
  and unit-prefix false positives.
- Timer derivation, cooking-verb boundaries, and the 400-character cooking
  sentence limit have explicit assertions.

## Performance regression contract

Eleven exactly 10,000-character payloads exercise missing fractions, ranges,
units, long whitespace, numbering, abbreviation/continuation joins, heat
cues, and punctuation. Each runs all five public parsing helpers against
the real source in a child process. Individual calls must finish under
200 ms, excluding process startup, and the child has a five-second hard
timeout. A normal Vitest timeout cannot interrupt a blocked synchronous
regex. Child failures, invalid durations, and unexpected timers fail tests.

This is a bounded regression check, not a proof for arbitrary input sizes.
The duration matcher guards against starting inside digit runs; the ASCII
fraction patterns have word boundaries. Numbering has bounded digit counts,
and cooking/heat matching uses fixed alternatives without nested repetition.
Sentence merging still revisits accumulated text, and duration sign checks
scan prefixes; those paths can have superlinear total work on much larger
inputs. The 10,000-character truncation in `timedStep` applies to its returned
instruction, after parsing, so it is not an input processing limit.

## Verification

```sh
pnpm test tests/method-steps-security.test.ts
pnpm test
pnpm typecheck
pnpm build
```

The focused suite passed 65 tests; the full suite passed 719 tests across
37 files. Type checking and the production build passed. No UI code changed, so browser verification
is outside this audit's scope. There is no lint script in `package.json`.
