"""
Pure world -> minimap pixel coordinate conversion.

No I/O, no pandas — just math. This isolation is deliberate: pure functions are
the easiest thing in a codebase to unit-test and reason about, and this is the
one calculation that MUST be correct or every dot lands in the wrong place.

Formula (from README), for world (x, z) on a given map:
    u = (x - origin_x) / scale          # normalize to 0..1 across the map
    v = (z - origin_z) / scale
    px = u * size
    py = (1 - v) * size                 # flip Y: image origin is top-left
"""

from __future__ import annotations

from .config import MapConfig


def world_to_pixel(x: float, z: float, cfg: MapConfig) -> tuple[float, float]:
    """Project a world (x, z) coordinate onto the map's pixel space.

    Note: we intentionally do NOT clamp to [0, size]. A point slightly off-map
    is real signal (a player near the edge / out of bounds) and clamping would
    hide it. The frontend decides how to handle out-of-range pixels.
    """
    u = (x - cfg.origin_x) / cfg.scale
    v = (z - cfg.origin_z) / cfg.scale
    px = u * cfg.size
    py = (1.0 - v) * cfg.size
    return px, py


def round_px(px: float, py: float) -> tuple[float, float]:
    """Round pixels to 1 decimal — sub-pixel precision is noise, and shorter
    numbers meaningfully shrink the emitted JSON."""
    return round(px, 1), round(py, 1)
