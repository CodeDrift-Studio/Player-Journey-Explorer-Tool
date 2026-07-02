# LILA BLACK — Player Journey Explorer

A web tool for **level designers** to analyze battle-royale player behavior from
production gameplay telemetry: **where** players move, loot, fight, die, and get
caught by the storm — per single match and aggregated per map/day.

Built as a take-home for a **Product Engineer** role at LILA Games.

> **Live demo:** **https://anantagupta.com/lila/** (static, hosted on Hostinger — see [Deployment](#deployment)).

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
browser  →  vite build → web/dist  →  Hostinger (static, served under /lila/)
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

Live at **https://anantagupta.com/lila/** — a static site on **Hostinger**, no
backend, no environment variables. It is served from the **`/lila/` subdirectory**,
not the domain root.

**Subdirectory base path.** Because the app is hosted under `/lila/`, `web/vite.config.ts`
sets:

```ts
export default defineConfig({
  base: '/lila/',
  // ...
})
```

`base` prefixes every emitted asset URL (JS/CSS/favicon in `index.html`) with `/lila/`.
The app's runtime fetches use Vite's **`import.meta.env.BASE_URL`** (in
[`web/src/lib/data.ts`](web/src/lib/data.ts) for `/data` and
[`web/src/components/MapViewport.tsx`](web/src/components/MapViewport.tsx) for
`/minimaps`) rather than hardcoded root-relative paths, so both resolve correctly
under the subdirectory.

**Release steps:**

1. Build: `cd web && npm run build` → produces `web/dist/`.
2. Upload the **entire contents of `web/dist/`** into the `lila/` directory under the
   domain's web root on Hostinger (File Manager or SFTP): `index.html`, `assets/`,
   `data/` (`manifest.json` + matches + aggregates), `minimaps/`, `favicon.svg`.
3. Ensure the host serves `lila/index.html` as the SPA fallback for `/lila/*` routes.

**Notes / considerations:**

- The `/lila/` base is **baked into the build** — to host at a different path (or the
  domain root), change `base` in `vite.config.ts` and rebuild; you cannot just move
  the files.
- There is **no CI/CD** — deployment is a manual rebuild + upload.
- The build copies `web/public/data/*` and `web/public/minimaps/*` into `dist/`; the
  app fetches them at runtime same-origin (no CORS). The build runs no Python — the
  ETL JSON is committed and shipped as static assets.

## Project status

~60% of the intended production tool. ETL is complete and frozen; the frontend has
filters, static visualization, zoom/pan, and reliability hardening. Remaining P0
work: aggregate heatmap, consistent humans/bots filtering, and timeline playback.
See [`docs/project_memory/PROJECT_STATE.md`](docs/project_memory/PROJECT_STATE.md)
and [`ROADMAP.md`](docs/project_memory/ROADMAP.md).
