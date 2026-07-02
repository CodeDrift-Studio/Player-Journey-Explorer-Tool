"""Phase 0 deep-dive: understand `ts` and full-match reconstruction."""
from pathlib import Path
from collections import defaultdict
import pyarrow.parquet as pq
import pandas as pd

RAW = Path(__file__).resolve().parent.parent.parent / "player_data"


def read_raw(path: Path) -> pd.DataFrame:
    df = pq.read_table(path).to_pandas()
    df["event"] = df["event"].apply(lambda v: v.decode() if isinstance(v, (bytes, bytearray)) else v)
    return df


def main():
    feb10 = RAW / "February_10"
    files = list(feb10.iterdir())

    # Group files by match_id (parsed from filename: {user}_{match}.nakama-0)
    by_match = defaultdict(list)
    for f in files:
        stem = f.name.replace(".nakama-0", "")
        match_id = stem.split("_", 1)[1]  # everything after first underscore
        by_match[match_id].append(f)

    print(f"Feb10: {len(files)} files across {len(by_match)} matches")
    sizes = sorted(((len(v), k) for k, v in by_match.items()), reverse=True)
    print("largest matches (file_count, match_id):", sizes[:5])

    # Reconstruct the biggest match
    _, big = sizes[0]
    frames = [read_raw(f) for f in by_match[big]]
    match = pd.concat(frames, ignore_index=True)
    match = match.sort_values("ts")

    # datetime64[ms] -> int64 is ALREADY milliseconds since epoch (no /1e6!)
    ts_int = match["ts"].astype("int64")
    ts_int = ts_int - ts_int.min()  # rebase to match start = 0 for readability
    print(f"\n=== MATCH {big[:12]} ===")
    print("players (files):", len(by_match[big]))
    print("humans:", match[~match.user_id.str.isdigit()].user_id.nunique(),
          " bots:", match[match.user_id.str.isdigit()].user_id.nunique())
    print("rows:", len(match))
    print("map:", match.map_id.unique())
    print("event distribution:\n", match.event.value_counts())
    print("ts raw ms   min:", ts_int.min(), " max:", ts_int.max(),
          " span_ms:", ts_int.max() - ts_int.min())
    print("ts span seconds:", (ts_int.max() - ts_int.min()) / 1000)
    print("distinct ts count:", ts_int.nunique(), "of", len(ts_int), "rows")
    uniq = sorted(ts_int.unique())
    print("first 15 rebased ts (ms):", uniq[:15])
    print("last 5 rebased ts (ms):", uniq[-5:])
    deltas = [b - a for a, b in zip(uniq, uniq[1:])]
    if deltas:
        print("ts gaps ms  min/median/max:", min(deltas),
              sorted(deltas)[len(deltas)//2], max(deltas))
    # per-player span
    for uid, g in list(match.groupby("user_id"))[:3]:
        gi = g["ts"].astype("int64"); gi = gi - gi.min()
        print(f"  player {uid[:8]}: rows={len(g)} span_ms={gi.max()} events={list(g.event.unique())}")


if __name__ == "__main__":
    main()
