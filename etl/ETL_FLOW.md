# ETL Flow — LILA BLACK Player Journey Tool

This document tracks the offline ETL pipeline: what each module does, its inputs
and outputs, the data transformations it performs, why each is necessary, and the
assumptions it makes. It evolves as modules are added and feeds `ARCHITECTURE.md`.

## Pipeline overview

```
raw parquet (*.nakama-0)
   │  reader.py        read + decode + type  →  PlayerFile[]
   ▼
PlayerFile[]
   │  matches.py       group + rebase + project + split  →  Match[]
   ▼
Match[]  (domain model)
   │  serialize.py     shape into JSON  →  manifest.json, matches/*.json, aggregate/*.json   [PENDING]
   ▼
web/public/data/
```

Shared foundation: `config.py` (constants) and `coordinates.py` (pure math) are
used by the stages above but perform no I/O themselves.

---

## `config.py` — single source of truth

- **Does:** holds all constants — filesystem paths, per-map projection config
  (`scale`, `origin`, image), the event taxonomy, and small helpers
  (`folder_to_date`, `is_bot`).
- **Input / Output:** none (pure constants + tiny pure functions).
- **Key data:**
  - `MAPS`: `map_id -> MapConfig(scale, origin_x, origin_z, image, size=1024)`.
  - `RAW_EVENT_TO_CATEGORY`: raw event string → one of `kill|death|loot|storm`.
  - `POSITION_EVENTS = {"Position", "BotPosition"}`.
- **Why:** centralising constants means a map origin or a taxonomy rule changes
  in exactly one place.
- **Assumptions:** data year is 2026; minimaps are 1024×1024; bots have numeric
  `user_id`, humans have UUIDs.

---

## `coordinates.py` — world → minimap projection

- **Does:** pure math converting a world `(x, z)` to minimap pixel `(px, py)`.
- **Input:** `x, z` floats + a `MapConfig`.
- **Output:** `(px, py)` floats (optionally rounded to 1 dp via `round_px`).
- **Transformation & why:**
  1. `u = (x - origin_x)/scale`, `v = (z - origin_z)/scale` — normalise world
     coords to a 0..1 range relative to the map's footprint.
  2. `px = u*size`, `py = (1 - v)*size` — scale to pixels; **Y is flipped**
     because image origin is top-left while world Z increases "up".
  - We use only `x` and `z`; the `y` column is elevation, irrelevant to a 2D map.
