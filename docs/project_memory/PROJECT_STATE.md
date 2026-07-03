# PROJECT_STATE.md

> Snapshot of the project *as it is right now*. Update this whenever a milestone
> completes. Last updated: **2026-07-02**.

---

## Current completion percentage

**~77%** of the intended production tool.

- **ETL pipeline: 100%** — complete, verified, frozen, committed.
- **Frontend: ~75%** — scaffold, data loading, filters, static visualization,
  polish, zoom/pan (all `1eb6b92`), the rejected-promise cache fix (`c6d0090`),
  **timeline playback** (`b647707`), the **aggregate density heatmap**
  (Traffic/Kill/Death/Loot, `fda6e65`), and now the **statistics panel** are done and
  building green. Core interactions + density overview + per-selection stats are
  complete. Remaining P1 polish: legend, tooltips/selection, layer-toggle UI, broader
  unit-test coverage.

---

## Completed milestones

- **M0 — Environment & data verification.** Node 22.18, Python 3.13 venv
  (`pandas`, `pyarrow`, `pytest`), Windows PowerShell execution policy fixed.
  Schema, byte decoding, human/bot detection, coordinate formula, `ts` anomaly,
  and files-per-match distribution all confirmed with throwaway scripts.
- **M1 — ETL pipeline (FROZEN).** Modular Python pipeline (`etl/src/*`), 26 unit
  tests, 10-point adversarial audit, full run 1,243 files → 796 matches →
  89,104 rows in ~2.5s producing ~4 MB of JSON. Two data-reconstruction bugs
  found and fixed. Documented in `etl/ETL_FLOW.md` + `etl/ETL_VERIFICATION.md`.
  Committed at `5a9d6bd`.
- **M2 — Minimap asset prep.** `etl/prepare_minimaps.py` recompressed minimaps
  24 MB → 1.5 MB (1024×1024) into `web/public/minimaps/`.
- **M3 — Frontend scaffold & layered architecture.** Vite + React 19 + TS 6 +
  Tailwind v4 + Zustand. Layers: `types/`, `lib/`, `store/`, `hooks/`, `render/`,
  `components/`. (Committed `1eb6b92`.)
- **M4 — Sidebar, filters & lazy data loading.** Segmented Map/Date pickers,
  searchable richness-ranked match list with "All matches" aggregate pinned,
  lazy per-selection loading. (Committed `1eb6b92`.)
- **M5 — Static visualization.** Canvas 2D scene: minimap backdrop, human (blue)
  vs bot (gray) paths, event markers (✕ kill · ✚ death · ◆ loot · ▲ storm),
  aggregate density dots. (Committed `1eb6b92`.)
- **M6 — Batch-1 production polish.** World-coordinate cursor readout, viewport
  loading/error states, manifest load gate, focus-visible/ARIA, single-point
  player rendering. Fixed StrictMode RAF blank-canvas bug + synchronous initial
  sizing. (Committed `1eb6b92`.)
- **M8 — Zoom + pan.** Wheel-zoom toward the cursor, drag-to-pan, pan/zoom
  clamping (`MIN_ZOOM=1`, `MAX_ZOOM=12`), zoom-% readout, and a Reset button.
  Transform math is centralized in `lib/viewport.ts` (`fitTransform`, `applyView`,
  `clampPan`, `screenToPixel`); `MapViewport.tsx` holds the `{zoom,panX,panY}`
  view state (implemented as local component state, **not** a `useViewport` hook).
  Verified working via `npm run build`. (Committed `1eb6b92`.)
- **M7 — Commit frontend to Git.** All frontend work (M3–M6, M8) + optimized
  minimaps committed in `1eb6b92`; `main` now reflects reality.
- **Stabilization P0 #1 — Rejected-promise cache fix.** Failed match/aggregate
  loads no longer poison the cache; a **Retry** button + `dataStore.retry()`
  recover without a page refresh. Committed `c6d0090`. See CHANGELOG.
- **P0 #3 — Deployment (LIVE).** Configured Vite `base: '/lila/'` for subdirectory
  hosting, replaced hardcoded `/data` + `/minimaps` with `import.meta.env.BASE_URL`,
  rebuilt, and deployed the static build to **Hostinger** at
  **https://anantagupta.com/lila/**. See "Current deployment status" and CHANGELOG.
- **M9 — Timeline + playback (P0, Phase A).** Committed `b647707`. Play/pause/scrub/
  0.5–4× speed, progressive path reveal with partial-segment interpolation + head dot,
  event reveal, auto-pause at end. Playback runs imperatively (rAF loop in
  `MapViewport`, pure logic in `lib/playback.ts` with 20 Vitest tests) so it never
  re-renders the map/filters — only the Timeline. Offscreen-canvas caching deferred as
  unnecessary after profiling (see CHANGELOG). See ROADMAP M9 for detail.
- **M15 — Aggregate density heatmap (P0, assignment).** Traffic/Kill/Death/Loot
  binned+blurred density replacing the raw dots, with a sidebar mode selector. Pure
  binning/blur/normalize in `lib/heatmap.ts` (7 Vitest tests); painted via an offscreen
  texel grid blitted scaled in `render/scene.ts`. Browser-verified on the busiest
  aggregate (19,382 pts): 4 modes distinct, redraw avg 2.3 ms / max 5.9 ms. See ROADMAP M15.
