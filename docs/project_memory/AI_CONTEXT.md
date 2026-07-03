# AI_CONTEXT.md

> **Read this first.** This file lets any AI assistant (or human) that has *never
> seen the original conversation* resume work immediately. It is deliberately
> self-contained. If anything here conflicts with a tool's private memory, **this
> file is authoritative.** Last updated: **2026-07-03**.

---

## 1. Project purpose

A web tool for **Level Designers** to analyze **battle-royale player behavior**
from production gameplay telemetry (LILA BLACK). It is a take-home for a **Product
Engineer** role at LILA Games. Level designers use it to see *where* players move,
*where* they loot, fight, die, and get caught by the storm — per single match
(playback) and aggregated per map/day (overview heatmap) — so they can reason about
map balance and flow.

## 2. Architecture

Two independent halves joined only by a **static JSON contract**. There is **no
backend and no live server** — the dataset is tiny (~8 MB raw, 89,104 rows) and
frozen (5 fixed days, Feb 10–14 2026), so the ETL output *is* the API.

```
player_data/ (raw parquet, NOT committed, sibling of the repo)
   │  etl/  — Python pipeline (offline, run on demand)
   ▼
web/public/data/*.json  +  web/public/minimaps/*   (static "API")
   │  web/  — React SPA fetches JSON, renders to HTML5 Canvas 2D
   ▼
browser  →  built with vite  →  web/dist  →  Hostinger (static, live at /lila/)
```

## 3. Folder structure

```
player-journey-tool/                 ← git repo root
├── docs/project_memory/             ← THIS knowledge base (source of truth)
│   ├── README.md  PROJECT_STATE.md  WORKFLOW.md  AI_CONTEXT.md
│   ├── ROADMAP.md  CHANGELOG.md  DECISIONS.md  KNOWN_ISSUES.md
├── etl/                             ← Python ETL (its own toolchain)
│   ├── src/  config.py coordinates.py reader.py matches.py serialize.py main.py
│   ├── tests/  (26 pytest tests)
│   ├── audit.py  conftest.py  prepare_minimaps.py
│   ├── ETL_FLOW.md  ETL_VERIFICATION.md
│   └── .venv/  (Python 3.13)
├── web/                             ← React app (its own toolchain)
│   ├── public/  data/*  minimaps/*  favicon.svg icons.svg
│   ├── src/
│   │   ├── types/contract.ts        ← TS mirror of the JSON contract
│   │   ├── lib/     data.ts viewport.ts mapCoords.ts format.ts
│   │   │             playback.ts heatmap.ts stats.ts hitTest.ts  (+ *.test.ts)
│   │   ├── store/   filterStore.ts playbackStore.ts dataStore.ts   (Zustand)
│   │   ├── hooks/   useManifest.ts useSelectedData.ts useImage.ts
│   │   ├── render/  palette.ts scene.ts                            (pure canvas draw)
│   │   ├── components/  App Sidebar MapViewport Timeline Legend
│   │   │             StatsPanel HeatmapControl ui filters/
│   │   ├── App.tsx main.tsx index.css
│   ├── package.json  vite.config.ts  tsconfig.*.json  eslint.config.js
├── PROJECT_SUMMARY.md               ← narrative build log (historical)
└── (raw data lives at ../player_data, gitignored)
```

## 4. Technology choices

Python 3.13 (pandas, pyarrow, pytest) for ETL. React 19 + TypeScript ~6 + Vite 8
for the app. Zustand 5 for state. Tailwind CSS 4 for styling. HTML5 Canvas 2D for
rendering. Node 22.18. See [DECISIONS.md](DECISIONS.md) for *why* each was chosen.

## 5. Coding conventions

- **TypeScript, strict.** No `any` in new code. The contract types in
  `types/contract.ts` are the source of truth for data shape.
- **Layered dependencies, one direction:** `components → hooks → store + lib + render → types`.
  `lib/` and `render/` are **pure** (no React, no store access inside draw
  functions). Components are thin.
- **camelCase** in JSON/TS; the ETL emits camelCase deliberately.
- **Python:** single-responsibility modules, pure logic separated from I/O, type
  hints, docstrings that explain *why*. Constants live in `config.py`.
