# Phase 3: Kitchen Mode

The recipe reader now lives at `app/pages/recipes/[id]/index.vue`, retaining `/recipes/:id`; `/recipes/:id/cook` is its sibling cooking page, so Nuxt does not render the reader around Kitchen Mode. Use **Start cooking** from the reader.

## Cooking controls

- One ordered step at a time, 32–48 px instruction text, progress indicator, sensory milestones, thermometer target, and ingredient references. Ingredients are matched by words in the instruction; when no match exists, the full ingredient list is explicitly labeled as a reference rather than claiming an exact association.
- ArrowLeft goes back; ArrowRight and Space advance. Text fields and rescue dialogs do not trigger navigation; focused buttons retain native Space activation.
- VueUse screen wake lock is requested on mount, with supported/inactive/active status, manual release, and cleanup. Browser capability UI waits until mount to avoid SSR hydration mismatches. Wake lock depends on browser/device policy.
- Numeric seconds/minutes/hours, compound durations, fractions, and upper bounds of time ranges produce timer buttons. Step duration metadata is the fallback. Up to 20 named concurrent timers support pause/resume/reset/remove. Deadlines account for delayed ticks; a three-note Web Audio oscillator chime and persistent banner signal completion.
- Timers and audio contexts are local to the cooking page and stop on exit. Background browser restrictions may delay alerts; this limitation is shown beside the timers.

## Local gesture detection

Camera use requires an explicit toggle. A mirrored 96×72 canvas samples local motion around 15 times per second; sustained horizontal centroid displacement triggers left → next or right → previous. Minimum displacement, directional consistency, exposure-change rejection, and a cooldown reduce accidental navigation. This is motion detection, not hand identification or MediaPipe inference. Moving backgrounds and poor lighting can affect recognition.

Frames are never serialized, persisted, uploaded, or sent to AI. Tracks are stopped on toggle-off, hidden document, rescue opening, camera failure, and component unmount. Permission requests resolving after exit also release their tracks. Buttons and keyboard remain available when camera access is denied or unsupported.

## Rescue API and instant guides

`POST /api/ai/rescue` accepts:

```json
{
  "issueDescription": "My sauce split",
  "recipeContext": "Hollandaise, gently warmed",
  "currentStep": 3
}
```

`issueDescription` is required (3–3000 characters), `recipeContext` defaults to an empty string, and `currentStep` is optional (1–500). Response: `{ title, actions, science, caution, mode }`. Existing request-header-only BYOK, Host/Origin protection, validation, and provider error sanitization apply. No key uses deterministic offline triage; a failed live call returns a sanitized error while the drawer keeps its local advice visible.

The drawer’s quick guides work without a network request: emulsions, salt, scorching, soggy searing, acidity, spice, bitterness, sweetness, and unknown problems. They distinguish flavor correction from food safety, debunk selective potato salt removal, and prohibit mixing a scorched bottom back into food.

## Oven and burner adjustments

The saved kitchen profile determines the target oven and burner guidance. Source instructions mentioning fan/convection select that source mode; otherwise the visible default is conventional and can be changed. Temperature adjustment uses the requested −20 °C or −25 °F heuristic for conventional → fan, with the reverse offset for fan → conventional. These are culinary heuristics, not equivalent unit conversions.

Alternatively, time is multiplied by 0.8 toward fan, or divided by 0.8 toward conventional. Temperature and time reductions are never applied together. Multiple durations require selecting which interval is oven cooking time; unrelated timers remain unchanged. Probe/internal/reaches-temperature cues are excluded from oven settings, and stored food-safety targets remain unchanged. Disable duplicate automatic conversion on ovens that already adjust settings.

Burner advice describes gas response, induction’s rapid pan heating, and radiant-element thermal inertia; it does not invent a universal numeric power-level equivalence.

## References

- [VueUse wake lock](https://vueuse.org/core/useWakeLock/)
- [Exploratorium: hollandaise and emulsions](https://annex.exploratorium.edu/cooking/eggs/hollandaise-pop.html)
- [GE: adapting recipes for convection](https://products.geappliances.com/appliance/gea-support-search-content?contentId=18176)
- [USDA: leftovers and food safety](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety)
