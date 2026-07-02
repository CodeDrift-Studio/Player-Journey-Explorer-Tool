"""Phase 0: global scan across all days to validate scale & inform UX."""
from pathlib import Path
from collections import Counter, defaultdict
import pyarrow.parquet as pq

RAW = Path(__file__).resolve().parent.parent.parent / "player_data"
DAYS = ["February_10", "February_11", "February_12", "February_13", "February_14"]


def main():
    total_files = total_rows = 0
    match_files = defaultdict(int)      # match_id -> #files
    match_map = {}                      # match_id -> map_id
    events = Counter()
    per_map_matches = defaultdict(set)

    for day in DAYS:
        folder = RAW / day
        for f in folder.iterdir():
            total_files += 1
            stem = f.name.replace(".nakama-0", "")
            match_id = stem.split("_", 1)[1]
            match_files[match_id] += 1
            # Read only the columns we need for stats (fast)
            t = pq.read_table(f, columns=["map_id", "event"])
            total_rows += t.num_rows
            m = t.column("map_id")[0].as_py()
            match_map[match_id] = m
            per_map_matches[m].add(match_id)
            for v in t.column("event").to_pylist():
                events[v.decode() if isinstance(v, (bytes, bytearray)) else v] += 1

    fc = Counter(match_files.values())
    print("total files:", total_files, " total rows:", total_rows)
    print("unique matches:", len(match_files))
    print("files-per-match distribution (files: #matches):", dict(sorted(fc.items())))
    print("matches with >1 file:", sum(1 for v in match_files.values() if v > 1))
    print("matches per map:", {k: len(v) for k, v in per_map_matches.items()})
    print("event totals:", dict(events.most_common()))


if __name__ == "__main__":
    main()
