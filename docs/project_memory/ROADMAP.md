# ROADMAP.md

> Remaining work as milestones. Update when a milestone completes (mark it done,
> re-prioritize). Effort is rough dev-time. Last updated: **2026-07-02**.

Priority key: **P0** = core, blocks a usable tool · **P1** = important polish ·
**P2** = nice-to-have / stretch · **Ship** = release tasks.

---

## ✅ Completed

- **M0 — Environment & data verification.** Done.
- **M1 — ETL pipeline (frozen, verified, committed `5a9d6bd`).** Done.
- **M2 — Minimap asset optimization.** Done (committed `1eb6b92`).
- **M3 — Frontend scaffold & layered architecture.** Done (committed `1eb6b92`).
- **M4 — Sidebar, filters & lazy data loading.** Done (committed `1eb6b92`).
- **M5 — Static Canvas visualization.** Done (committed `1eb6b92`).
- **M6 — Batch-1 production polish.** Done (committed `1eb6b92`).
- **M7 — Commit outstanding frontend work.** Done — all frontend (M3–M6, M8) +
  minimaps committed in `1eb6b92`; `git status` clean; `npm run build` green.
- **M8 — Zoom + pan.** Done (committed `1eb6b92`). Wheel-zoom toward the cursor,
  drag-to-pan, pan/zoom clamping (`MIN_ZOOM=1`, `MAX_ZOOM=12`), zoom-% readout,
  Reset button. Transform math centralized in `lib/viewport.ts`; view state
  (`{zoom,panX,panY}`) lives as local state in `MapViewport.tsx` — implemented
  **without** a dedicated `useViewport` hook (a hook was originally planned but the
  centralized `lib/viewport.ts` math made it unnecessary). Verified via `npm run build`.
- **Stabilization P0 #1 — Rejected-promise cache fix.** Done (committed `c6d0090`).
  Cache evicts on failure; Retry button recovers without refresh.
