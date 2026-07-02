# CHANGELOG.md

> Human-readable log of significant architectural and structural changes. Add a
> dated entry whenever a milestone completes or the architecture/structure shifts.
> Newest first. This is not a per-commit log — it records *meaningful* changes.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/). Dates are
ISO (YYYY-MM-DD). Not yet versioned/released (pre-1.0).

---

## [Unreleased]

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
