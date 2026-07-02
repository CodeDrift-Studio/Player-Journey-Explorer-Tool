"""
Read ONE parquet file into a clean, strongly-typed PlayerFile.

This module is the boundary between the messy outside world (raw bytes, parquet
quirks, corrupt files) and our clean internal domain. Everything downstream works
with typed value objects and never touches parquet again — the "parse, don't
validate" pattern: push all the ugliness to the edge.

Design note: coordinate conversion is intentionally NOT done here. That would
couple the reader to map config and break its single responsibility. The reader
only reads, decodes, and types.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

from .config import is_bot

logger = logging.getLogger(__name__)

# The columns every valid file must have (per the README schema).
REQUIRED_COLUMNS = {"user_id", "match_id", "map_id", "x", "y", "z", "ts", "event"}

# The match_id column carries the game-server instance suffix; strip it so the
# clean match UUID is used consistently as a key and filename.
MATCH_ID_SUFFIX = ".nakama-0"


@dataclass(frozen=True)
class EventRow:
    """One recorded moment in a player's journey. Immutable value object."""
    ts: int      # raw milliseconds (near-epoch; rebased to match-start later)
    x: float
    y: float
    z: float
    event: str   # decoded event name, e.g. "Position", "BotKill"


@dataclass(frozen=True)
class PlayerFile:
    """One player's (or bot's) complete journey through one match = one file."""
    user_id: str
    match_id: str     # normalized (suffix stripped)
    map_id: str
    is_bot: bool
    rows: list[EventRow]
    source: str       # source filename, for logging/debugging

    @property
    def is_empty(self) -> bool:
        return not self.rows


def _decode_event(value) -> str:
    """The `event` column is stored as bytes (e.g. b'Position').
    Decode to str; be defensive since some readers already yield str."""
    if isinstance(value, (bytes, bytearray)):
        return value.decode("utf-8")
    return str(value)


def _normalize(df: pd.DataFrame, source: str) -> PlayerFile:
    """Pure transform: a raw DataFrame for ONE file -> typed PlayerFile.

    Separated from I/O so it is unit-testable with an in-memory DataFrame.
    Raises ValueError on malformed input (missing columns) — the caller decides
    whether that is recoverable.
    """
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"missing columns {sorted(missing)}")

    # All rows in one file share the same identity — read it from the first row.
    first = df.iloc[0]
    user_id = str(first["user_id"])
    match_id = str(first["match_id"]).removesuffix(MATCH_ID_SUFFIX)
    map_id = str(first["map_id"])

    # Normalize timestamp resolution to milliseconds BEFORE extracting integers.
    # Forcing [ms] first guards against files stored at ns/us resolution — the
    # exact class of bug that silently corrupts "elapsed time" calculations.
    ts_ms = df["ts"].astype("datetime64[ms]").astype("int64")

    rows = [
        EventRow(ts=int(t), x=float(x), y=float(y), z=float(z), event=_decode_event(e))
        for t, x, y, z, e in zip(ts_ms, df["x"], df["y"], df["z"], df["event"])
    ]

    return PlayerFile(
        user_id=user_id,
        match_id=match_id,
        map_id=map_id,
        is_bot=is_bot(user_id),
        rows=rows,
        source=source,
    )


def read_player_file(path: Path) -> PlayerFile | None:
    """Read one parquet file into a typed PlayerFile.

    Returns None (and logs a warning) for RECOVERABLE problems — unreadable,
    empty, or malformed files — so a batch run over 1,000+ files skips bad
    inputs instead of crashing. Programmer errors are still allowed to raise.
    """
    try:
        table = pq.read_table(path)
    except Exception as exc:  # broad on purpose: any read failure is skippable
        logger.warning("Skipping unreadable file %s: %s", path.name, exc)
        return None

    if table.num_rows == 0:
        logger.warning("Skipping empty file %s", path.name)
        return None

    try:
        player = _normalize(table.to_pandas(), source=path.name)
    except ValueError as exc:
        logger.warning("Skipping malformed file %s: %s", path.name, exc)
        return None

    logger.debug(
        "Read %s: %d rows (%s)",
        path.name, len(player.rows), "bot" if player.is_bot else "human",
    )
    return player
