# Project Summary — LILA BLACK Player Journey Visualization Tool

A web tool for **Level Designers** to analyze battle-royale player behavior from
production gameplay telemetry. Take-home for a **Product Engineer** role at LILA
Games. This document records everything built so far, in order.

---

## 1. Architecture decisions (locked up front)

| Decision | Choice | Rationale |
|---|---|---|
| Data/backend | **Static ETL, no server** | Data is tiny (~8 MB, 89k rows) and frozen (5 fixed days). A live backend would be over-engineering. |
| Frontend | **React 19 + TypeScript + Vite** | Assignment implies React; TS gives end-to-end type safety. |
| Rendering | **HTML5 Canvas 2D** | Thousands of points/paths + animation — DOM/SVG would choke. |
| State | **Zustand** | Tiny, selective subscriptions so 60fps playback won't re-render filters. |
| Styling | **Tailwind CSS v4** | Fast, dense, consistent instrument-style UI. |
| Event taxonomy | **Unified**: kill = Kill+BotKill · death = Killed+BotKilled · loot · storm | Human-vs-human combat is ~0; folding bot combat keeps markers meaningful. |
| Viewing scope | **Single match (playback) + map/date aggregate (overview)** | 743/796 matches are single-journey; aggregate is where heatmap value is. |
| Deploy target | **Static → Vercel** (Phase 7, not yet done) | One artifact, no server. |

**Repo layout:** `etl/` (Python pipeline) + `web/` (React app), separate toolchains.

---

## 2. Verified dataset facts

- **1,243** parquet files (`.nakama-0`), **89,104** rows, **796** matches, **339**
  unique players (**245** humans + **94** bots), 5 days (Feb 10–14, 2026).
- Maps: **AmbroseValley** 566 · **Lockdown** 171 · **GrandRift** 59 matches.
- Events: Loot 12,885 · BotKill 2,415 · BotKilled 700 · Storm 39 · Kill 3 · Killed 3.
- **`ts` is a relative sub-second ordering axis**, not wall-clock (a whole match
  spans <1s of `ts`). Match **date comes from the folder**.
- Coordinate formula verified against README (world `(-301.45,-355.55)` → px `(78,890)`).
- Most matches (743) have a single player journey; only ~53 have multiple players.

---

## 3. Phase 0 — Environment & data verification

- Node 22.18 (present); Python 3.13 venv with `pandas`, `pyarrow`, `pytest`.
- Fixed Windows **PowerShell execution policy** (`RemoteSigned`, CurrentUser) so `npm` runs.
- Wrote throwaway inspection scripts (since removed) that confirmed schema, byte
  decoding, human/bot detection, the coordinate example, the `ts` anomaly, and the
  files-per-match distribution — **de-risking before writing pipeline code**.

---

## 4. Phase 1 — ETL pipeline (FROZEN & verified)

Modules under `etl/src/` (each single-responsibility, pure logic split from I/O):

| Module | Role |
|---|---|
| `config.py` | Constants: paths, `MapConfig`, event taxonomy, `folder_to_date`, `is_bot`. |
| `coordinates.py` | Pure world→pixel projection (Y-flipped). |
| `reader.py` | One parquet file → typed `PlayerFile` (decode bytes, ms-safe timestamps, graceful skips). |
| `matches.py` | Group files by `match_id` (globally), rebase `ts` to a shared 0, project coords, split path vs events, **merge files sharing (match,user)**. |
| `serialize.py` | Domain → JSON (`manifest`, `matches/*`, `aggregate/*`); camelCase, compact `[ts,px,py]` tuples, matches ranked by richness. |
| `main.py` | Orchestrator: clean → load → serialize → **validate** → report. |
| `audit.py` | 10-point adversarial verification vs the raw parquet. |

- **26 unit tests** (pytest) covering coordinates, taxonomy, reader, matches, serialize.
- **Two bugs found & fixed during verification:**
  1. A match straddling a day boundary was reconstructed twice → **group globally**, date by earliest day.
  2. One player's journey split across two files → **merge by (match_id, user_id)**.
- **Full run:** 1,243 files → 796 matches → 89,104 rows in ~2.5 s, **4 MB** JSON out.
  Every README figure reconciles; **10/10 audit checks pass**.
- Docs: **`etl/ETL_FLOW.md`** (per-module I/O & transforms) and
  **`etl/ETL_VERIFICATION.md`** (stats, reconciliation, bugs, the 10-point audit).

