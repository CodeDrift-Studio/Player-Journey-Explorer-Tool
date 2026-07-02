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
- 🟢 **Blank canvas under React StrictMode** (fixed) — stale `requestAnimationFrame`
  id on remount; RAF ref now reset in cleanup. Kept here as a **watch-out**: any new
  RAF/effect in `MapViewport.tsx` must clean up so a StrictMode remount reschedules.
- 🟢 **Canvas not sized on first paint** (fixed) — restored synchronous initial
  sizing instead of waiting for the async ResizeObserver callback.

## Technical debt

- 🔴 **Frontend work (M3–M6) is uncommitted.** Single point of loss; `main` does not
  reflect reality. → Commit before further work (ROADMAP M7).
- 🔴 **No frontend tests.** Pure `lib/*` and `render/` geometry are untested. → Vitest
  (ROADMAP M13).
- 🔴 **Contract kept in sync by hand** across `serialize.py` ↔ `contract.ts`. Relies
  on discipline; drift is possible. Consider schema-driven codegen if it ever bites (D9).
- 🟡 **Sidebar has placeholder UI** for the statistics panel and layer toggles — not
  yet functional (ROADMAP M12).
- 🔴 **No top-level `README.md` / `ARCHITECTURE.md`.** The front door for humans is
  currently `PROJECT_SUMMARY.md` + this folder (ROADMAP M17).

## Missing UI (state/plumbing exists, no controls)

- 🟡 **Layer toggles have no UI.** `filterStore.layers`
  (`paths/humans/bots/events/heatmap`) + `toggleLayer` exist and `render/scene.ts`
  honors `paths/humans/bots/events`, but the sidebar only shows a
  `"Layers · Statistics — next"` placeholder, so layers are stuck at their defaults
  (all on except `heatmap`). Wire the toggle UI (ROADMAP M12).
- 🟡 **`heatmap` layer flag renders nothing.** The flag exists (default off) but no
  heatmap draw path exists; the aggregate is drawn as faint dots (ROADMAP M15).
- 🟡 **No hover tooltip / marker hit-testing / player selection.** Only a
  world-coordinate cursor readout exists (ROADMAP M10).
- 🟡 **No legend.** `palette.ts` is the intended single source for it (ROADMAP M11).

## Performance opportunities

- 🔴 **Playback needs offscreen-canvas caching.** Redrawing all static layers
  (minimap/grid/full paths) every frame will not hit 60fps on the richest match.
  Cache static layers to an offscreen canvas and only redraw the moving reveal
  (ROADMAP M9). Note: `MapViewport` already coalesces redraws through a single rAF.
- 🟡 **Aggregate rendered as raw dots.** A binned/blurred density heatmap would be
  both clearer and cheaper on the densest map/day (ROADMAP M15).
- 🟡 **Watch per-frame allocations** in the render path once playback lands — avoid
  building new arrays/objects each frame.

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
- 🔵 **Vercel deployment** + CI (ROADMAP M17).
- 🔵 Possible: compare two matches/days side by side; export a view as an image.

(Tooltip/selection, legend, and the layer-toggle UI are tracked under
"Missing UI" above, not here, because their plumbing already exists in-repo.)