- **M17 — Deploy (P0 #3).** Done — **LIVE on Hostinger at https://anantagupta.com/lila/**
  (2026-07-02). Configured `base: '/lila/'` for subdirectory hosting; replaced
  hardcoded `/data` + `/minimaps` with `import.meta.env.BASE_URL`; rebuilt and
  uploaded the static `dist/` to Hostinger. See below for detail.
- **M9 — Timeline + playback (P0).** Done (Phase A, committed `b647707`, 2026-07-02).
  Play/pause/scrub/0.5–4× speed, progressive path reveal with partial-segment
  interpolation + head dot, event reveal, auto-pause at end (no rewind), always-visible
  timeline (disabled in aggregate). Imperative rAF play loop keeps playback off React
  (measured: 0 MapViewport/Sidebar re-renders during playback). 20 Vitest tests on the
  pure logic. **Offscreen-canvas caching deferred** — profiling the heaviest match
  (15 players, 1,174 points) showed `renderScene` at 0.07 ms avg / 0.5 ms max vs the
  16.7 ms 60 fps budget, so caching is unnecessary (no Commit 2). See below for detail.
- **M15 — Aggregate density heatmap (P0, assignment).** Done (2026-07-03).
  Traffic/Kill/Death/Loot binned+blurred density replacing the raw dots, with a sidebar
  mode selector. 7 Vitest tests; browser-verified on the busiest aggregate. See below.

---

## M9 — Timeline + playback  ·  Priority: **P0**  ·  Status: ✅ **DONE (Phase A)**

- **Objective:** Scrub/play a single match over time, progressively revealing paths
  and firing event markers — the headline feature.
- **Delivered (committed `b647707`):**
  - `lib/playback.ts` — pure logic: `clampTime`, `playbackRate`/`advanceTime`
    (wall-clock↔telemetry mapping; a full match plays over ~8 s at 1× since raw
    telemetry spans <1 s), `revealedIndex` (binary search), `pathHead` (partial-segment
    interpolation), extensible `computePlaybackStats`. 20 Vitest tests.
  - `render/scene.ts` — time-bounded reveal: paths draw to the interpolated head with a
    head dot; events appear at their `t`. `time === null` keeps the old whole-match draw
    (aggregate unchanged).
  - `components/Timeline.tsx` — always-visible footer: play/pause, scrubber, 0.5/1/2/4×
    speed, time readout, visible/total player+event stats; disabled with a message in
    aggregate view.
  - `MapViewport.tsx` — imperative play loop + playback subscription drive the canvas via
    rAF/`sceneRef`; `playbackStore` clamps time, restarts from 0 on play-at-end, and
    auto-pauses at the end without rewinding.
- **Acceptance — met:** play/pause/scrub/speed all work; paths reveal by `ts`, markers by
  `t`; **measured** on the heaviest match (Lockdown, 15 players / 1,174 points / 42
  events): `renderScene` 0.07 ms avg, 0.5 ms max (≈33× under the 16.7 ms 60 fps budget);
  during playback **MapViewport and Sidebar re-render 0 times** while only Timeline
  re-renders (~1/frame) — the intended UI/render isolation.
- **Deferred:** offscreen-canvas caching — the measurements show it is unnecessary; revisit
  only if future work (e.g. a dense heatmap overlay during playback) changes the budget.

## M10 — Hover tooltip + selection  ·  Priority: **P1**  ·  Effort: M (1–2d)

- **Objective:** Hover a marker/path to see details (raw event name, player, time);
  click to select/highlight a player.
- **Files:** `components/MapViewport.tsx` (hit-testing in pixel space — it already
  does pixel↔screen via `screenToPixel` for the cursor readout); `lib/` (hit-test
  helper); tooltip UI in `components/ui.tsx`; `filterStore` or a new selection slice.
- **Dependencies:** M8 done — the zoom transform is available to account for in hit-testing.
- **Acceptance:** tooltip shows `raw`/category/time near the cursor; hit-testing
  accounts for the zoom transform; selecting a player dims the others.

## M11 — Legend  ·  Priority: **P1**  ·  Status: ✅ **DONE**

- **Objective:** On-screen key for path colors and the four marker glyphs.
- **Delivered (2026-07-03):** `components/Legend.tsx` — a context-aware overlay top-right
  of the viewport. Match view: path colors (Human/Bot) + the 4 event glyphs (SVGs
  mirroring `scene.ts` drawMarker); aggregate view: the active heatmap mode's intensity
  scale + the event glyphs. Reads `render/palette.ts` (COLORS/HEATMAP_BASE) so it can't
  drift from the canvas; `pointer-events:none` so it never blocks map interaction;
  subscribes only to `filterStore`, so it doesn't re-render during playback.
- **Acceptance — met (browser-verified):** correct entries per view mode, updates when
  the heatmap mode changes, colors sourced from `palette.ts`, no re-render during
  playback, doesn't obstruct the canvas.

## M12 — Statistics panel + layer-toggle UI  ·  Priority: **P1**  ·  Status: ✅ **Stats DONE; layer-toggle UI remaining**

- **Objective:** Fill the sidebar placeholder (`"Layers · Statistics — next"`) —
  per-selection stats (counts, duration, human/bot split) and layer-toggle UI.
- **Done (2026-07-03):** the **statistics panel** — `lib/stats.ts` (pure `matchStats`/
  `aggregateStats`, 6 Vitest tests) + `components/StatsPanel.tsx` in the sidebar. Match
  view shows players + human/bot split, duration, points, and a per-category event
  breakdown; aggregate view shows points + event breakdown. Browser-verified: numbers
  match the selection, update on change, and the panel does **not** re-render during
  playback (no canvas coupling).
- **Remaining:** the **layer-toggle UI** to drive `filterStore.toggleLayer`
  (`paths/humans/bots/events`) — plumbing + `render/scene.ts` support already exist;
  this is just the control (sidebar now shows a `"Layers — next"` note).
- **Files:** `components/Sidebar.tsx`, new toggle component in `components/`; read
  `dataStore` / `filterStore`; `lib/format.ts` for display formatting.
- **Dependencies:** none (state + scene support already in place).
- **Acceptance:** stats reflect the current match/aggregate; toggles flip
  `filterStore.layers` and show/hide the corresponding scene layer live.

## M13 — Frontend unit tests (Vitest)  ·  Priority: **P1**  ·  Effort: M (1–2d)

- **Objective:** Cover the pure logic that must be correct.
- **Files:** add Vitest to `web`; tests for `lib/viewport.ts` (`fitTransform`,
  `applyView`, `clampPan`, `screenToPixel`), `lib/mapCoords.ts`, `lib/format.ts`.
- **Dependencies:** none — viewport math (M8) is already stable and pure, so this
  can start now.
- **Acceptance:** `npm run test` runs in CI-friendly mode; pixel↔screen and
  pixel→world round-trip tests pass; coordinate Y-flip verified.

## M14 — Aggregate `isBot` + human-only heatmap  ·  Priority: **P2**  ·  Effort: M (1–2d)

- **Objective:** Let the overview filter to human players only.
- **Files:** `etl/src/serialize.py` (add `isBot` to aggregate points — **contract
  change**), `web/src/types/contract.ts`, `render/scene.ts`, filter UI. Re-run ETL.
- **Dependencies:** contract change → ETL tests + audit must stay green.
- **Acceptance:** aggregate points carry `isBot`; a toggle renders humans-only;
  contract updated in both files; ETL re-run and audited.

## M15 — Aggregate density heatmap  ·  Priority: **P0 (assignment)**  ·  Status: ✅ **DONE**

- **Objective:** True density heatmap (binned/blurred) for the overview instead of raw
  dots — the assignment's "Kill/Death/Loot/Traffic" density requirement.
- **Delivered (2026-07-03):**
  - `lib/heatmap.ts` — pure, tested: mode→points selection, pixel-space density-grid
    binning (edge-clamped for unclamped coords), separable [1,2,1] box blur, max-normalize.
  - `render/palette.ts` — per-mode base colors + `heatColor(mode,t)` ramp (faint tint →
    white-hot, α = t^0.6).
  - `render/scene.ts` — `drawHeatmap` paints one texel per bin into an offscreen canvas,
    blits it scaled+smoothed over the map rect (replaces the old `drawAggPoints` dots).
  - `store/filterStore.ts` — dead `heatmap` layer flag removed; `heatmapMode`
    (Traffic/Kill/Death/Loot) + `setHeatmapMode` added.
  - `components/HeatmapControl.tsx` — sidebar mode selector + low→high scale (aggregate only).
- **Acceptance — met (browser-verified on the busiest aggregate, AmbroseValley 2026-02-10,
  19,382 pts):** 4 modes render distinctly; selector updates the field; readable gradient;
  redraw cost avg 2.3 ms / max 5.9 ms during pan/zoom (well under the 60 fps budget); no
  regression to match/playback. 7 Vitest tests on the pure logic.

## M16 — Colorblind-safe path encoding  ·  Priority: **P2**  ·  Effort: S (0.5d)

- **Objective:** Distinguish human vs bot without relying on blue/gray hue alone.
- **Files:** `render/palette.ts`, `render/scene.ts` (add pattern/opacity/width cue).
- **Dependencies:** none.
- **Acceptance:** human/bot distinguishable in a grayscale/deuteranopia simulation.

## M17 — Deploy + top-level docs  ·  Priority: **Ship**  ·  Status: ✅ **DONE (live)**

- **Objective:** Publicly hosted build; a proper front-door README + architecture doc.
- **Live:** **https://anantagupta.com/lila/** — static hosting on **Hostinger**,
  served from the **`/lila/` subdirectory** (2026-07-02).
- **Done:** top-level `README.md` written (run/build/deploy); ETL JSON committed so it
  ships as static assets; `index.html` title fixed; **`base: '/lila/'` set in
  `vite.config.ts`** for subdirectory hosting; hardcoded `/data` + `/minimaps`
  replaced with **`import.meta.env.BASE_URL`** (`lib/data.ts`, `MapViewport.tsx`);
  production build verified green (built HTML → `/lila/assets/*`, bundle → `/lila/data`
  + `/lila/minimaps`); `dist/` uploaded to Hostinger and the live site confirmed
  loading + fetching its data.
- **Target changed:** originally scoped for Vercel; shipped on Hostinger (manual
  `dist/` upload, no CI/CD). See PROJECT_STATE → "Current deployment status" and
  WORKFLOW §6 for the release procedure and deploy considerations.
- **Optional remaining:** `ARCHITECTURE.md` (the `docs/project_memory/` KB currently
  serves this role).
- **Acceptance:** ✅ live URL loads and fetches `/lila/data` + `/lila/minimaps`.

---

### Suggested sequence

M7 (commit), M8 (zoom+pan), **M17 (deploy)**, **M9 (playback)**, and **M15 (heatmap)**
are done, and **M12's statistics panel** shipped (its layer-toggle UI remains). The
core interactions + density overview + stats are complete. Next in the P1 polish tier:
✅ `M11` (legend, done) → **`M10` (tooltip/selection, next)** → `M13` (Vitest coverage),
plus the M12 layer-toggle UI; then `M14, M16` (P2).