- **Comments explain intent, not mechanics.** Match the density of surrounding code.
- **Commits:** Conventional-Commit style (`feat(scope):`, `fix:`, `chore:`, `docs:`).

## 6. State management (Zustand)

Three stores, subscribed with **selective selectors** so a 60fps playback tick
never re-renders the filter UI:

- **`filterStore`** — current map, date, selected match (or "All matches"
  aggregate), and layer toggles.
- **`playbackStore`** — playback time cursor and speed (drives the timeline).
- **`dataStore`** — loaded manifest, current match, current aggregate, and load status.

Data loads **lazily on selection** via hooks (`useManifest.ts` exports
`useManifestLoader`, which loads the manifest once and seeds default map/date from
the richest match; `useSelectedData` loads the match/aggregate for the current
selection and sets playback `duration`). `lib/data.ts` provides a fetch + promise
cache so the same artifact is fetched once.

## 7. Rendering pipeline

`render/scene.ts` is a **pure, back-to-front** Canvas 2D draw:
`minimap image → grid → frame → paths → event markers` (single match) or
`… → aggregate density dots` (overview). `render/palette.ts` holds the shared color
language. `components/MapViewport.tsx` owns the canvas: HiDPI scaling, resize via
ResizeObserver (with a synchronous initial size), **redraw-on-demand** coalesced
through a single `requestAnimationFrame`, and **interaction: wheel-zoom toward the
cursor + drag-to-pan** (local `{zoom,panX,panY}` state, clamped, with a zoom-%
readout and Reset button). The transform math lives in `lib/viewport.ts`
(`fitTransform` → `applyView` → `clampPan`; `pixelToScreen`/`screenToPixel`), so
draw and the pixel→world cursor readout share one transform. Colors: **human paths =
blue, bot paths = gray**; markers **✕ kill · ✚ death · ◆ loot · ▲ storm**.

> ⚠️ StrictMode caveat (already fixed, keep in mind): the RAF id ref must be reset
> in cleanup so a remount reschedules; otherwise the canvas stays blank.

## 8. JSON contract

Authoritative TS: [`web/src/types/contract.ts`](../../web/src/types/contract.ts);
producer: [`etl/src/serialize.py`](../../etl/src/serialize.py). Three artifacts:

- **`manifest.json`** — `{ maps: Record<MapId,MapConfig>, dates: string[], matches: MatchSummary[] }`;
  loaded once, drives filters, matches ranked by richness.
- **`matches/{matchId}.json`** — `Match{ matchId, mapId, date, startTs, endTs, players }`,
  each `MatchPlayer{ userId, isBot, path:[ts,px,py][], events:[{t,cat,raw,px,py}] }`.
- **`aggregate/{mapId}_{date}.json`** — `Aggregate{ mapId, date, points:[px,py][], events:[{cat,px,py}] }`.

`MapId = 'AmbroseValley' | 'GrandRift' | 'Lockdown'`;
`EventCategory = 'kill' | 'death' | 'loot' | 'storm'`. Coordinates are **minimap
pixels** (0..1024, unclamped). **Change the contract in both files together.**

## 9. Coordinate system

World `(x, z)` → minimap pixel via the README formula (in `etl/src/coordinates.py`):

```
u = (x - originX) / scale
v = (z - originZ) / scale
px = u * size
py = (1 - v) * size      # Y flipped: image origin is top-left
```

`size = 1024`. Per-map `scale`/`origin` live in `etl/src/config.py::MAPS`. The ETL
**pre-projects** all coordinates, so the frontend renders pixels directly and only
does the *inverse* (pixel→world) for the cursor readout (`lib/mapCoords.ts`). Points
are intentionally **not clamped** — off-map points are real signal. Verified example:
world `(-301.45, -355.55)` → px `(78, 890)`.

**Critical data fact:** the raw `ts` column is a **relative in-match ordering axis**,
not wall-clock — a whole match spans <1s of `ts`. The **match date comes from the day
folder** (`config.py::folder_to_date`). Per-match `ts` is rebased to a shared 0.

## 10. Performance goals

- **60 fps playback** with thousands of path points and event markers. This is why
  we chose Canvas over SVG/DOM and Zustand selective subscriptions over context.