### Output contract (the static "API")
- `manifest.json` — maps config, dates, match summaries (counts, duration), ranked.
- `matches/{matchId}.json` — players with `path:[[ts,px,py]]` + `events:[{t,cat,raw,px,py}]`.
- `aggregate/{mapId}_{date}.json` — flattened points/events for the overview.

### Assets
- `prepare_minimaps.py` downscaled/recompressed minimaps **24 MB → 1.5 MB**
  (1024×1024), output to `web/public/minimaps/`.

---

## 5. Phase 2 — Frontend (in progress)

### Scaffold & toolchain
- Vite + React 19 + TS 6; Tailwind v4 via `@tailwindcss/vite`; Zustand; ESLint.
- Dark, dense, instrument-style dashboard shell (header · sidebar · viewport · timeline region).

### Layers built (`web/src/`)
- **`types/contract.ts`** — TS mirror of the frozen JSON contract (source of truth).
- **`lib/`** — `data.ts` (fetch + promise cache), `viewport.ts` (fit transform, pixel↔screen), `mapCoords.ts` (pixel→world), `format.ts`.
- **`store/`** — `filterStore` (map/date/match/layers), `playbackStore` (time/speed), `dataStore` (manifest/match/aggregate/status).
- **`hooks/`** — `useManifest` (load + seed defaults), `useSelectedData` (load match/aggregate on selection), `useImage`.
- **`render/`** — `palette.ts` (shared color language), `scene.ts` (pure back-to-front canvas draw: minimap → grid → frame → paths → events / aggregate dots).
- **`components/`** — `App` shell, `Sidebar`, `MapFilter`/`DateFilter`/`MatchFilter`, `MapViewport` (HiDPI canvas, resize, redraw-on-demand), `ui` primitives.

### Features completed
1. **Sidebar + Filters + data loading** — segmented Map/Date pickers, searchable richness-ranked Match list ("All matches" aggregate pinned on top), lazy per-selection loading.
2. **Visualization** — minimap backdrop; **human (blue) vs bot (gray) paths**; event markers (**✕ kill · ✚ death · ◆ loot · ▲ storm**); aggregate density dots.
3. **Batch-1 production polish** (from the design review) — world-coordinate cursor readout; viewport loading/error states; manifest load gate; `size` from map config; focus-visible rings + ARIA; single-point-player dot.

### Frontend bugs found & fixed
- **Blank canvas** from a **stale `requestAnimationFrame` id under React StrictMode** — reset the ref in cleanup so a remount can reschedule.
- Restored **synchronous initial canvas sizing** (don't wait for the async ResizeObserver callback).

---

## 6. Version control

- `9118fa6` — scaffold project environment (ETL core + React/TS/Vite/Tailwind).
- `5a9d6bd` — freeze verified ETL pipeline.
- `1eb6b92` — project knowledge base **+ all frontend work (M2–M8: scaffold,
  filters, visualization, polish, zoom/pan) + optimized minimaps**. `main` reflects
  the full frontend from this commit on.
- `c6d0090` — stabilization P0 #1: recover from failed data loads (rejected-promise
  cache fix + Retry).

---

## 7. What remains (path to production)

Zoom + pan is **done** (committed `1eb6b92`). Remaining, in stabilization/delivery order:

| Priority | Item |
|---|---|
| **P0** | Deploy to Vercel (production build + verified hosted URL) |
| **P0** | Aggregate density **heatmap** (Kill/Death/Loot/Traffic) replacing raw dots |
| **P0** | Consistent humans/bots filtering in aggregate mode |
| **P0** | Timeline + playback (needs offscreen-canvas caching for 60fps) |
| **P0** | Viewport performance (cache static layers, cut per-frame allocations) |
| P1 | Statistics panel + layer-toggle UI (sidebar placeholders) |
| P1 | Legend · Hover tooltip + selection · Frontend tests (Vitest) for pure `lib/*` |
| P2 | Aggregate `isBot` (human-only heatmap), colorblind path encoding, a11y, CI |
| — | Write `ARCHITECTURE.md` + top-level `README.md` |

---

## 8. How to run

```bash
# ETL (regenerate JSON artifacts)
cd etl
.venv/Scripts/python.exe -m pytest -q          # 26 tests
.venv/Scripts/python.exe -m src.main           # writes web/public/data/*
.venv/Scripts/python.exe prepare_minimaps.py   # writes web/public/minimaps/*
.venv/Scripts/python.exe audit.py              # 10-point verification

# Frontend
cd web
npm run dev       # http://localhost:5173
npm run build     # typecheck + production build
```
