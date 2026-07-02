"""Tests for matches.py — match reconstruction, rebasing, and projection.

Everything is built from in-memory PlayerFile objects: fast, deterministic,
no parquet on disk.
"""

from src.reader import EventRow, PlayerFile
from src.matches import build_match, group_by_match


def _pf(user_id, match_id, rows, map_id="AmbroseValley"):
    """Helper: construct a PlayerFile from (ts, x, y, z, event) tuples."""
    return PlayerFile(
        user_id=user_id,
        match_id=match_id,
        map_id=map_id,
        is_bot=user_id.isdigit(),
        rows=[EventRow(ts, x, y, z, ev) for (ts, x, y, z, ev) in rows],
        source=f"{user_id}_{match_id}",
    )


def test_group_by_match_buckets_by_match_id():
    a = _pf("u1", "m1", [(0, 0, 0, 0, "Position")])
    b = _pf("u2", "m1", [(0, 0, 0, 0, "Position")])
    c = _pf("u3", "m2", [(0, 0, 0, 0, "Position")])
    groups = group_by_match([a, b, c])
    assert set(groups) == {"m1", "m2"}
    assert len(groups["m1"]) == 2 and len(groups["m2"]) == 1


def test_build_match_rebases_to_shared_zero():
    # Two players with DIFFERENT absolute timestamps must share one clock.
    p1 = _pf("u1", "m1", [(1000, 0, 0, 0, "Position"), (1200, 0, 0, 0, "Position")])
    p2 = _pf("u2", "m1", [(1100, 0, 0, 0, "Position"), (1500, 0, 0, 0, "Position")])
    match = build_match("m1", [p1, p2], "2026-02-10")
    assert match.start_ts == 0
    assert match.end_ts == 500  # 1500 - 1000 (global min)
    # Player 1's first sample is at the global start -> 0; player 2's first -> 100.
    assert match.players[0].path[0].ts == 0
    assert match.players[1].path[0].ts == 100


def test_build_match_splits_path_and_events():
    p = _pf("u1", "m1", [
        (0, 0, 0, 0, "Position"),
        (10, 0, 0, 0, "Loot"),
        (20, 0, 0, 0, "BotKill"),
        (30, 0, 0, 0, "Position"),
    ])
    match = build_match("m1", [p], "2026-02-10")
    player = match.players[0]
    assert len(player.path) == 2                       # two Position samples
    cats = {(e.category, e.raw) for e in player.events}
    assert cats == {("loot", "Loot"), ("kill", "BotKill")}  # BotKill folds into "kill"


def test_build_match_projects_coordinates():
    # README worked example on AmbroseValley -> pixel (~78, ~890).
    p = _pf("u1", "m1", [(0, -301.45, 124.97, -355.55, "Position")])
    match = build_match("m1", [p], "2026-02-10")
    pt = match.players[0].path[0]
    assert abs(pt.px - 78) < 1
    assert abs(pt.py - 890) < 1


def test_build_match_unknown_map_returns_none():
    p = _pf("u1", "m1", [(0, 0, 0, 0, "Position")], map_id="NopeLand")
    assert build_match("m1", [p], "2026-02-10") is None


def test_build_match_merges_same_player_across_files():
    # One player's journey split across two files (e.g. day-boundary straddle)
    # must reconstruct as ONE player with a combined, time-ordered path.
    f1 = _pf("u1", "m1", [(0, 0, 0, 0, "Position"), (100, 0, 0, 0, "Position")])
    f2 = _pf("u1", "m1", [(50, 0, 0, 0, "Position"), (150, 0, 0, 0, "Loot")])
    match = build_match("m1", [f1, f2], "2026-02-10")
    assert len(match.players) == 1                      # merged, not duplicated
    player = match.players[0]
    assert [p.ts for p in player.path] == [0, 50, 100]  # interleaved & sorted
    assert [e.ts for e in player.events] == [150]


def test_build_match_skips_unknown_event():
    p = _pf("u1", "m1", [(0, 0, 0, 0, "Position"), (5, 0, 0, 0, "Teleported")])
    match = build_match("m1", [p], "2026-02-10")
    assert len(match.players[0].path) == 1
    assert match.players[0].events == []  # unknown event dropped, run survives