- Offscreen-canvas caching of static layers was considered but **measured
  unnecessary** — profiling the heaviest match put `renderScene` at ~0.07 ms avg
  (≈33× under the 16.7 ms 60 fps budget), so full per-frame redraws are cheap enough.
  Revisit only if a future dense overlay tightens the budget.
- Keep JSON small: compact `[ts,px,py]` tuples, coords rounded to 1 decimal.

## 11. Current implementation status

**Core assignment complete and deployed.** ETL 100% (frozen, committed at `5a9d6bd`).
Frontend: scaffold, filters, lazy loading, per-match visualization, polish, zoom/pan,
**timeline playback** (`b647707`), **aggregate density heatmap** (`fda6e65`),
**statistics panel** (`8d00eb9`), **legend** (`fcf176a`), and **event-marker hover
tooltips** (`fe036f2`) are all done and building green. A stabilization pass fixed the
rejected-promise cache bug (`c6d0090`); deployment is live on Hostinger at `/lila/`.
See [PROJECT_STATE.md](PROJECT_STATE.md).

## 12. Remaining (optional polish)

The core tool is delivered. Optional P1/P2 items remain: the **layer-toggle UI**
(state + scene support already exist), **player click-to-select + dimming**, an
aggregate `isBot` flag for a **human-only heatmap** (contract change), **colorblind-safe
path encoding**, and **broader Vitest coverage** (playback/heatmap/hitTest/stats are
covered; `viewport`/`mapCoords`/`format` are not). Full breakdown in
[ROADMAP.md](ROADMAP.md).

## 13. Known issues

No open bugs in shipped code. Layer toggles have state/plumbing but **no UI**;
aggregate mode ignores the humans/bots toggles and points lack `isBot` (no
human-only heatmap yet); path colors are not colorblind-safe; two pre-existing
ESLint errors remain in `ui.tsx`/`useImage.ts` (`npm run build` is green; only
`npm run lint` flags them). Full list in [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

## 14. Development philosophy

- **De-risk before building.** The ETL was validated with throwaway inspection
  scripts and a 10-point audit before/while writing pipeline code. Prefer to verify
  assumptions against the real data, not guesses.
- **Pure logic is the testable core.** Keep math and transforms free of I/O and
  framework so they can be unit-tested and reasoned about.
- **Right-sized engineering.** No backend for frozen 8 MB data; no premature
  abstractions. Match the tool to the problem.
- **The repository is the memory.** Everything needed to continue lives in the repo
  (this folder especially). Do not depend on chat history or tool memory.

## 15. Repository conventions

- Work on `main`; base PRs on `main`. Conventional-Commit messages.
- `../player_data` is raw and gitignored; never commit it.
- `web/public/data/*` is ETL output — regenerate via `etl`, never hand-edit.
- Keep `contract.ts` and `serialize.py` in lockstep.
- Update the five continuity docs on every milestone (see WORKFLOW §7).

## 16. How new features should be added

Follow WORKFLOW §3 "Adding a feature": contract (if needed) → store → pure `lib/`
logic (+ test) → pure `render/` draw → thin component via hook → `lint` + `build`
green. Keep the layer boundaries intact; if a feature tempts you to reach across
layers, that's a signal to add a hook or a lib function instead.

## 17. How code reviews should be performed

- Confirm the **layer discipline** holds (no React/store access inside `lib/` or
  `render/` draw functions; components stay thin).
- Confirm the **contract invariant**: `serialize.py` and `contract.ts` changed
  together; ETL tests + audit still green.
- Check **performance**: does the change keep the render path cheap (no per-frame
  allocations, no full re-parse), especially near playback?
- Check **correctness of coordinates/time**: pixel space, Y-flip, `ts` rebasing.
- Confirm **docs continuity**: did the change update the five memory files if it
  completed a milestone?
- Prefer running the actual flow (`npm run dev`) for visual/interaction changes.

## 18. How documentation should be updated

On every milestone completion, update `PROJECT_STATE.md`, `ROADMAP.md`,
`CHANGELOG.md`, `KNOWN_ISSUES.md`, `DECISIONS.md` in the same change (WORKFLOW §7).
Keep this file (`AI_CONTEXT.md`) accurate whenever architecture, conventions, the
contract, or the pipeline change — it is the front door for the next assistant.
