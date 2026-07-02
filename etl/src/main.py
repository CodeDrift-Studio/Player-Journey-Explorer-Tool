"""
ETL orchestrator — the conductor of the pipeline.

Owns ONLY sequence, coordination, logging, and reporting. All business logic
lives in the modules it calls (reader / matches / serialize). Run with:

    etl/.venv/Scripts/python.exe -m src.main      # from the etl/ directory

Stages: clean output -> load & reconstruct -> serialize -> validate -> report.
Errors at file or match granularity are logged and skipped so one bad input
never aborts the whole run; catastrophic errors (e.g. cannot write output) fail
loudly.
"""

from __future__ import annotations

import json
import logging
import shutil
import time
from collections import defaultdict
from pathlib import Path

from .config import DAY_FOLDERS, OUTPUT_DIR, RAW_DATA_DIR, folder_to_date
from .matches import Match, build_match
from .reader import PlayerFile, read_player_file
from .serialize import serialize_all

logger = logging.getLogger(__name__)


def _clean_output(output_dir: Path) -> None:
    """Wipe the artifact directory so each run is deterministic (no stale files)."""
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Cleaned output directory: %s", output_dir)


def _load_all() -> tuple[list[Match], dict]:
    """Read every day folder and reconstruct matches.

    Files are grouped by match_id GLOBALLY (across all folders), not per-folder,
    because a match can straddle a day boundary in the raw data — grouping
    per-folder would reconstruct such a match twice. Each match is dated by the
    EARLIEST day any of its files appears in.

    Returns the reconstructed matches plus read-level counters (files seen /
    ok / skipped) that the summary can't recover from the Match list alone.
    """
    files_seen = files_ok = files_skipped = 0
    files_by_match: dict[str, list[PlayerFile]] = defaultdict(list)
    date_by_match: dict[str, str] = {}

    for folder_name in DAY_FOLDERS:
        folder = RAW_DATA_DIR / folder_name
        if not folder.is_dir():
            logger.warning("Day folder missing, skipping: %s", folder)
            continue

        date = folder_to_date(folder_name)
        paths = sorted(p for p in folder.iterdir() if p.is_file())

        read_here = 0
        for path in paths:
            files_seen += 1
            pf = read_player_file(path)
            if pf is None:
                files_skipped += 1
                continue
            files_ok += 1
            read_here += 1
            files_by_match[pf.match_id].append(pf)
            # Earliest day wins (ISO dates compare lexicographically).
            prev = date_by_match.get(pf.match_id)
            if prev is None or date < prev:
                date_by_match[pf.match_id] = date

        logger.info("%s: %d files -> %d players read", folder_name, len(paths), read_here)

    matches: list[Match] = []
    for match_id, files in files_by_match.items():
        match = build_match(match_id, files, date_by_match[match_id])
        if match is not None:
            matches.append(match)
    logger.info("Reconstructed %d matches from %d player files", len(matches), files_ok)

    return matches, {"seen": files_seen, "ok": files_ok, "skipped": files_skipped}


def _validate_output(output_dir: Path, matches: list[Match]) -> None:
    """Re-read artifacts from disk and assert they are well-formed. Catches
    serialization bugs before we ever hand the data to the frontend."""
    def require(cond: bool, msg: str) -> None:
        if not cond:
            raise RuntimeError(f"Output validation failed: {msg}")

    manifest = json.loads((output_dir / "manifest.json").read_text(encoding="utf-8"))
    require(len(manifest["matches"]) == len(matches), "manifest match count mismatch")
    require(bool(manifest["maps"]), "manifest has no map configs")

    # Every match must be unique — guards against grouping bugs (e.g. a match
    # straddling a day boundary being reconstructed twice).
    ids = [m["matchId"] for m in manifest["matches"]]
    require(len(ids) == len(set(ids)), "duplicate matchId(s) in manifest")

    sample_id = manifest["matches"][0]["matchId"]
    sample_path = output_dir / "matches" / f"{sample_id}.json"
    require(sample_path.exists(), f"missing per-match file for {sample_id}")
    sample = json.loads(sample_path.read_text(encoding="utf-8"))
    require(sample["matchId"] == sample_id and "players" in sample, "malformed per-match file")

    require(any((output_dir / "aggregate").glob("*.json")), "no aggregate files written")
    logger.info("Output validation passed.")


def _dir_size_bytes(path: Path) -> int:
    return sum(f.stat().st_size for f in path.rglob("*") if f.is_file())


def _summary(matches: list[Match], read: dict, output_dir: Path, elapsed: float) -> dict:
    players = sum(len(m.players) for m in matches)
    bots = sum(p.is_bot for m in matches for p in m.players)
    events = sum(len(p.events) for m in matches for p in m.players)
    points = sum(len(p.path) for m in matches for p in m.players)
    return {
        "files_processed": read["seen"],
        "files_ok": read["ok"],
        "files_skipped": read["skipped"],
        "matches": len(matches),
        "players": players,
        "humans": players - bots,
        "bots": bots,
        "events": events,
        "path_points": points,
        "elapsed_s": round(elapsed, 2),
        "output_mb": round(_dir_size_bytes(output_dir) / (1024 * 1024), 2),
    }


def _log_summary(s: dict) -> None:
    # ASCII only: box-drawing chars render as garbage on Windows cp1252 consoles.
    logger.info("=== ETL SUMMARY " + "=" * 29)
    logger.info("Files processed : %d (ok %d, skipped %d)", s["files_processed"], s["files_ok"], s["files_skipped"])
    logger.info("Matches         : %d", s["matches"])
    logger.info("Players         : %d (humans %d, bots %d)", s["players"], s["humans"], s["bots"])
    logger.info("Events          : %d", s["events"])
    logger.info("Path points     : %d", s["path_points"])
    logger.info("Processing time : %.2fs", s["elapsed_s"])
    logger.info("Output size     : %.2f MB", s["output_mb"])
    logger.info("=" * 45)


def main() -> dict:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    start = time.perf_counter()
    logger.info("Starting ETL. Raw data: %s", RAW_DATA_DIR)

    _clean_output(OUTPUT_DIR)
    matches, read_stats = _load_all()
    serialize_all(matches, OUTPUT_DIR)
    _validate_output(OUTPUT_DIR, matches)

    summary = _summary(matches, read_stats, OUTPUT_DIR, time.perf_counter() - start)
    _log_summary(summary)
    return summary


if __name__ == "__main__":
    main()
