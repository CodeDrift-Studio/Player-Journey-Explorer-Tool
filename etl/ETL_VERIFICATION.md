# ETL Verification Report

Verification of the offline ETL pipeline against the provided LILA BLACK dataset
(Feb 10–14, 2026). This is the "prove the backend is correct before building the
frontend" checkpoint.

## How to reproduce

```bash
cd etl
.venv/Scripts/python.exe -m pytest -q      # 25 unit tests
.venv/Scripts/python.exe -m src.main       # full pipeline over all raw files
```

Artifacts are written to `web/public/data/`.

## Summary statistics (full run)

| Metric | Value |
|---|---|
| Files processed | **1,243** (ok 1,243, skipped 0) |
| Matches reconstructed | **796** |
| Player entries (files merged by match+user) | **1,242** |
| — human players | 781 |
| — bot players | 461 |
| Unique players (humans) | 245 |
| Unique bots | 94 |
| Events (kill/death/loot/storm) | **16,045** |
| Path points (movement samples) | **73,059** |
| Processing time | **~2.5 s** |
| Output size (logical) | **4.01 MB** |

## Reconciliation against README ground truth

Every independent figure ties out — strong evidence the pipeline neither drops
nor duplicates data:

| Check | README | ETL | ✓ |
|---|---|---|---|
| Total files | 1,243 | 1,243 | ✅ |
| Total event rows | ~89,000 | 73,059 path + 16,045 events = **89,104** | ✅ |
| Unique matches | 796 | 796 | ✅ |
| Unique players | 339 | 245 humans + 94 bots = **339** | ✅ |
| Maps | Ambrose / GrandRift / Lockdown | same | ✅ |

Per-category event totals also match the raw scan exactly:
`Loot 12,885 · BotKill 2,415 · BotKilled 700 · KilledByStorm 39 · Kill 3 · Killed 3`.

## Bug found & fixed during verification

**Symptom:** the first run produced **797** matches, not 796.

**Root cause:** one match (`ac049b28-…`) has player files split across
`February_10` and `February_11` (it straddles a day boundary in the raw data).
The initial orchestrator grouped files **per folder**, so this match was
reconstructed twice — yielding a duplicate `matchId` in the manifest and a
per-match JSON file that was silently overwritten.

**Fix:** group by `match_id` **globally** across all folders, dating each match
by the earliest day it appears in. This also makes reconstruction *more* correct
(the straddling match is now assembled completely). A validator assertion
(`duplicate matchId(s) in manifest`) was added to catch any regression.

## Second finding: player journey split across files

The final audit (`audit.py`) found that one `(match_id, user_id)` pair —
player `cfa03e9f…` in match `ac049b28…` — appears in **two** files (Feb 10 and
Feb 11), i.e. one player's journey split by the day boundary. The model was
corrected to **merge files sharing `(match_id, user_id)` into one player** with a
combined, time-sorted path (fulfilling "combine files into complete matches").
Result: 1,243 files → **1,242 player entries**. Row totals are unchanged (every
row still present exactly once).

## Final freeze audit (`audit.py`) — all 10 criteria

| # | Criterion | Result |
|---|---|---|
| 1 | Each parquet file represented exactly once | ✅ set-equal + 89,104/89,104 rows |
| 2 | Every match reconstructs correctly (manifest == detail) | ✅ 0 mismatches / 796 |
| 3 | Paths & events chronologically ordered | ✅ 0 unordered |
| 4 | Coordinates within minimap bounds | ✅ 100% inside [0,1024]; px[51,963] py[75,918] |
| 5 | Event counts reconcile with raw parquet | ✅ exact, per-category |
| 6 | Manifest contains everything the frontend needs | ✅ maps/dates/fields/files all present |
| 7 | JSON minimizes duplication, easy to consume | ✅ tuple paths; map cfg stored once; small justified redundancy |
| 8 | Files sized for browser loading | ✅ manifest 25KB gz; biggest match 23KB; biggest aggregate 116KB gz |
| 9 | Assumptions documented | ✅ ETL_FLOW.md (per module) + this report |
| 10 | No parquet internals leak to the frontend | ✅ 0 leaks (no bytes/suffix/epoch) |

## Validation performed

**Automated** (in `main._validate_output`, run every pipeline execution):
- manifest match count equals the number of reconstructed matches;
- manifest contains map configs;
- all manifest `matchId`s are unique (guards the bug above);
- a sampled per-match file exists and is well-formed;
- at least one aggregate file was written.

**Unit tests** (25, `pytest`): coordinate conversion (incl. README worked
example), event taxonomy, bot detection, reader decoding & error handling,
match rebasing/splitting/projection, and JSON shaping + round-trip.

**Manual spot-checks:** manifest/per-match/aggregate JSON structure inspected;
real 15+ player match reconstructed with correct duration, categories, and pixels.

## Output structure

```
web/public/data/
├── manifest.json                     164 KB  – filter index (maps, dates, match summaries)
├── matches/{matchId}.json            796 files – per-match detail (playback)
└── aggregate/{mapId}_{date}.json      15 files – flattened points/events (overview heatmap)
```

**manifest.json** (match entries sorted richest-first):
```jsonc
{ "maps": { "AmbroseValley": {"scale":900,"originX":-370,"originZ":-473,
            "image":"AmbroseValley_Minimap.png","size":1024}, ... },
  "dates": ["2026-02-10", ... "2026-02-14"],
  "matches": [ { "matchId":"fbbc5d02-…","mapId":"AmbroseValley","date":"2026-02-12",
                 "humanCount":1,"botCount":15,
                 "eventCounts":{"kill":5,"death":8,"loot":7,"storm":0},
                 "pointCount":995,"durationMs":523 }, ... ] }
```

**matches/{matchId}.json**:
```jsonc
{ "matchId":"…","mapId":"AmbroseValley","date":"2026-02-12","startTs":0,"endTs":523,
  "players": [ { "userId":"…","isBot":true,
                 "path":   [[0,261.2,702.6],[15,255.8,675.7], ...],   // [ts, px, py]
                 "events": [{"t":33,"cat":"loot","raw":"Loot","px":235.0,"py":745.7}, ...] } ] }
```

**aggregate/{mapId}_{date}.json**:
```jsonc
{ "mapId":"AmbroseValley","date":"2026-02-12",
  "points": [[261.2,702.6], ...],                       // all journeys flattened
  "events": [{"cat":"loot","px":235.0,"py":745.7}, ...] }
```

## Known data characteristics (not bugs)

- **`ts` is a relative in-match ordering axis**, not wall-clock: a whole match
  spans well under a second of `ts`. Playback normalizes each match to
  `[0, endTs]` and replays at a user-controlled speed.
- **Most matches are single-journey**: ~743 matches contain one player's data;
  only ~53 have multiple players. Hence the aggregate (map+day) view and the
  richness-ranked match picker.
- **Human-vs-human combat is near-zero** (`Kill`/`Killed` = 3 each); real combat
  is vs bots (`BotKill`/`BotKilled`), folded into the unified kill/death markers.
