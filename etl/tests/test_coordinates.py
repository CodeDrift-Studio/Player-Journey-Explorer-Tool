"""Unit tests for the world->pixel conversion — the one calculation that must
be correct or every plotted point is wrong."""

from src.config import MAPS
from src.coordinates import world_to_pixel


def test_readme_worked_example():
    """The exact example from the README:
    AmbroseValley, world (-301.45, -355.55) -> pixel (~78, ~890)."""
    px, py = world_to_pixel(-301.45, -355.55, MAPS["AmbroseValley"])
    assert abs(px - 78) < 1
    assert abs(py - 890) < 1


def test_origin_maps_to_bottom_left():
    """World origin -> UV (0,0) -> pixel (0, size). Y is flipped, so v=0 is the
    BOTTOM of the image (py = size)."""
    cfg = MAPS["Lockdown"]  # scale 1000, origin (-500, -500)
    px, py = world_to_pixel(cfg.origin_x, cfg.origin_z, cfg)
    assert px == 0
    assert py == cfg.size


def test_far_corner_maps_to_top_right():
    """World (origin + scale) -> UV (1,1) -> pixel (size, 0)."""
    cfg = MAPS["Lockdown"]
    px, py = world_to_pixel(cfg.origin_x + cfg.scale, cfg.origin_z + cfg.scale, cfg)
    assert px == cfg.size
    assert py == 0


def test_offmap_point_is_not_clamped():
    """A point beyond the map must yield out-of-range pixels (real signal),
    not be silently clamped."""
    cfg = MAPS["GrandRift"]
    px, py = world_to_pixel(cfg.origin_x - cfg.scale, cfg.origin_z, cfg)
    assert px < 0  # u = -1 -> px negative