- **M12 (part) — Statistics panel (P1).** Per-selection stats in the sidebar
  (`components/StatsPanel.tsx`) from pure `lib/stats.ts` (6 Vitest tests): match view =
  players + human/bot split, duration, points, per-category event breakdown; aggregate =
  points + event breakdown. Browser-verified correct + updates on selection + no
  re-render during playback. Layer-toggle UI (M12's other half) still pending.

## Remaining milestones

See [ROADMAP.md](ROADMAP.md) for detail. Headline remaining items:

- **P0** ✅ Timeline + playback — done (`b647707`); offscreen caching deferred
  (profiled unnecessary).
- **P1** Hover tooltip + selection; legend; statistics panel + layer-toggle UI;
  broader frontend unit tests (Vitest already set up; playback logic covered).
- **P2** Aggregate `isBot` (human-only heatmap), heatmap layer, colorblind-safe
  path encoding.
- **Ship** ✅ Deployed to Hostinger at `/lila/` (2026-07-02); top-level `README.md`
  written. Optional remaining: `ARCHITECTURE.md`.

---

## Current architecture

Two independent toolchains in one repo, connected only by a **static JSON contract**:

```
player_data/  (raw, NOT committed, sibling of repo)
      │
      ▼   etl/  — Python ETL (offline, run on demand)
web/public/data/*.json   ← the "static API"
web/public/minimaps/*    ← optimized map images
      │
      ▼   web/  — React SPA (fetches JSON, renders to Canvas)
      browser
```

- **No backend / no server.** Data is tiny (~8 MB raw, 89k rows) and frozen
  (5 fixed days). The ETL output *is* the API.
- **Frontend layering (dependency direction downward):**
  `components/` → `hooks/` → `store/` (Zustand) + `lib/` (pure fns) + `render/`
  (pure canvas draw) → `types/contract.ts` (shared shape).

## Current tech stack

| Area | Choice | Version |
|---|---|---|
| ETL language | Python | 3.13 (venv) |
| ETL libs | pandas, pyarrow, pytest | — |
| Frontend framework | React | 19.2 |
| Language | TypeScript | ~6.0 |
| Build tool | Vite | 8.1 |
| Rendering | HTML5 Canvas 2D | — |
| State | Zustand | 5.0 |
| Styling | Tailwind CSS (via `@tailwindcss/vite`) | 4.3 |
| Lint | ESLint + typescript-eslint | 10 / 8.6 |
| Test | Vitest (pure-logic units) | 4.1 |
| Node | Node.js | 22.18 |
| Deploy target | Hostinger (static, `/lila/` subdirectory) | **live** |

## Important design decisions

(Full records in [DECISIONS.md](DECISIONS.md).)

1. Static ETL, no server — data is tiny and frozen.
2. Canvas 2D over SVG/DOM — thousands of points/paths + animation.
3. Zustand with selective subscriptions — keep 60fps playback from re-rendering filters.
4. Unified 4-category event taxonomy (kill/death/loot/storm) folding bot combat —
   human-vs-human combat is ~0.
5. Two viewing scopes: single-match playback + map/date aggregate overview.
6. `ts` treated as a relative in-match ordering axis; **match date comes from the
   day folder**, not `ts` (a whole match spans <1s of `ts`).
7. Coordinates are pre-projected to minimap pixel space in the ETL (Y-flipped);
   the frontend never redoes world→pixel math except for a cursor readout.

## Current JSON contract

Authoritative TS mirror: [`web/src/types/contract.ts`](../../web/src/types/contract.ts).
Produced by [`etl/src/serialize.py`](../../etl/src/serialize.py). Three artifact types:

- **`manifest.json`** — `{ maps: Record<MapId, MapConfig>, dates: string[], matches: MatchSummary[] }`.
  Loaded once; drives all filters. `matches` ranked by richness.
- **`matches/{matchId}.json`** — `Match { matchId, mapId, date, startTs, endTs,
  players: MatchPlayer[] }`. Each player has `path: [ts, px, py][]` and
  `events: { t, cat, raw, px, py }[]`.
- **`aggregate/{mapId}_{date}.json`** — `Aggregate { mapId, date, points: [px,py][],
  events: { cat, px, py }[] }`. Flattened for the overview heatmap.

Types: `MapId = 'AmbroseValley' | 'GrandRift' | 'Lockdown'`;
`EventCategory = 'kill' | 'death' | 'loot' | 'storm'`. Fields are camelCase; path
points are compact 3-tuples; coordinates are minimap pixels (0..1024, unclamped).

## Current deployment status

**LIVE.** (P0 #3 — deployment, completed 2026-07-02.)

- **Live URL:** **https://anantagupta.com/lila/** — hosted on **Hostinger** (static
  file hosting).
- **Platform:** Hostinger, static (no backend, no env vars). The production build
  (`web/dist`) is uploaded into the `lila/` directory under the domain's web root.
- **Subdirectory hosting (the key deploy fact):** the app is served from **`/lila/`,
  not the domain root**. `web/vite.config.ts` sets **`base: '/lila/'`**, so every
  emitted asset URL (JS/CSS/favicon in `index.html`) and every runtime data/minimap
  fetch is prefixed with `/lila/`. App code reads Vite's `import.meta.env.BASE_URL`
  (in `lib/data.ts` and `components/MapViewport.tsx`) instead of the old hardcoded
  `/data` and `/minimaps` root-relative paths.
- **Deploy date:** 2026-07-02.
- **Deploy method:** **manual upload** of the `web/dist/` build output to Hostinger
  (File Manager / SFTP) — there is no Git push-to-deploy or CI/CD. Release = rebuild
  (`npm run build`) then re-upload the `dist/` tree into `lila/`.
- **Verified 2026-07-02:** `npm run build` green, zero warnings; the built
  `index.html` references `/lila/assets/*`, `/lila/favicon.svg`; the bundle resolves
  data to `/lila/data` and minimaps to `/lila/minimaps`; the live site loads and
  fetches its data on Hostinger.
- **Deploy-specific considerations:**
  - The `/lila/` base is **baked into the build**. Serving from a different path (or
    the domain root) requires editing `base` in `vite.config.ts` and rebuilding — not
    just moving files.
  - The host must serve `lila/index.html` as the **SPA fallback** for unknown
    `/lila/*` routes.
  - A full release uploads the entire `dist/` tree into `lila/`: `index.html`,
    `assets/`, `data/` (`manifest.json` + 796 matches + 15 aggregates), `minimaps/`
    (3 images), `favicon.svg`.
- **Data shipping decision (unchanged):** the ETL JSON (`web/public/data/*`, ~5.9 MB,
  812 files) is **committed** (previously gitignored) so it ships as static assets and
  is copied into `dist/` at build time — the build runs no Python. Minimaps were
  already committed.

## Current branch assumptions

- Work happens on **`main`** (also the PR base). Frontend feature work so far is
  committed directly to `main`.
- Git user: `CodeDrift Studio`.
- Raw dataset (`../player_data`) is **not** committed and is `.gitignore`d.
- Generated artifacts under `web/public/data/` are produced by the ETL and are
  **`.gitignore`d (not committed)** — regenerate via the ETL, never hand-edit.
  ⚠️ Because they are untracked, a deploy must either commit them or generate them
  in the build (a P0 #3 / deployment decision). The minimaps **are** committed.

## Last verified working commit

- On `origin/main`: full frontend (M3–M8, `1eb6b92`) + P0 #1 fix (`c6d0090`) + timeline
  playback (M9, `b647707`) + subdirectory deploy (`a43d269`, live on Hostinger) +
  aggregate density heatmap (M15, `fda6e65`). The **statistics panel (M12 part)** is the
  newest change: `npm run build` green, **33/33 Vitest tests** pass, lint clean on
  changed files, browser-verified.
- ETL freeze reference point remains `5a9d6bd` (26 tests + 10/10 audit pass).
- Git history is linear and clean; `.claude/settings.local.json` (a local settings
  file) is now `.gitignore`d and no longer tracked.

## Known limitations

(Full list in [KNOWN_ISSUES.md](KNOWN_ISSUES.md).)

- Timeline playback (M9) is **done for single matches** but is intentionally scoped:
  playback runs on a synthetic wall-clock (a full match plays over ~8 s at 1× because
  raw telemetry spans <1 s); aggregate/overview mode has no timeline (controls disabled
  with a message). Layer toggles affect the canvas but not the playback stat counts.
- Layer visibility state (`paths/humans/bots/events`) exists in `filterStore` and
  `scene.ts` honors it, but there is **no toggle UI** yet (the statistics panel now
  fills the sidebar; a `"Layers — next"` note marks the remaining toggle control).
- No hover tooltip / marker hit-testing / player selection (only a world-coord
  cursor readout).
- Aggregate points carry no `isBot` flag, so the overview cannot yet filter to
  humans only.
- Frontend tests are minimal — Vitest is set up with 20 tests for the pure playback
  logic (`lib/playback.ts`); other pure modules (`viewport`, `mapCoords`, `format`) are
  not yet covered (ROADMAP M13).
- Path color (blue/gray) is not colorblind-safe.
- Aggregate mode ignores the humans/bots layer toggles (match mode honors them).

## Current priorities

Stabilization/delivery phase (see the P0 backlog). In order:

1. ✅ Correct documentation drift.
2. ✅ Deploy (production build + verified live URL) — **live on Hostinger at
   `/lila/`, 2026-07-02.**
3. ✅ **Timeline + playback** (the last core interaction) — done `b647707`;
   offscreen caching profiled and deferred as unnecessary.
4. ✅ **Aggregate density heatmap** (Traffic/Kill/Death/Loot) replacing raw dots —
   done 2026-07-03 (assignment requirement).
5. **P1 polish, in order:** ✅ statistics panel (done) → **legend (next)** →
   tooltips/selection → layer-toggle UI; broader Vitest coverage alongside.
6. Consistent **humans/bots filtering** in aggregate mode (P2).
