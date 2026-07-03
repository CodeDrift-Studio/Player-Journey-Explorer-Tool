# web/ — Player Journey Explorer (frontend)

React 19 + TypeScript + Vite + Tailwind CSS v4 + Zustand SPA. It fetches the static
JSON produced by the [`etl/`](../etl/) pipeline and renders player journeys to an
HTML5 Canvas 2D. There is no backend.

See the [top-level README](../README.md) for the project overview, architecture, and
deployment. This file covers the frontend toolchain only.

## Commands

```bash
npm install        # first time only
npm run dev        # dev server at http://localhost:5173
npm run test       # Vitest — 38 tests for the pure lib/* logic
npm run lint       # ESLint
npm run build      # tsc -b (typecheck) + vite build → dist/
npm run preview    # serve the production build locally
```

The committed data under `public/data/` lets the frontend run without Python.

## Layout (`src/`)

| Layer | Responsibility |
|---|---|
| `types/contract.ts` | TS mirror of the JSON contract (source of truth for data shape). |
| `lib/` | Pure helpers: `data` (fetch+cache), `viewport`, `mapCoords`, `format`, `playback`, `heatmap`, `stats`, `hitTest`. |
| `store/` | Zustand stores: `filterStore`, `playbackStore`, `dataStore`. |
| `hooks/` | `useManifest`, `useSelectedData`, `useImage`. |
| `render/` | `palette`, `scene` — pure back-to-front Canvas draw. |
| `components/` | `App`, `Sidebar`, `MapViewport`, `Timeline`, `Legend`, `StatsPanel`, `HeatmapControl`, filters, `ui`. |

Dependencies flow one direction: `components → hooks → store + lib + render → types`.
`lib/` and `render/` are pure (no React, no store access inside draw functions).

## Deployment

The build is served from the `/lila/` subdirectory, so `vite.config.ts` sets
`base: '/lila/'` and runtime fetches use `import.meta.env.BASE_URL`. See the
[top-level README](../README.md#deployment) for the full release procedure.
