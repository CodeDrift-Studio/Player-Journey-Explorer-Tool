"""
Reconstruct complete matches from individual player files.

This is the DOMAIN layer. reader.py produced clean per-file records; here we
assemble the files that share a match_id into one coherent `Match`:
  - rebase timestamps so the match starts at 0 (one shared clock for all players)
  - project world (x, z) -> minimap pixels
  - split each player's rows into a movement `path` vs discrete `events`

We intentionally build a DOMAIN model, not the JSON wire format. serialize.py
handles output shape — so the format can change without touching this logic.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass
from typing import Iterable

from .config import MAPS, MapConfig, POSITION_EVENTS, RAW_EVENT_TO_CATEGORY
from .coordinates import round_px, world_to_pixel
from .reader import PlayerFile

logger = logging.getLogger(__name__)


# ── Domain model ──────────────────────────────────────────────────
@dataclass(frozen=True)
class PathPoint:
    """One sampled position on a player's movement path (match-relative time)."""
    ts: int      # milliseconds since match start (0 = start)
    px: float
    py: float


@dataclass(frozen=True)
class MatchEvent:
    """A discrete gameplay event (kill / death / loot / storm)."""
    ts: int
    category: str   # unified display category: "kill" | "death" | "loot" | "storm"
    raw: str        # original event name, e.g. "BotKill" (kept for tooltips)
    px: float
    py: float


@dataclass(frozen=True)
class MatchPlayer:
    user_id: str
    is_bot: bool
    path: list[PathPoint]
    events: list[MatchEvent]


@dataclass(frozen=True)
class Match:
    match_id: str
    map_id: str
    date: str        # ISO date, derived from the day folder
    start_ts: int    # always 0 after rebasing (kept explicit for clarity)
    end_ts: int      # match duration in ms (max rebased timestamp)
    players: list[MatchPlayer]


# ── Reconstruction ────────────────────────────────────────────────
def group_by_match(files: Iterable[PlayerFile]) -> dict[str, list[PlayerFile]]:
    """Bucket player files by their match_id. Pure and trivially testable."""
    groups: dict[str, list[PlayerFile]] = defaultdict(list)
    for f in files:
        groups[f.match_id].append(f)
    return dict(groups)


def _build_player(files: list[PlayerFile], cfg: MapConfig, match_start: int) -> MatchPlayer:
    """Turn all files for ONE player in a match into a positioned, time-rebased
    player. A player's journey is occasionally split across multiple files (e.g.
    a match straddling a day boundary), so we combine their rows into one path."""
    path: list[PathPoint] = []
    events: list[MatchEvent] = []

    for pf in files:
        for row in pf.rows:
            px, py = round_px(*world_to_pixel(row.x, row.z, cfg))
            ts = row.ts - match_start  # rebase to the SHARED match clock

            if row.event in POSITION_EVENTS:
                path.append(PathPoint(ts, px, py))
                continue

            category = RAW_EVENT_TO_CATEGORY.get(row.event)
            if category is None:
                # Unknown event string — skip the row, don't crash the run.
                logger.warning("Unknown event %r in %s; skipping row", row.event, pf.source)
                continue
            events.append(MatchEvent(ts, category, row.event, px, py))

    # Deterministic ordering makes playback reproducible (and interleaves rows
    # correctly when a player's data came from more than one file).
    path.sort(key=lambda p: p.ts)
    events.sort(key=lambda e: e.ts)
    first = files[0]
    return MatchPlayer(first.user_id, first.is_bot, path, events)


def build_match(match_id: str, files: list[PlayerFile], date: str) -> Match | None:
    """Assemble one Match from the player files sharing its match_id.

    Returns None (and logs) for recoverable problems — no files, no rows, or an
    unknown map — so a batch run skips them instead of crashing.
    """
    if not files:
        return None

    map_id = files[0].map_id
    cfg = MAPS.get(map_id)
    if cfg is None:
        logger.warning("Skipping match %s: unknown map %r", match_id, map_id)
        return None

    # The match start is the EARLIEST timestamp across ALL players, so every
    # player shares one clock (per-player rebasing would desync their paths).
    all_ts = [row.ts for f in files for row in f.rows]
    if not all_ts:
        logger.warning("Skipping match %s: no event rows", match_id)
        return None
    match_start = min(all_ts)
    end_ts = max(all_ts) - match_start

    # Merge files that share a user_id (one player's journey can span multiple
    # files) so each player appears exactly once with a complete path.
    by_user: dict[str, list[PlayerFile]] = defaultdict(list)
    for f in files:
        by_user[f.user_id].append(f)
    players = [_build_player(user_files, cfg, match_start) for user_files in by_user.values()]
    return Match(
        match_id=match_id,
        map_id=map_id,
        date=date,
        start_ts=0,
        end_ts=end_ts,
        players=players,
    )
