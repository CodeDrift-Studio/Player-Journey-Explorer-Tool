"""
Single source of truth for ETL constants: paths, map configs, event taxonomy.

Keeping these here (rather than scattered as magic numbers) means the whole
pipeline reads from one place — change a path or a map origin once, and every
module picks it up. This is the Single Responsibility Principle applied to config.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

# ── Filesystem paths ──────────────────────────────────────────────
# etl/src/config.py -> parents[2] is the project root (player-journey-tool/).
_PROJECT_ROOT = Path(__file__).resolve().parents[2]

# Raw data is provided beside the project and never committed.
RAW_DATA_DIR = _PROJECT_ROOT.parent / "player_data"

# The ETL writes web-ready artifacts straight into the frontend's public folder.
OUTPUT_DIR = _PROJECT_ROOT / "web" / "public" / "data"

# Day folders in the raw dataset. February 14 is a known partial day.
DAY_FOLDERS = ["February_10", "February_11", "February_12", "February_13", "February_14"]
DATA_YEAR = 2026  # from the README; the `ts` column is NOT wall-clock (see notes).

# The minimap images are square, 1024x1024 px (per README).
MINIMAP_SIZE = 1024


# ── Map configuration ─────────────────────────────────────────────
@dataclass(frozen=True)
class MapConfig:
    """How a map's world coordinates project onto its 1024x1024 minimap image.

    frozen=True makes instances immutable — config should never change at runtime.
    """
    name: str
    scale: float
    origin_x: float
    origin_z: float
    image: str          # filename served under /minimaps
    size: int = MINIMAP_SIZE


MAPS: dict[str, MapConfig] = {
    "AmbroseValley": MapConfig("AmbroseValley", 900, -370, -473, "AmbroseValley_Minimap.png"),
    "GrandRift":     MapConfig("GrandRift",     581, -290, -290, "GrandRift_Minimap.png"),
    "Lockdown":      MapConfig("Lockdown",      1000, -500, -500, "Lockdown_Minimap.jpg"),
}


# ── Event taxonomy ────────────────────────────────────────────────
# Raw parquet event strings map to 4 display categories (approved design).
# Human-vs-human Kill/Killed are near-zero in the data, so we fold bot combat
# into the same categories from the *viewed player's* perspective.
CATEGORY_KILL = "kill"
CATEGORY_DEATH = "death"
CATEGORY_LOOT = "loot"
CATEGORY_STORM = "storm"

# Position samples are the player's movement path, not discrete events.
POSITION_EVENTS = {"Position", "BotPosition"}

RAW_EVENT_TO_CATEGORY: dict[str, str] = {
    "Kill": CATEGORY_KILL,
    "BotKill": CATEGORY_KILL,
    "Killed": CATEGORY_DEATH,
    "BotKilled": CATEGORY_DEATH,
    "Loot": CATEGORY_LOOT,
    "KilledByStorm": CATEGORY_STORM,
}

EVENT_CATEGORIES = [CATEGORY_KILL, CATEGORY_DEATH, CATEGORY_LOOT, CATEGORY_STORM]


def folder_to_date(folder: str) -> str:
    """'February_10' -> '2026-02-10' (ISO date derived from the day folder).

    We derive the date from the folder name because the `ts` column is a
    relative in-match ordering axis, not a wall-clock date.
    """
    _, day = folder.split("_")
    return f"{DATA_YEAR}-02-{int(day):02d}"


def is_bot(user_id: str) -> bool:
    """Bots have short numeric user_ids; humans have UUIDs."""
    return user_id.isdigit()
