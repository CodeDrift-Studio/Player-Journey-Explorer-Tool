# CHANGELOG.md

> Human-readable log of significant architectural and structural changes. Add a
> dated entry whenever a milestone completes or the architecture/structure shifts.
> Newest first. This is not a per-commit log — it records *meaningful* changes.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/). Dates are
ISO (YYYY-MM-DD). Not yet versioned/released (pre-1.0).

---

## [Unreleased]

### Added
- **Statistics panel — ROADMAP M12 (part)** (2026-07-03). Fills the sidebar's stats
  placeholder with per-selection numbers.
  - **`lib/stats.ts`** (new, pure, 6 Vitest tests) — `matchStats` (players + human/bot
    split, path points, duration, per-category event breakdown) and `aggregateStats`
    (points + event breakdown).
  - **`components/StatsPanel.tsx`** (new) — thin presenter reading `dataStore`; match
    view shows players/duration/points/events + a color-dotted category breakdown,
    aggregate view shows points + breakdown. Wired into `Sidebar.tsx`.
  - **Verified (headless Chrome):** numbers match the loaded match (15 players 1H·14B,
    1,174 pts, 42 events) and aggregate (4,723 pts, 345 events), update on selection,
    and the panel does **not** re-render during playback (it doesn't subscribe to the
    playback clock) — canvas isolation preserved. The layer-toggle UI (M12's other half)
    is still pending.
- **Aggregate density heatmap — ROADMAP M15** (2026-07-03). Replaces the overview's raw
  dots with a binned + blurred **Traffic / Kill / Death / Loot** density field over the
  minimap, selectable from a sidebar control. The assignment's density requirement.
  - **`lib/heatmap.ts`** (new, pure) — mode→points selection (movement for Traffic;
    event positions by category otherwise); pixel-space density-grid binning with
    edge-clamping (coords are unclamped by design); separable [1,2,1] box blur;
    max-normalization. 7 Vitest tests.
  - **`render/palette.ts`** — per-mode base colors (reusing the path/event hues) +
    `heatColor(mode,t)` ramp (faint tint → white-hot, alpha `t^0.6`).
  - **`render/scene.ts`** — `drawHeatmap` paints one texel per bin into a small offscreen
    canvas, then blits it scaled + smoothed over the map rect (aligned to the same
    `pixelToScreen` transform, so it follows zoom/pan). Replaces `drawAggPoints`.
  - **`store/filterStore.ts`** — removed the dead `heatmap` layer flag; added
    `heatmapMode` + `setHeatmapMode`.
  - **`components/HeatmapControl.tsx`** (new) — sidebar mode selector + low→high intensity
    scale, shown only in aggregate view.
  - **Verified (headless Chrome):** on the busiest aggregate (AmbroseValley 2026-02-10,
    19,382 points) all four modes render distinctly, the selector updates the field,
    zoom/pan works, and **heatmap redraw cost is avg 2.3 ms / max 5.9 ms** — within the
    60 fps budget, so no offscreen caching of the density field is needed. No regression
    to match rendering or playback (MapViewport still 0 re-renders during playback).
- **Timeline + playback — ROADMAP M9, Phase A** (2026-07-02, committed `b647707`). The
  headline single-match interaction: play/pause, scrub, 0.5/1/2/4× speed, progressive
  path reveal, and event reveal over time.
  - **`lib/playback.ts`** (new) — pure, unit-tested logic: `clampTime`; `playbackRate`/
    `advanceTime` mapping wall-clock to telemetry time (a full match plays over ~8 s at
    1×, because raw telemetry spans <1 s — median 382 ms, max 890 ms — so real-time would
    be an imperceptible blink); `revealedIndex` (binary search); `pathHead`
    (partial-segment interpolation so the head moves smoothly between samples);
    extensible `computePlaybackStats`.
  - **`render/scene.ts`** — time-bounded reveal: paths draw up to the interpolated head
    (with a head dot), events appear at their `t`. `time === null` preserves the exact
    prior whole-match rendering, so aggregate/overview is unchanged.
  - **`components/Timeline.tsx`** (new) — always-visible footer with the controls, a time
    readout, and visible/total player + event stats; disabled with an explanatory message
    in aggregate view ("Playback available for individual matches only.").
  - **`MapViewport.tsx` / `playbackStore.ts`** — an imperative rAF play loop advances the
    playhead and drives the canvas via the `sceneRef` mirror + a store subscription, so
    time advancing ~60×/s never re-renders React. The store clamps time, restarts from 0
    when Play is pressed at the end, and auto-pauses at the end without rewinding.
  - **Tooling:** added **Vitest** (20 tests for the pure playback logic) + `test` /
    `test:watch` scripts; test files excluded from the production `tsc` build.
  - **Performance — measured, not assumed (headless Chrome, production build).** On the
    heaviest match (Lockdown, 15 players / 1,174 points / 42 events): `renderScene` cost
    **0.07 ms avg, 0.1 ms p50, 0.2 ms p95, 0.5 ms max** — ≈33× under the 16.7 ms 60 fps
    budget; worst single frame interval 17 ms (one startup blip), p95 5.7 ms. During
    playback, **MapViewport and Sidebar re-rendered 0 times** while only the Timeline
    re-rendered (~1/frame) — the intended UI/canvas isolation. **Decision: offscreen-canvas
    caching is NOT needed** (the perf(canvas) commit was planned but is unnecessary);
    revisit only if a future dense overlay changes the per-frame budget.

### Deployment
- **Went LIVE on Hostinger under a `/lila/` subdirectory** (2026-07-02, stabilization
  P0 #3 — completes deployment). Live URL: **https://anantagupta.com/lila/**.
  - **Target changed from Vercel → Hostinger static hosting.** The build is uploaded
    manually into the `lila/` directory under the domain web root (no Git
    push-to-deploy / CI/CD); release = `npm run build` then re-upload `dist/`.
  - **Subdirectory hosting:** set **`base: '/lila/'`** in `web/vite.config.ts` so
    Vite prefixes every emitted asset URL with `/lila/`.
  - **Path audit + fix (no logic change):** replaced the hardcoded root-relative
    `/data` (`lib/data.ts`) and `/minimaps` (`components/MapViewport.tsx`) with
    Vite's **`import.meta.env.BASE_URL`**, so data and minimap fetches resolve under
    `/lila/` (or any future base) instead of 404-ing at the domain root. `index.html`
    asset/favicon URLs are rewritten by Vite automatically from `base`.
  - **Verified:** `npm run build` green (zero warnings); built `index.html` points at
    `/lila/assets/*` and `/lila/favicon.svg`; bundle resolves `/lila/data` +
    `/lila/minimaps`; live site loads and fetches its data on Hostinger.
  - **Deploy considerations:** the `/lila/` base is baked into the build (changing the
    path requires editing `base` + rebuilding); the host must serve `lila/index.html`
    as the SPA fallback for `/lila/*` routes.
- **Made the app deploy-ready for Vercel (static)** (2026-07-02, stabilization P0 #3).
  *(Superseded by the Hostinger go-live above — retained as history. Original
  Vercel-oriented readiness notes below.)*
  - **Committed the ETL JSON** (`web/public/data/*`, ~5.9 MB, 812 files) — previously
    gitignored. The dataset is frozen and there is no backend, so the JSON ships as
    static assets; the Vercel build does not run Python.
  - Wrote the top-level **`README.md`** (purpose, architecture, run/build/deploy).
  - Fixed the placeholder `index.html` `<title>` → "LILA BLACK — Player Journey
    Explorer"; added a description meta.
  - **Verified:** `npm run build` green, zero warnings; `vite preview` served `/`,
    `manifest.json`, a match, an aggregate, minimaps, favicon — all HTTP 200, correct
    content-types, same-origin (no CORS).
  - **Config:** static deploy, Root Directory = `web`, Vite auto-detected, no
    `vercel.json`. Domain-root paths (`/data`, `/minimaps`). No env vars.
  - **Pending:** the one-time authenticated Vercel import (not runnable headless) →
    record the live URL in README + PROJECT_STATE once connected.

### Fixed
- **Rejected-promise cache bug** (2026-07-02, stabilization P0 #1) — `lib/data.ts`
  cached the fetch *promise* unconditionally, so a single failed `loadMatch`/
  `loadAggregate` poisoned the cache: every later attempt replayed the same
  rejection and the view could only recover via a full page reload. Now failures
  are **evicted** from the cache (`.catch` deletes the key and re-throws), and a
  `dataStore.retry()` (bumping `reloadNonce`, consumed by `useSelectedData`) drives
  a **Retry** button in the viewport error overlay — failed requests recover with
  no refresh. Concurrent in-flight de-dupe is preserved.
  - **Verification (no frontend test runner yet — manual note):** `npm run build`
    green (0 TS errors) and `npm run lint` clean for the changed files. The real
    compiled `data.ts` was driven through a `fetch` mock (fail-once-then-succeed)
    with 8 passing assertions: (1) failed load rejects; (2) retry after failure
    succeeds and actually re-fetches; (3) repeated success returns the identical
    cached promise with zero new network calls; (3c) concurrent calls de-dupe to
    one fetch; (4) aggregate shares the same eviction fix; (5) manifest path
    unchanged. Re-runnable via the harness in stabilization notes. A permanent
    Vitest suite lands with ROADMAP M13 (P1) rather than adding a runner here.

### Added
- **`docs/project_memory/` knowledge base** (2026-07-02) — permanent, self-contained
  project memory so development can continue with any AI/human without prior chat
  history: `README.md`, `PROJECT_STATE.md`, `WORKFLOW.md`, `AI_CONTEXT.md`,
  `ROADMAP.md`, `CHANGELOG.md`, `DECISIONS.md`, `KNOWN_ISSUES.md`. Established the
  continuity rule: update the five state files on every milestone completion.

### Note
- All frontend work below (scaffold, filters, visualization, polish, zoom/pan) was
  **committed in `1eb6b92`** alongside this knowledge base. The section headers
  below are retained as a historical build log; each is now in Git.

---

## Frontend — Zoom + pan (committed `1eb6b92`)
- Wheel-zoom **toward the cursor** (point under the pointer stays fixed) and
  drag-to-pan via pointer capture, in `components/MapViewport.tsx` (local
  `{zoom,panX,panY}` view state, reset on selection change).
- Transform math in `lib/viewport.ts`: `applyView` (compose zoom+pan over the fit),
  `clampPan` (map can't drift off-screen), `MIN_ZOOM=1`/`MAX_ZOOM=12`, `clamp`.
- Zoom-% readout + Reset button; drag/grab cursor affordance.
- Verified green via `npm run build` (2026-07-02). Committed in `1eb6b92`.

## Frontend — Batch-1 production polish (committed `1eb6b92`)
- World-coordinate cursor readout; viewport loading/error states; manifest load
  gate; map `size` sourced from config; focus-visible rings + ARIA; single-point
  player rendering.
- **Fix:** blank canvas from a stale `requestAnimationFrame` id under React
  StrictMode — RAF ref now reset in cleanup so a remount reschedules.
- **Fix:** restored synchronous initial canvas sizing instead of waiting for the
  async ResizeObserver callback.

## Frontend — Static visualization (committed `1eb6b92`)
- `render/scene.ts` pure back-to-front Canvas draw: minimap → grid → frame → paths →
  event markers, plus aggregate density dots for the overview.
- Human (blue) vs bot (gray) paths; markers ✕ kill · ✚ death · ◆ loot · ▲ storm.
- `render/palette.ts` shared color language.

## Frontend — Sidebar, filters & lazy data loading (committed `1eb6b92`)
- Segmented Map/Date pickers; searchable, richness-ranked match list with an
  "All matches" aggregate pinned on top; lazy per-selection loading.
- Stores: `filterStore`, `playbackStore`, `dataStore` (Zustand, selective selectors).
- Hooks: `useManifest` (load + seed defaults), `useSelectedData`, `useImage`.
- `lib/data.ts` fetch + promise cache; `lib/viewport.ts`, `lib/mapCoords.ts`,
  `lib/format.ts`.

## Frontend — Scaffold & layered architecture (committed `1eb6b92`)
- Vite + React 19 + TypeScript 6 + Tailwind v4 (`@tailwindcss/vite`) + Zustand +
  ESLint. Dark, dense, instrument-style dashboard shell.
- `types/contract.ts` — TS mirror of the frozen JSON contract.

## [5a9d6bd] — ETL pipeline frozen & verified (committed)
### Added
- Modular Python ETL under `etl/src/` (`config`, `coordinates`, `reader`, `matches`,
  `serialize`, `main`) + `audit.py` (10-point adversarial audit).
- 26 pytest unit tests. `etl/ETL_FLOW.md` and `etl/ETL_VERIFICATION.md` docs.
- Static JSON contract: `manifest.json`, `matches/{id}.json`,
  `aggregate/{map}_{date}.json`. Coordinates pre-projected to minimap pixels.
- `prepare_minimaps.py` — minimaps recompressed 24 MB → 1.5 MB (1024×1024).
### Fixed
- Match straddling a day boundary reconstructed twice → **group by `match_id`
  globally**, date by earliest day.
- One player's journey split across two files → **merge by (match_id, user_id)**.
### Verified
- Full run: 1,243 files → 796 matches → 89,104 rows in ~2.5s, ~4 MB JSON out.
  Every README figure reconciles; 10/10 audit checks pass.

## [9118fa6] — Project environment scaffold (committed)
### Added
- Repo layout: `etl/` (Python) + `web/` (React/TS/Vite/Tailwind), separate
  toolchains. Python 3.13 venv; Node 22.18. Windows PowerShell execution policy
  set to `RemoteSigned` (CurrentUser) so `npm` runs.