- **Assumptions:** the README's per-map `scale`/`origin` are authoritative
  (verified against the README's worked example: `(-301.45,-355.55)` → `(78,890)`).
- **Note:** points are **not clamped** to the image — an off-map point is real
  signal (edge/out-of-bounds), not an error to hide.

---

## `reader.py` — one parquet file → typed records

- **Does:** reads a single `.nakama-0` parquet file into a strongly-typed
  `PlayerFile`. The boundary between raw bytes and our clean domain.
- **Input:** a filesystem `Path` to one parquet file.
- **Output:** `PlayerFile | None` (None on recoverable errors).
  - `PlayerFile{ user_id, match_id, map_id, is_bot, rows: EventRow[], source }`
  - `EventRow{ ts:int(ms), x, y, z, event:str }`
- **Transformations & why:**
  1. **Decode `event` bytes → str** (`b'Position'` → `"Position"`): the column is
     stored as bytes; unusable as text otherwise.
  2. **Strip `.nakama-0` suffix** from the `match_id` column so match IDs are
     consistent as keys/filenames.
  3. **Normalise timestamp to integer milliseconds** via
     `astype("datetime64[ms]").astype("int64")` — forcing ms resolution first
     guards against ns/µs-stored files silently producing values 10⁶× too large.
  4. **Classify human vs bot** from `user_id` shape.
- **Design:** pure transform (`_normalize`, testable with in-memory DataFrames)
  is split from I/O (`read_player_file`, adds error handling).
- **Error policy:** unreadable / empty / malformed files are logged and skipped
  (`None`) so one bad file never aborts a 1,243-file run.
- **Assumptions:** all rows in a file share the same identity (read from row 0).

---

## `matches.py` — reconstruct complete matches (domain layer)

- **Does:** assembles the `PlayerFile`s sharing a `match_id` into one `Match`,
  the unit a level designer reasons about.
- **Input:** `list[PlayerFile]` (+ the ISO `date` for the match's day folder).
- **Output:** `Match | None`.
  - `Match{ match_id, map_id, date, start_ts=0, end_ts, players: MatchPlayer[] }`
  - `MatchPlayer{ user_id, is_bot, path: PathPoint[], events: MatchEvent[] }`
  - `PathPoint{ ts, px, py }`
  - `MatchEvent{ ts, category, raw, px, py }`
- **Transformations & why:**
  1. **Group by `match_id`** (`group_by_match`) — one match = many player files.
  2. **Rebase timestamps to a SHARED zero**: `match_start = min(ts)` across ALL
     players; `ts -= match_start`. A single shared clock keeps every player's
     path in sync during playback (per-player rebasing would desync them).
     `end_ts = max(ts) - match_start` is the match duration in ms.
  3. **Project coordinates** to pixels here (baked into the model) so the
     frontend never recomputes them per frame — a space-for-time trade (cheap
     because the dataset is tiny).
  4. **Split rows** into a movement `path` (Position/BotPosition) vs discrete
     `events`, mapping raw event → unified category while keeping `raw` for
     tooltips.
  5. **Sort** path and events by `ts` for reproducible playback.
- **Error policy:** unknown map → skip match + log; unknown event string → skip
  that row + log.
- **Player merge:** files sharing `(match_id, user_id)` are combined into ONE
  player with a time-sorted path — a player's journey can be split across files
  (e.g. a match straddling a day boundary). Verified: exactly one such player in
  the dataset.
- **Assumptions:** all files in a match share one `map_id`; `ts` is a relative
  in-match ordering axis (a whole match spans well under a second of `ts`); a
  match spanning multiple day folders is dated by its earliest day.
- **Design:** produces a DOMAIN model, deliberately NOT the JSON wire format —
  `serialize.py` owns output shape so the format can change independently.

---

## `serialize.py` — domain → web-ready JSON (output boundary)

- **Does:** shapes `Match` domain objects into the static JSON "API" and writes
  it to `web/public/data/`. The mirror of `reader.py`.
- **Input:** `list[Match]` (+ target output dir).
- **Output (three artifact kinds):**
  - `manifest.json` — `{ maps, dates, matches[] }`. `maps` carries the projection
    config per map; each `matches[]` row is a summary
    `{ matchId, mapId, date, humanCount, botCount, eventCounts{kill,death,loot,storm},
    pointCount, durationMs }`.
  - `matches/{matchId}.json` — `{ matchId, mapId, date, startTs, endTs,
    players[] }`, where each player is `{ userId, isBot, path:[[ts,px,py]...],
    events:[{t,cat,raw,px,py}...] }`.
  - `aggregate/{mapId}_{date}.json` — `{ mapId, date, points:[[px,py]...],
    events:[{cat,px,py}...] }` (all journeys for that map+day, flattened).
- **Transformations & why:**
  1. **snake_case → camelCase** at this boundary (consumer is JavaScript).
  2. **Compact encoding**: paths as `[ts,px,py]` tuples + whitespace-free JSON —
     roughly 3× smaller payloads for thousands of points.
  3. **Rank matches by richness** (players, then events) in the manifest so the
     ~53 multi-player matches surface above the ~743 single-journey ones.
  4. **Pre-bake per-(map,date) aggregates** so the overview loads in one fetch
     instead of hundreds.
- **Design:** pure shapers (`match_to_dict`, `build_manifest`, `build_aggregate`)
  are split from I/O (`write_json`); `serialize_all` orchestrates writing.
- **Assumptions:** output dir is writable; match IDs are safe filenames (UUIDs).

---

## `main.py` — orchestrator (no business logic)

- **Does:** coordinates the full run: clean output → load & reconstruct →
  serialize → validate → report. Holds only sequence/logging; all logic is in
  the modules above.
- **Input:** the raw data folders (`RAW_DATA_DIR`). **Output:** the JSON
  artifacts in `OUTPUT_DIR`, plus an INFO-level log and a summary dict.
- **Key behaviours & why:**
  1. **Clean output first** (`shutil.rmtree`) so every run is deterministic —
     no stale files linger.
  2. **Global grouping by `match_id`** (not per-folder), dated by the earliest
     day — a match can straddle a day boundary; per-folder grouping would
     duplicate it. (See `ETL_VERIFICATION.md`.)
  3. **Graceful degradation**: file/match-level failures are skipped + counted;
     only catastrophic errors (e.g. unwritable output) raise.
  4. **Validate before finishing**: re-reads artifacts from disk and asserts
     count match, unique matchIds, a well-formed sample, and aggregates exist.
  5. **Report** files/matches/players/bots/events/time/size.
- **Run:** `python -m src.main` from `etl/`.
- **Assumptions:** the full dataset fits comfortably in memory (it does: ~89k
  rows, ~4 MB output), so a single in-memory pass is simplest and fastest.
