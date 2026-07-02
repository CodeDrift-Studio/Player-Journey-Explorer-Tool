"""Tests for serialize.py — domain -> JSON shaping and file writing."""

import json

from src.matches import Match, MatchPlayer, PathPoint, MatchEvent
from src.serialize import (
    match_to_dict, manifest_entry, build_manifest, build_aggregate,
    write_json, serialize_all,
)


def _match(match_id="m1", map_id="AmbroseValley", date="2026-02-10"):
    human = MatchPlayer(
        user_id="uuid-1", is_bot=False,
        path=[PathPoint(0, 10.0, 20.0), PathPoint(50, 11.0, 21.0)],
        events=[MatchEvent(30, "loot", "Loot", 10.5, 20.5),
                MatchEvent(40, "kill", "BotKill", 12.0, 22.0)],
    )
    bot = MatchPlayer(
        user_id="1440", is_bot=True,
        path=[PathPoint(0, 5.0, 5.0)], events=[],
    )
    return Match(match_id, map_id, date, start_ts=0, end_ts=50, players=[human, bot])


def test_match_to_dict_uses_camelcase_and_tuple_paths():
    d = match_to_dict(_match())
    assert d["matchId"] == "m1" and d["endTs"] == 50
    player = d["players"][0]
    assert player["userId"] == "uuid-1" and player["isBot"] is False
    assert player["path"] == [[0, 10.0, 20.0], [50, 11.0, 21.0]]  # compact tuples
    assert player["events"][0] == {"t": 30, "cat": "loot", "raw": "Loot", "px": 10.5, "py": 20.5}


def test_manifest_entry_counts():
    e = manifest_entry(_match())
    assert e["humanCount"] == 1 and e["botCount"] == 1
    assert e["pointCount"] == 3               # 2 human + 1 bot path points
    assert e["eventCounts"] == {"kill": 1, "death": 0, "loot": 1, "storm": 0}
    assert e["durationMs"] == 50


def test_build_manifest_includes_maps_dates_and_ranks_by_richness():
    rich = _match("rich")                                    # 2 players, 2 events
    thin = Match("thin", "Lockdown", "2026-02-11", 0, 0,
                 [MatchPlayer("u", False, [PathPoint(0, 0.0, 0.0)], [])])
    manifest = build_manifest([thin, rich])
    assert manifest["dates"] == ["2026-02-10", "2026-02-11"]
    assert manifest["maps"]["AmbroseValley"]["originX"] == -370   # camelCase config
    assert manifest["matches"][0]["matchId"] == "rich"           # richest first


def test_build_aggregate_flattens_all_players():
    agg = build_aggregate("AmbroseValley", "2026-02-10", [_match()])
    assert len(agg["points"]) == 3                 # all path points flattened
    assert len(agg["events"]) == 2
    assert agg["points"][0] == [10.0, 20.0]


def test_serialize_all_writes_files(tmp_path):
    summary = serialize_all([_match()], output_dir=tmp_path)
    assert summary["matches"] == 1 and summary["aggregates"] == 1
    # manifest is valid, compact JSON on disk
    manifest = json.loads((tmp_path / "manifest.json").read_text())
    assert manifest["matches"][0]["matchId"] == "m1"
    # per-match and aggregate files exist and round-trip
    assert (tmp_path / "matches" / "m1.json").exists()
    agg = json.loads((tmp_path / "aggregate" / "AmbroseValley_2026-02-10.json").read_text())
    assert agg["mapId"] == "AmbroseValley"
