# CHANGELOG.md

> Human-readable log of significant architectural and structural changes. Add a
> dated entry whenever a milestone completes or the architecture/structure shifts.
> Newest first. This is not a per-commit log — it records *meaningful* changes.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/). Dates are
ISO (YYYY-MM-DD). Not yet versioned/released (pre-1.0).

---

## [Unreleased]

### Added
- **`docs/project_memory/` knowledge base** (2026-07-02) — permanent, self-contained
  project memory so development can continue with any AI/human without prior chat
  history: `README.md`, `PROJECT_STATE.md`, `WORKFLOW.md`, `AI_CONTEXT.md`,
  `ROADMAP.md`, `CHANGELOG.md`, `DECISIONS.md`, `KNOWN_ISSUES.md`. Established the
  continuity rule: update the five state files on every milestone completion.

### Known
- Frontend work below (scaffold, filters, visualization, polish) is **committed to
  the working tree but not yet to git** as of this entry. Last committed state is
  `5a9d6bd` (ETL freeze).

---

## Frontend — Zoom + pan (uncommitted)
- Wheel-zoom **toward the cursor** (point under the pointer stays fixed) and
  drag-to-pan via pointer capture, in `components/MapViewport.tsx` (local
  `{zoom,panX,panY}` view state, reset on selection change).
- Transform math in `lib/viewport.ts`: `applyView` (compose zoom+pan over the fit),
  `clampPan` (map can't drift off-screen), `MIN_ZOOM=1`/`MAX_ZOOM=12`, `clamp`.
- Zoom-% readout + Reset button; drag/grab cursor affordance.
- Verified green via `npm run build` (2026-07-02). Still uncommitted to git.

## Frontend — Batch-1 production polish (uncommitted)
- World-coordinate cursor readout; viewport loading/error states; manifest load
  gate; map `size` sourced from config; focus-visible rings + ARIA; single-point
  player rendering.
- **Fix:** blank canvas from a stale `requestAnimationFrame` id under React
  StrictMode — RAF ref now reset in cleanup so a remount reschedules.
- **Fix:** restored synchronous initial canvas sizing instead of waiting for the
  async ResizeObserver callback.

## Frontend — Static visualization (uncommitted)
- `render/scene.ts` pure back-to-front Canvas draw: minimap → grid → frame → paths →
  event markers, plus aggregate density dots for the overview.
- Human (blue) vs bot (gray) paths; markers ✕ kill · ✚ death · ◆ loot · ▲ storm.
- `render/palette.ts` shared color language.

## Frontend — Sidebar, filters & lazy data loading (uncommitted)
- Segmented Map/Date pickers; searchable, richness-ranked match list with an
  "All matches" aggregate pinned on top; lazy per-selection loading.
- Stores: `filterStore`, `playbackStore`, `dataStore` (Zustand, selective selectors).
- Hooks: `useManifest` (load + seed defaults), `useSelectedData`, `useImage`.
- `lib/data.ts` fetch + promise cache; `lib/viewport.ts`, `lib/mapCoords.ts`,
  `lib/format.ts`.

## Frontend — Scaffold & layered architecture (uncommitted)
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
