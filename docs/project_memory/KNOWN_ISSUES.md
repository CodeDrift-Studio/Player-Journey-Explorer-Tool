# KNOWN_ISSUES.md

> Open bugs, technical debt, performance opportunities, potential refactors, and
> future enhancements. Remove items when resolved (note the fix in CHANGELOG.md);
> add items as they're discovered. Last updated: **2026-07-02**.

Status key: 🔴 open · 🟡 partial/mitigated · 🟢 resolved (kept briefly for history).

---

## Open bugs

- 🔴 **None currently known in shipped code.** The two ETL reconstruction bugs
  (day-boundary double-count; player split across files) were fixed before the ETL
  freeze — see CHANGELOG `[5a9d6bd]`.
- 🟢 **Rejected-promise cache poisoned recovery** (fixed, stabilization P0 #1) —
  `lib/data.ts` cached fetch promises unconditionally, so one failed match/aggregate
  load could never recover without a page refresh. Failures are now evicted from the
  cache and a **Retry** button (`dataStore.retry()` → `reloadNonce`) re-runs the load.
  **Watch-out:** any new cached-promise loader must evict on rejection the same way.
- 🟢 **Blank canvas under React StrictMode** (fixed) — stale `requestAnimationFrame`
  id on remount; RAF ref now reset in cleanup. Kept here as a **watch-out**: any new
  RAF/effect in `MapViewport.tsx` must clean up so a StrictMode remount reschedules.
- 🟢 **Canvas not sized on first paint** (fixed) — restored synchronous initial
  sizing instead of waiting for the async ResizeObserver callback.

## Technical debt

- 🟢 **Frontend work (M3–M8) uncommitted** (resolved) — all frontend + minimaps were
  committed in `1eb6b92`; `main` now reflects reality (ROADMAP M7 done).
- 🟡 **Frontend tests are minimal.** Vitest is set up with 20 tests for the pure
  playback logic (`lib/playback.ts`); `lib/viewport`, `lib/mapCoords`, `lib/format`, and
  `render/` geometry are still untested (ROADMAP M13).
- 🔴 **Two pre-existing ESLint errors** (surfaced during P0 #1, not introduced by it):
  `components/ui.tsx:15` (`react-refresh/only-export-components` — mixes a helper with
  component exports) and `hooks/useImage.ts:14` (`react-hooks/set-state-in-effect` —
  synchronous `setState` in an effect). `npm run build` is green; only `npm run lint`
  flags these. Fix in their own change; do not bundle.
- 🔴 **Contract kept in sync by hand** across `serialize.py` ↔ `contract.ts`. Relies
  on discipline; drift is possible. Consider schema-driven codegen if it ever bites (D9).
- 🟡 **Sidebar layer-toggle UI still missing** (ROADMAP M12, remaining half). The
  **statistics panel is done** (per-selection counts/duration/human-bot split +
  event breakdown, `StatsPanel.tsx`); the `paths/humans/bots/events` toggle control
  is not built yet (plumbing + scene support exist).
- 🟡 **Top-level `README.md` exists; `ARCHITECTURE.md` still absent.** The front door
  for humans is now `README.md` + this folder (ROADMAP M17 done). `ARCHITECTURE.md`
  remains optional. Note: `web/README.md` is still the default Vite template boilerplate.
- 🟢 **Git hygiene: stray commit + tracked local settings** (resolved) — a stray
  commit with a corrupted message (`ix(web):…`) that only committed
  `.claude/settings.local.json` was removed by rewriting the tip onto `c6d0090`
  (force-push). `.claude/settings.local.json` is now `.gitignore`d and untracked.

## Missing UI (state/plumbing exists, no controls)

- 🟡 **Layer toggles have no UI.** `filterStore.layers`
  (`paths/humans/bots/events`) + `toggleLayer` exist and `render/scene.ts` honors them
  **in match mode only**, but the sidebar only shows a `"Layers · Statistics — next"`
  placeholder, so layers are stuck at their defaults (all on). Wire the toggle UI
  (ROADMAP M12).
- 🟡 **Aggregate mode ignores the humans/bots toggles.** `drawAggEvents` in
  `render/scene.ts` renders all events regardless of `layers.humans/bots` (and the
  aggregate has no `isBot` flag), so the two view modes behave inconsistently
  (stabilization P0 #5 / ROADMAP M14). The aggregate heatmap is likewise all-actors.
- 🟢 **Event-marker hover tooltips — DONE** (2026-07-03, ROADMAP M10). `lib/hitTest.ts`
  + a cursor-following overlay show a hovered event's raw name/category/time/owner
  (zoom-aware, time-gated). **Player click-to-select + dim** (M10's other half) and path
  hover are still pending.
- 🟢 **Legend — DONE** (2026-07-03, ROADMAP M11). Context-aware viewport overlay
  (`Legend.tsx`) keyed off `palette.ts`: path colors + event glyphs in match view,
  heatmap intensity scale + glyphs in aggregate view.

## Performance opportunities

- 🟢 **Playback offscreen-canvas caching — measured unnecessary** (resolved). The
  assumption that full redraws wouldn't hit 60fps did not hold: profiling the heaviest
  match (Lockdown, 15 players / 1,174 points) in headless Chrome measured `renderScene`
  at 0.07 ms avg / 0.5 ms max — ≈33× under the 16.7 ms 60 fps budget. Caching was
  deferred (no perf commit). Revisit only if a future dense overlay changes the budget.
- 🟢 **Aggregate density heatmap — DONE** (2026-07-03, ROADMAP M15). Raw dots replaced
  by a binned+blurred Traffic/Kill/Death/Loot density field with a mode selector.
  Browser-measured redraw cost avg 2.3 ms / max 5.9 ms on the busiest aggregate
  (19,382 pts) — comfortably within the 60 fps budget, so no caching needed.
- 🟢 **Per-frame allocations in the render path — checked** (resolved for now). Playback
  landed and the measured per-frame cost is negligible; `render/scene.ts` does not build
  new arrays per frame. Revisit if the render budget tightens.

## Potential refactors

- 🟡 **Viewport view-state could move into a `useViewport` hook.** The transform
  math is already centralized in `lib/viewport.ts`, but the `{zoom,panX,panY}` view
  state + wheel/drag handlers live inline in `MapViewport.tsx`. Extracting a hook
  would make it reusable for hit-testing (M10) and testable in isolation. Optional —
  current design works and builds green.
- 🟡 **Selection state** may warrant its own store slice rather than overloading
  `filterStore` when hover/selection lands (M10).

## Data / correctness caveats (by design, not bugs)

- ℹ️ **`ts` is relative, not wall-clock** — playback time is per-match relative;
  dates come from the day folder (D5). Don't reintroduce `ts`-as-time assumptions.
- ℹ️ **Coordinates are unclamped** — off-map pixels are intentional signal (D7);
  rendering must tolerate out-of-range points.
- ℹ️ **February 14 is a known partial day** (fewer files); expected, not a bug.
- ℹ️ **Event markers fold bot combat** into kill/death (D4); the human/bot origin is
  only recoverable via `event.raw`.

## Future enhancements

- 🔵 **Aggregate `isBot`** → human-only heatmap toggle (ROADMAP M14, contract change).
- 🔵 **Colorblind-safe path encoding** — human/bot currently distinguished by
  blue/gray hue alone (ROADMAP M16).
- ✅ **Deployment** — DONE. Live on Hostinger at https://anantagupta.com/lila/
  (subdirectory `base: '/lila/'`, ROADMAP M17). No CI/CD yet — releases are a manual
  `npm run build` + upload of `web/dist/` (a possible future enhancement).
- 🔵 Possible: compare two matches/days side by side; export a view as an image.

(Tooltip/selection, legend, and the layer-toggle UI are tracked under
"Missing UI" above, not here, because their plumbing already exists in-repo.)
