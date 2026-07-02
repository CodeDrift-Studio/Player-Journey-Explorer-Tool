"""
Shape domain Match objects into web-ready JSON artifacts.

This is the OUTPUT boundary — the mirror of reader.py. It converts our internal
domain model into the JSON the frontend consumes (the static "API"):

  manifest.json                  – filter index: maps, dates, per-match summary
  matches/{matchId}.json         – full per-match detail (for playback)
  aggregate/{mapId}_{date}.json  – flattened points/events (for the overview heatmap)

Conventions:
  - Python domain is snake_case; JSON is camelCase (the consumer is JavaScript).
    We convert at this boundary so each side stays idiomatic.
  - JSON is written compact (no whitespace) and paths use [ts, px, py] tuples to
    keep payloads small.
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from pathlib import Path

from .config import EVENT_CATEGORIES, MAPS, OUTPUT_DIR
from .matches import Match, MatchPlayer

logger = logging.getLogger(__name__)


# ── Pure shapers (domain -> plain dict) ───────────────────────────
def _player_to_dict(p: MatchPlayer) -> dict:
    return {
        "userId": p.user_id,
        "isBot": p.is_bot,
        # Compact tuples instead of objects: ~3x smaller for thousands of points.
        "path": [[pt.ts, pt.px, pt.py] for pt in p.path],
        "events": [
            {"t": e.ts, "cat": e.category, "raw": e.raw, "px": e.px, "py": e.py}
            for e in p.events
        ],
    }


def match_to_dict(m: Match) -> dict:
    """Full per-match wire format (matches/{matchId}.json)."""
    return {
        "matchId": m.match_id,
        "mapId": m.map_id,
        "date": m.date,
        "startTs": m.start_ts,
        "endTs": m.end_ts,
        "players": [_player_to_dict(p) for p in m.players],
    }


def _event_counts(m: Match) -> dict[str, int]:
    counts = {c: 0 for c in EVENT_CATEGORIES}
    for p in m.players:
        for e in p.events:
            counts[e.category] += 1
    return counts


def manifest_entry(m: Match) -> dict:
    """One summary row for a match in manifest.json (drives the filter UI)."""
    return {
        "matchId": m.match_id,
        "mapId": m.map_id,
        "date": m.date,
        "humanCount": sum(not p.is_bot for p in m.players),
        "botCount": sum(p.is_bot for p in m.players),
        "eventCounts": _event_counts(m),
        "pointCount": sum(len(p.path) for p in m.players),
        "durationMs": m.end_ts,
    }


def build_manifest(matches: list[Match]) -> dict:
    """The filter index: map configs, available dates, and match summaries."""
    maps = {
        map_id: {
            "scale": c.scale,
            "originX": c.origin_x,
            "originZ": c.origin_z,
            "image": c.image,
            "size": c.size,
        }
        for map_id, c in MAPS.items()
    }
    dates = sorted({m.date for m in matches})
    # Rank matches by richness (players, then events) so the interesting ones
    # surface above the many single-journey matches.
    entries = sorted(
        (manifest_entry(m) for m in matches),
        key=lambda e: (e["humanCount"] + e["botCount"], sum(e["eventCounts"].values())),
        reverse=True,
    )
    return {"maps": maps, "dates": dates, "matches": entries}


def build_aggregate(map_id: str, date: str, matches: list[Match]) -> dict:
    """Flatten every player's points/events for one (map, date) into a single
    overview payload — one fetch instead of hundreds of per-match requests."""
    points: list[list[float]] = []
    events: list[dict] = []
    for m in matches:
        for p in m.players:
            points.extend([pt.px, pt.py] for pt in p.path)
            events.extend({"cat": e.category, "px": e.px, "py": e.py} for e in p.events)
    return {"mapId": map_id, "date": date, "points": points, "events": events}


# ── I/O ───────────────────────────────────────────────────────────
def write_json(path: Path, obj) -> None:
    """Write `obj` as compact JSON, creating parent directories as needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"))  # compact: no spaces


def serialize_all(matches: list[Match], output_dir: Path = OUTPUT_DIR) -> dict:
    """Write all three artifact kinds. Returns a small summary for logging."""
    write_json(output_dir / "manifest.json", build_manifest(matches))

    for m in matches:
        write_json(output_dir / "matches" / f"{m.match_id}.json", match_to_dict(m))

    by_map_date: dict[tuple[str, str], list[Match]] = defaultdict(list)
    for m in matches:
        by_map_date[(m.map_id, m.date)].append(m)
    for (map_id, date), group in by_map_date.items():
        write_json(
            output_dir / "aggregate" / f"{map_id}_{date}.json",
            build_aggregate(map_id, date, group),
        )

    summary = {
        "matches": len(matches),
        "aggregates": len(by_map_date),
        "output_dir": str(output_dir),
    }
    logger.info("Serialized %d matches, %d aggregates -> %s",
                summary["matches"], summary["aggregates"], summary["output_dir"])
    return summary
