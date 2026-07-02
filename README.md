# LILA BLACK — Player Journey Explorer

A web tool for **level designers** to analyze battle-royale player behavior from
production gameplay telemetry: **where** players move, loot, fight, die, and get
caught by the storm — per single match and aggregated per map/day.

Built as a take-home for a **Product Engineer** role at LILA Games.

> **Live demo:** _deploying to Vercel — public URL pending (see [Deployment](#deployment))._

---

## What it does

- **Map picker · date picker · match list** — filter to a map + day, then either a
  single match or the whole-day **aggregate overview**. The match list is ranked by
  richness (players, then events) so the interesting matches surface first.
- **Canvas visualization** over the real minimap: human (blue) vs bot (gray) paths,
  and event markers — ✕ kill · ✚ death · ◆ loot · ▲ storm.
- **Zoom + pan** — wheel-zoom toward the cursor, drag-to-pan, clamped to the map,
  with a zoom-% readout and Reset.
- **World-coordinate readout** — the cursor reports the `(x, z)` world units level
  designers actually work in.

## Architecture

Two independent halves joined only by a **static JSON contract** — there is **no
backend**. The dataset is tiny (~8 MB raw, 89,104 rows) and frozen (5 fixed days),
so the ETL output *is* the API.

```
player_data/ (raw parquet, provided separately, not committed)
   │   etl/  — Python pipeline (offline, run on demand)
   ▼
web/public/data/*.json  +  web/public/minimaps/*   (static "API", committed)
   │   web/  — React SPA: fetches JSON, renders to HTML5 Canvas 2D
   ▼
browser  →  vite build → web/dist  →  Vercel (static hosting)
```

- **`etl/`** — Python 3.13 pipeline (pandas, pyarrow). Reads parquet, groups by
  match, rebases time, pre-projects world coords → minimap pixels, emits compact
  JSON. 26 pytest tests + a 10-point adversarial audit.
- **`web/`** — React 19 + TypeScript + Vite + Tailwind v4 + Zustand. Layered:
  `types → lib/render/store → hooks → components`. `lib/` and `render/` are pure.

Full detail lives in [`docs/project_memory/`](docs/project_memory/) (start with
[`AI_CONTEXT.md`](docs/project_memory/AI_CONTEXT.md)) and
[`etl/ETL_FLOW.md`](etl/ETL_FLOW.md).

## Run locally

**Frontend** (the committed JSON data lets it run without Python):

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

**Regenerate the data** (only if the raw parquet changes — output is committed):

```bash
cd etl
.venv/Scripts/python.exe -m pytest -q        # 26 tests
.venv/Scripts/python.exe -m src.main         # writes web/public/data/*
.venv/Scripts/python.exe prepare_minimaps.py # writes web/public/minimaps/*
.venv/Scripts/python.exe audit.py            # 10-point audit vs raw parquet
```

## Build

```bash
cd web
npm run build      # tsc -b (typecheck) + vite build → web/dist
npm run preview    # serve the production build locally
```

## Deployment

Static site on **Vercel**, no backend, no environment variables.

1. Import this repository into Vercel.
2. Set **Root Directory** to `web`. Vercel auto-detects Vite:
   build command `npm run build`, output directory `dist`.
3. Deploy. The build copies `web/public/data/*` and `web/public/minimaps/*` into
   `dist/`, served at `/data` and `/minimaps` — the app fetches them at runtime
   (same-origin, no CORS).

No `vercel.json` is required — setting Root Directory to `web` is sufficient.

## Project status

~60% of the intended production tool. ETL is complete and frozen; the frontend has
filters, static visualization, zoom/pan, and reliability hardening. Remaining P0
work: aggregate heatmap, consistent humans/bots filtering, and timeline playback.
See [`docs/project_memory/PROJECT_STATE.md`](docs/project_memory/PROJECT_STATE.md)
and [`ROADMAP.md`](docs/project_memory/ROADMAP.md).
