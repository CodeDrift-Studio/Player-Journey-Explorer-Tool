# WORKFLOW.md

> The complete development workflow for this project. If you are new (human or AI),
> read [AI_CONTEXT.md](AI_CONTEXT.md) first, then this. Last updated: **2026-07-02**.

---

## 1. Overall project lifecycle

```
raw parquet (player_data/, not committed)
        │  [ETL — Python, run on demand, offline]
        ▼
web/public/data/*.json   +   web/public/minimaps/*   (the static "API")
        │  [Frontend — React SPA, fetches JSON]
        ▼
Canvas 2D visualization in the browser
        │  [Build — tsc + vite]
        ▼
web/dist/  →  [Deploy — Vercel static hosting]
```

The ETL and the frontend are **separate toolchains** that only meet at the JSON
contract (`web/src/types/contract.ts` mirrors `etl/src/serialize.py`). You can work
on one without the other, as long as the contract holds.

**Golden rule:** the contract is the boundary. Change it in *both* places in the
same commit (Python serializer + TS types), and record the change in
[CHANGELOG.md](CHANGELOG.md) and [DECISIONS.md](DECISIONS.md) if structural.

---

## 2. ETL workflow

Location: `etl/`. Python 3.13 venv at `etl/.venv`.

**When to run:** only when the raw data changes or you change a transform/contract.
The output JSON is otherwise stable and already present in `web/public/data/`.

```bash
cd etl
.venv/Scripts/python.exe -m pytest -q          # 26 unit tests — must pass
.venv/Scripts/python.exe -m src.main           # regenerate web/public/data/*
.venv/Scripts/python.exe prepare_minimaps.py   # regenerate web/public/minimaps/*
.venv/Scripts/python.exe audit.py              # 10-point adversarial audit vs raw parquet
```

**Module map** (single-responsibility; pure logic split from I/O — see
`etl/ETL_FLOW.md` for per-module I/O):

