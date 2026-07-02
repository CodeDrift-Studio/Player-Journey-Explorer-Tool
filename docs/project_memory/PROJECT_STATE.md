# PROJECT_STATE.md

> Snapshot of the project *as it is right now*. Update this whenever a milestone
> completes. Last updated: **2026-07-02**.

---

## Current completion percentage

**~60%** of the intended production tool.

- **ETL pipeline: 100%** — complete, verified, frozen, committed.
- **Frontend: ~50%** — scaffold, data loading, filters, static visualization,
  polish, **and zoom/pan are done and working** (build verified green
  2026-07-02). The remaining headline interaction is **timeline playback**;
  tooltip/legend/stats-UI/tests/deploy are also outstanding.

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
  `components/`. (Uncommitted.)
- **M4 — Sidebar, filters & lazy data loading.** Segmented Map/Date pickers,
  searchable richness-ranked match list with "All matches" aggregate pinned,
  lazy per-selection loading. (Uncommitted.)
- **M5 — Static visualization.** Canvas 2D scene: minimap backdrop, human (blue)
  vs bot (gray) paths, event markers (✕ kill · ✚ death · ◆ loot · ▲ storm),
  aggregate density dots. (Uncommitted.)
- **M6 — Batch-1 production polish.** World-coordinate cursor readout, viewport
  loading/error states, manifest load gate, focus-visible/ARIA, single-point
  player rendering. Fixed StrictMode RAF blank-canvas bug + synchronous initial
  sizing. (Uncommitted.)
- **M8 — Zoom + pan.** Wheel-zoom toward the cursor, drag-to-pan, pan/zoom
  clamping (`MIN_ZOOM=1`, `MAX_ZOOM=12`), zoom-% readout, and a Reset button.
  Transform math is centralized in `lib/viewport.ts` (`fitTransform`, `applyView`,
  `clampPan`, `screenToPixel`); `MapViewport.tsx` holds the `{zoom,panX,panY}`
  view state (implemented as local component state, **not** a `useViewport` hook).
  Verified working via `npm run build`. (Uncommitted.)

## Remaining milestones

See [ROADMAP.md](ROADMAP.md) for detail. Headline remaining items:

- **P0** Timeline + playback (offscreen-canvas caching for 60fps).
- **P1** Hover tooltip + selection; legend; statistics panel + layer-toggle UI;
  frontend unit tests (Vitest) for pure `lib/*`.
- **P2** Aggregate `isBot` (human-only heatmap), heatmap layer, colorblind-safe
  path encoding.
- **Ship** Deploy to Vercel; write top-level `README.md` + `ARCHITECTURE.md`.

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
| Node | Node.js | 22.18 |
| Deploy target | Vercel (static) | not yet |

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

**Not deployed.** Target is Vercel as a single static artifact (`web/dist` after
`npm run build`). No CI/CD configured yet. No environment variables required (the
app fetches its own static JSON from `/data` and `/minimaps`).

## Current branch assumptions

- Work happens on **`main`** (also the PR base). Frontend feature work so far is
  committed directly to `main`.
- Git user: `CodeDrift Studio`.
- Raw dataset (`../player_data`) is **not** committed and is `.gitignore`d.
- Generated artifacts under `web/public/data/` are produced by the ETL; treat the
  ETL source as truth (regenerate rather than hand-edit).

## Last verified working commit

- **`5a9d6bd` — "feat(etl): freeze verified ETL pipeline"** is the last committed,
  fully-verified state (ETL: 26 tests + 10/10 audit pass).
- **All frontend work (M3–M6) is currently uncommitted** in the working tree.
  → Immediate action: commit the frontend before continuing (see [WORKFLOW.md](WORKFLOW.md)).

## Known limitations

(Full list in [KNOWN_ISSUES.md](KNOWN_ISSUES.md).)

- No timeline playback yet — the remaining core interaction. (`playbackStore` is
  scaffolded and `duration` is wired on match load, but there is no timeline UI,
  no play loop, and `scene.ts` does not yet render time-bounded.)
- Layer visibility state (`paths/humans/bots/events/heatmap`) exists in
  `filterStore` and `scene.ts` honors it, but there is **no toggle UI** (the
  sidebar shows a "Layers · Statistics — next" placeholder). The `heatmap` flag
  exists but nothing renders a heatmap yet.
- No hover tooltip / marker hit-testing / player selection (only a world-coord
  cursor readout).
- Aggregate points carry no `isBot` flag, so the overview cannot yet filter to
  humans only.
- No frontend tests.
- Path color (blue/gray) is not colorblind-safe.
- Frontend feature work is uncommitted (single point of loss risk).

## Current priorities

1. **Commit the uncommitted frontend work.**
2. **Timeline + playback** with offscreen-canvas caching — P0 (the last core interaction).
3. Tooltip/selection, legend, stats panel + layer-toggle UI — P1.
4. Frontend unit tests for `lib/*` (viewport math now stable) — P1.
5. Deploy to Vercel + write top-level `README.md`/`ARCHITECTURE.md`.
