# DECISIONS.md

> Engineering decision records (ADRs). One entry per significant decision. Add a new
> entry (don't rewrite old ones) when a decision is made; if a decision is reversed,
> add a new entry that supersedes the old and note it. Last updated: **2026-07-02**.

Each record: **Problem · Alternatives considered · Decision · Reason · Trade-offs ·
Future implications.**

---

## D1 — No backend; static ETL output is the API

- **Problem:** How should the app get its data?
- **Alternatives:** (a) live backend + DB + query API; (b) serverless functions over
  the parquet; (c) precompute static JSON offline.
- **Decision:** (c) — a Python ETL emits static JSON into `web/public/data/`.
- **Reason:** Data is tiny (~8 MB, 89,104 rows) and **frozen** (5 fixed days). A
  server would be pure overhead and operational surface for zero benefit.
- **Trade-offs:** No live queries/filtering server-side; any data change requires
  re-running the ETL and redeploying. Acceptable given the data is frozen.
- **Future implications:** If the dataset ever becomes large or live, revisit with a
  real query layer; the contract boundary makes that swap localized.

## D2 — HTML5 Canvas 2D for rendering (not SVG/DOM)

- **Problem:** Render thousands of path points + event markers, animated at 60fps.
- **Alternatives:** SVG, DOM elements, WebGL, Canvas 2D.
- **Decision:** Canvas 2D.
- **Reason:** Thousands of nodes in SVG/DOM would choke on layout/repaint; Canvas 2D
  gives direct immediate-mode drawing at the needed scale without WebGL complexity.
- **Trade-offs:** No free hit-testing/DOM events — hit-testing must be done manually
  in pixel space (planned for tooltips, M10). No CSS styling of marks.
- **Future implications:** If density grows past Canvas 2D limits, WebGL is the next
  step; keeping `render/` pure makes that migration contained.

## D3 — Zustand with selective subscriptions for state

- **Problem:** 60fps playback must not re-render the filter UI each tick.
- **Alternatives:** React Context, Redux, Zustand.
- **Decision:** Zustand with fine-grained selectors, split into `filterStore`,
  `playbackStore`, `dataStore`.
- **Reason:** Tiny API, no boilerplate, and selective subscriptions let the playback
  cursor update without touching filter components.
- **Trade-offs:** Less structure/tooling than Redux; discipline needed to keep stores
  focused and selectors narrow.
- **Future implications:** Store split maps cleanly onto features; add slices rather
  than one mega-store.

## D4 — Unified 4-category event taxonomy folding bot combat

- **Problem:** Raw events include `Kill/Killed` (human) and `BotKill/BotKilled` (bot),
  plus `Loot` and `KilledByStorm`. Human-vs-human combat is ~0 in the data.
- **Alternatives:** (a) keep every raw event distinct; (b) show only human combat;
  (c) fold into 4 categories from the viewed player's perspective.
- **Decision:** (c) — `kill = Kill+BotKill`, `death = Killed+BotKilled`, `loot`,
  `storm`. The raw name is preserved in `event.raw` for tooltips.
- **Reason:** Human combat is near-zero (Kill 3, Killed 3); folding bot combat keeps
  markers meaningful and legible instead of near-empty.
- **Trade-offs:** Loses the human/bot distinction *on the marker itself* (still
  recoverable via `raw`).
- **Future implications:** If human PvP data grows, could split combat categories.

## D5 — `ts` is a relative in-match ordering axis; date comes from the folder

- **Problem:** The `ts` column is not wall-clock — a whole match spans <1s of `ts`.
- **Alternatives:** treat `ts` as absolute time; derive date from `ts`.
- **Decision:** Treat `ts` as a **relative ordering axis**, rebase each match's `ts`
  to a shared 0, and derive the **match date from the day folder** (`folder_to_date`).
- **Reason:** Verified against the data — `ts` cannot be wall-clock. The folder is the
  reliable date source.
- **Trade-offs:** No true real-world timestamps; playback time is relative.
- **Future implications:** If real timestamps appear later, `matches.py` rebasing is
  the single place to change.

## D6 — Pre-project coordinates to minimap pixels in the ETL

- **Problem:** Where should world→pixel projection happen?
- **Alternatives:** project in the frontend at render time; project once in the ETL.
- **Decision:** Project once in the ETL (`coordinates.py`), emit minimap pixels in the
  JSON; the frontend renders pixels directly and only computes the *inverse*
  (pixel→world) for a cursor readout.
- **Reason:** Correctness-critical math lives in one pure, unit-tested place; the
  frontend stays simple and fast (no per-point projection each frame).
- **Trade-offs:** Frontend is coupled to the 1024px minimap space; changing map
  projection means re-running the ETL.
- **Future implications:** Map/scale changes are an ETL concern, isolated to config.

## D7 — Do not clamp off-map coordinates

- **Problem:** Some projected points fall slightly outside [0, size].
- **Alternatives:** clamp to the image bounds; drop them; keep them.
- **Decision:** Keep them unclamped; let the frontend decide.
- **Reason:** Off-map points are **real signal** (players near/out of bounds);
  clamping would hide it.
- **Trade-offs:** The frontend must tolerate out-of-range pixels when drawing.
- **Future implications:** Any culling/clipping is a rendering choice, not baked into data.

## D8 — Two viewing scopes: single-match playback + map/date aggregate

- **Problem:** What is the primary unit of analysis?
- **Alternatives:** only per-match; only aggregate; both.
- **Decision:** Both — per-match playback and a per-(map, date) aggregate overview.
- **Reason:** 743/796 matches are a single player's journey, so per-match playback is
  the natural detail view; the aggregate is where heatmap/balance value lives.
- **Trade-offs:** Two data artifact types and two render modes to maintain.
- **Future implications:** Aggregate may gain `isBot`/heatmap (see ROADMAP M14–M15).

## D9 — Contract as the single boundary; TS mirror kept in lockstep

- **Problem:** Keeping the Python producer and TS consumer in agreement.
- **Alternatives:** codegen types from a schema; hand-maintain a TS mirror; no types.
- **Decision:** Hand-maintain `web/src/types/contract.ts` as an exact mirror of
  `etl/src/serialize.py`, changed together in the same commit.
- **Reason:** Simple, zero-tooling, and the compiler flags every consumer to fix when
  the shape changes.
- **Trade-offs:** Manual discipline; risk of drift if the rule is ignored.
- **Future implications:** If drift becomes a problem, generate types from a shared
  JSON Schema.

## D10 — Repository is the memory (this knowledge base)

- **Problem:** Development may continue via Claude, ChatGPT, Cursor, Copilot, or a
  new human, with no shared chat history — and tool-specific "project memory" is not
  portable across tools or across the two workspace folders.
- **Alternatives:** rely on Claude Code project memory / a workspace-root move to
  `D:\LILA\Assignment_Ananta`; rely on external chat memory; put everything in the repo.
- **Decision:** Put everything in the repo under `docs/project_memory/` and treat it
  as the single source of truth. Do **not** depend on any tool's private memory.
- **Reason:** Only the repository is guaranteed to be present for every future
  contributor and tool. Moving the workspace root would not reliably share context to
  non-Claude tools and adds risk for no portable gain.
- **Trade-offs:** These docs must be maintained by hand on every milestone (the
  continuity rule in WORKFLOW §7).
- **Future implications:** The repo stays self-contained and future-proof; any tool
  can resume from `AI_CONTEXT.md` alone.