| Module | Role |
|---|---|
| `config.py` | Paths, `MapConfig`, event taxonomy, `folder_to_date`, `is_bot`. |
| `coordinates.py` | Pure world→pixel projection (Y-flipped, unclamped). |
| `reader.py` | One parquet file → typed `PlayerFile`. |
| `matches.py` | Group files by `match_id` globally, rebase `ts`, project coords, split path vs events, **merge files sharing (match, user)**. |
| `serialize.py` | Domain → JSON (manifest, matches/*, aggregate/*). |
| `main.py` | Orchestrator: clean → load → serialize → validate → report. |
| `audit.py` | 10-point verification vs raw parquet. |

**Definition of done for an ETL change:** all 26 tests pass, `audit.py` reports
10/10, every README figure still reconciles, and `contract.ts` is updated to match.

---

## 3. Frontend workflow

Location: `web/`. Node 22.18.

```bash
cd web
npm install       # first time only
npm run dev       # http://localhost:5173 — HMR dev server
npm run lint      # ESLint
npm run build     # tsc -b (typecheck) + vite build → web/dist
npm run preview   # serve the production build locally
```

**Where things live (`web/src/`):**

| Layer | Responsibility | Rule |
|---|---|---|
| `types/contract.ts` | Shape of the JSON API. | Single source of truth for data shape. Never diverge from `serialize.py`. |
| `lib/` | Pure helpers: `data.ts` (fetch+cache), `viewport.ts`, `mapCoords.ts`, `format.ts`. | No React, no side effects beyond `data.ts`'s fetch cache. Unit-testable. |
| `store/` | Zustand stores: `filterStore`, `playbackStore`, `dataStore`. | State only. Use selective selectors so playback ticks don't re-render filters. |
| `hooks/` | `useManifest`, `useSelectedData`, `useImage`. | Bridge stores ↔ effects (loading data on selection). |
| `render/` | `palette.ts`, `scene.ts`. | **Pure** back-to-front canvas draw functions. No React, no store access inside draw. |
| `components/` | `App`, `Sidebar`, filters, `MapViewport`, `ui`. | Thin; read stores via hooks, delegate drawing to `render/`. |

**Adding a feature (standard path):**
1. If it needs new data, extend the contract first (ETL + `contract.ts`).
2. Add/extend state in the relevant Zustand store.
3. Add pure logic in `lib/` (and a Vitest test for it once tests exist).
4. Add drawing in `render/scene.ts` (keep it pure — inputs in, pixels out).
5. Wire it into a component via a hook. Keep components thin.
6. `npm run lint && npm run build` must pass.

---

## 4. Build workflow

- `npm run build` runs `tsc -b` (type-checks the whole project via project
  references in `tsconfig.*.json`) then `vite build` → static output in `web/dist`.
- A green build = typecheck clean + bundle produced. Treat TS errors as build
  failures, not warnings.
- The ETL has no "build" step; it *is* the build for the data half. Its artifacts
  are checked into `web/public/data/` so the frontend can build without Python.

---

## 5. Testing workflow

- **ETL:** `pytest` (26 tests) + `audit.py` (10-point adversarial audit). This is
  the trusted layer — keep it green before touching data logic.
- **Frontend:** **no tests yet.** Planned: Vitest for pure `lib/*` (`viewport`,
  `mapCoords`, `format`) and `render/` geometry. Add Vitest as the first testing
  milestone (see [ROADMAP.md](ROADMAP.md)).
- **Manual verification:** for visual/interaction work, run `npm run dev`, drive
  the actual flow (select a map/date/match, exercise zoom/playback), and confirm
  behavior — don't rely on typecheck alone.

---

## 6. Deployment workflow

- **Target:** Vercel, static. Project root for the build is `web/`;
  build command `npm run build`; output `web/dist`.
- **Assets:** `web/public/data/*` and `web/public/minimaps/*` are served as static
  files under `/data` and `/minimaps`. Ensure they are committed/regenerated before
  deploy (the frontend fetches them at runtime).
- **No env vars, no secrets, no backend.** A push-to-deploy Vercel project is
  sufficient. Not yet configured — this is a remaining milestone.

---

## 7. Documentation workflow (continuity — IMPORTANT)

This repository is meant to be self-documenting. **Whenever a milestone completes,
update these five files in the same change:**

1. **PROJECT_STATE.md** — bump completion %, move the milestone from "remaining"
   to "completed", refresh priorities and last-verified commit.
2. **ROADMAP.md** — mark the milestone done; re-prioritize what's next.
3. **CHANGELOG.md** — add a dated entry for the structural/architectural change.
4. **KNOWN_ISSUES.md** — remove fixed issues; add any new debt/bugs discovered.
5. **DECISIONS.md** — record any new engineering decision (with alternatives + trade-offs).

Also update `web/src/types/contract.ts` **and** `etl/src/serialize.py` together on
any data-shape change, and keep `etl/ETL_FLOW.md` / `etl/ETL_VERIFICATION.md`
accurate when ETL logic changes.

---

## 8. How a new developer should continue

1. Read [AI_CONTEXT.md](AI_CONTEXT.md) then [PROJECT_STATE.md](PROJECT_STATE.md).
2. Install: `cd web && npm install` (frontend); `etl/.venv` already exists for ETL.
3. **Commit the currently-uncommitted frontend work** (M3–M6) so `main` reflects reality.
4. Pick the top P0 from [ROADMAP.md](ROADMAP.md) — currently **zoom + pan**.
5. Follow the "Adding a feature" path in §3.
6. On completion, run the documentation continuity step in §7 and commit.

**Version control conventions:** small, focused commits; Conventional-Commit-style
messages (`feat(scope):`, `fix(scope):`, `chore:`, `docs:`); work on `main`; only
regenerate `web/public/data/*` via the ETL, never hand-edit it.
