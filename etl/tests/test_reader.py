"""Tests for reader.py.

The pure transform (_normalize) is tested with in-memory DataFrames — no disk,
fast, deterministic. The I/O wrapper's error handling is tested with a junk file.
"""

import pandas as pd
import pytest

from src.reader import _normalize, read_player_file


def _make_df(user_id: str, events, ts_ms):
    """Build a raw-ish DataFrame mimicking what pyarrow.to_pandas() yields:
    bytes `event`, datetime64[ms] `ts`."""
    n = len(events)
    return pd.DataFrame({
        "user_id": [user_id] * n,
        "match_id": ["abc-123.nakama-0"] * n,
        "map_id": ["AmbroseValley"] * n,
        "x": [1.0] * n,
        "y": [2.0] * n,
        "z": [3.0] * n,
        "ts": pd.to_datetime(ts_ms, unit="ms"),
        "event": events,  # bytes, like the real column
    })


def test_normalize_decodes_bytes_and_types_rows():
    df = _make_df("f4e072fa-uuid", [b"Position", b"Loot"], [0, 500])
    pf = _normalize(df, "sample")
    assert [r.event for r in pf.rows] == ["Position", "Loot"]
    assert pf.rows[0].x == 1.0 and pf.rows[0].z == 3.0
    assert isinstance(pf.rows[0].ts, int)


def test_normalize_strips_match_suffix():
    pf = _normalize(_make_df("uuid", [b"Position"], [0]), "sample")
    assert pf.match_id == "abc-123"  # ".nakama-0" removed


def test_normalize_recovers_integer_milliseconds():
    # ts stored as datetime near epoch must round-trip back to the ms integers.
    pf = _normalize(_make_df("uuid", [b"Position", b"Position"], [1000, 1699]), "s")
    assert pf.rows[0].ts == 1000
    assert pf.rows[1].ts == 1699


def test_normalize_classifies_bot_by_numeric_id():
    assert _normalize(_make_df("1440", [b"BotPosition"], [0]), "s").is_bot is True
    assert _normalize(_make_df("f4e0-uuid", [b"Position"], [0]), "s").is_bot is False


def test_normalize_raises_on_missing_columns():
    bad = pd.DataFrame({"user_id": ["x"], "event": [b"Position"]})
    with pytest.raises(ValueError, match="missing columns"):
        _normalize(bad, "bad")


def test_read_unreadable_file_returns_none(tmp_path):
    junk = tmp_path / "not_parquet.nakama-0"
    junk.write_bytes(b"this is definitely not a parquet file")
    assert read_player_file(junk) is None  # logged + skipped, not raised
