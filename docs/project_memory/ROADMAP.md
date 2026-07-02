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

---

## M9 — Timeline + playback  ·  Priority: **P0**  ·  Effort: L (3–5d)

- **Objective:** Scrub/play a single match over time, progressively revealing paths
  and firing event markers — the headline feature.
- **Files:** new timeline component under `components/` (App footer is currently a
  `"Timeline — playback milestone"` placeholder); `store/playbackStore.ts`
  (already scaffolded: `time`/`duration`/`isPlaying`/`speed` + actions;
  `useSelectedData` already sets `duration` on match load) wired to a play loop;
  `render/scene.ts` (add a time-bounded reveal — it currently draws whole paths);
  **offscreen-canvas caching** of static layers for 60fps.
- **Dependencies:** M8 done (shared viewport transform available); contract already
  sufficient (`path:[ts,...]`, `events:[{t,...}]`, `startTs`/`endTs`).
- **Acceptance:** play/pause/scrub/speed controls; paths reveal by `ts`; markers
  appear at their `t`; sustained ~60fps on the richest match; playback ticks do not
  re-render the filter UI (verify with React DevTools).

## M10 — Hover tooltip + selection  ·  Priority: **P1**  ·  Effort: M (1–2d)

- **Objective:** Hover a marker/path to see details (raw event name, player, time);
  click to select/highlight a player.
- **Files:** `components/MapViewport.tsx` (hit-testing in pixel space — it already
  does pixel↔screen via `screenToPixel` for the cursor readout); `lib/` (hit-test
  helper); tooltip UI in `components/ui.tsx`; `filterStore` or a new selection slice.
- **Dependencies:** M8 done — the zoom transform is available to account for in hit-testing.
- **Acceptance:** tooltip shows `raw`/category/time near the cursor; hit-testing
  accounts for the zoom transform; selecting a player dims the others.

## M11 — Legend  ·  Priority: **P1**  ·  Effort: S (0.5d)

- **Objective:** On-screen key for path colors and the four marker glyphs.
- **Files:** `components/` (legend), reads `render/palette.ts`.
- **Dependencies:** none (can precede M8).
- **Acceptance:** legend matches `palette.ts` exactly and updates if palette changes.

## M12 — Statistics panel + layer-toggle UI  ·  Priority: **P1**  ·  Effort: S–M (1d)

- **Objective:** Fill the sidebar placeholder (`"Layers · Statistics — next"`) —
  per-selection stats (counts, duration, human/bot split) and layer-toggle UI.
- **Note — most of the layer plumbing already exists:** `filterStore` has
  `layers: { paths, humans, bots, events, heatmap }` + a `toggleLayer` action, and
  `render/scene.ts` already honors `paths/humans/bots/events`. This milestone is
  primarily the **UI** to drive `toggleLayer`, plus the stats readout. (`heatmap`
  rendering itself is M15.)
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

## M15 — Heatmap layer  ·  Priority: **P2**  ·  Effort: M (2d)

- **Objective:** True density heatmap (binned/blurred) for the overview instead of
  raw dots.
- **Files:** `render/scene.ts` (density accumulation + colormap), `palette.ts`.
- **Dependencies:** benefits from M14.
- **Acceptance:** readable density gradient; performant on the densest map/day.

## M16 — Colorblind-safe path encoding  ·  Priority: **P2**  ·  Effort: S (0.5d)

- **Objective:** Distinguish human vs bot without relying on blue/gray hue alone.
- **Files:** `render/palette.ts`, `render/scene.ts` (add pattern/opacity/width cue).
- **Dependencies:** none.
- **Acceptance:** human/bot distinguishable in a grayscale/deuteranopia simulation.

## M17 — Deploy to Vercel + top-level docs  ·  Priority: **Ship**  ·  Status: **mostly done**

- **Objective:** Publicly hosted build; a proper front-door README + architecture doc.
- **Done (P0 #3, 2026-07-02):** top-level `README.md` written (run/build/deploy);
  ETL JSON committed so it ships as static assets; `index.html` title fixed;
  production build verified green + endpoints validated via `vite preview`. Deploy
  is static, Root Directory = `web`, no `vercel.json` needed.
- **Remaining:** the one-time authenticated **Vercel import** (cannot run headless)
  → record the live URL in README + PROJECT_STATE. Optional: `ARCHITECTURE.md`
  (the `docs/project_memory/` KB currently serves this role).
- **Acceptance:** live URL loads and fetches `/data` + `/minimaps` (validated locally;
  confirm on the hosted URL post-connect).

---

### Suggested sequence

M7 (commit) and M8 (zoom+pan) are done. Stabilization/delivery order now leads with
`M17` (deploy) and the heatmap/aggregate-filter work, then `M9` (timeline+playback —
the last core interaction) → `M10, M11, M12, M13` (P1 polish, parallelizable) →
`M14, M15, M16` (P2). M11 (legend) can be done anytime.
