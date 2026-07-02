"""
Final ETL audit — adversarial verification of generated artifacts.

Checks the 10 freeze-readiness criteria by comparing the generated JSON DIRECTLY
against the raw parquet (bypassing our own reader where possible), and by
reconciling the manifest summary against the per-match detail files.

Run:  etl/.venv/Scripts/python.exe audit.py   (from the etl/ directory)
"""

from __future__ import annotations

import glob
import gzip
import json
from collections import Counter
from pathlib import Path

import pyarrow.parquet as pq

from src.config import (
    DAY_FOLDERS, MAPS, MINIMAP_SIZE, OUTPUT_DIR, POSITION_EVENTS,
    RAW_DATA_DIR, RAW_EVENT_TO_CATEGORY,
)

SIZE = MINIMAP_SIZE
results: list[tuple[str, bool, str]] = []


def check(name: str, passed: bool, detail: str = "") -> None:
    results.append((name, passed, detail))


# ── Scan RAW parquet directly (independent of our reader) ─────────
def scan_raw():
    pairs: Counter[tuple[str, str]] = Counter()
    events: Counter[str] = Counter()
    positions = 0
    for folder in DAY_FOLDERS:
        d = RAW_DATA_DIR / folder
        if not d.is_dir():
            continue
        for p in d.iterdir():
            if not p.is_file():
                continue
            t = pq.read_table(p, columns=["user_id", "match_id", "event"])
            uid = str(t.column("user_id")[0].as_py())
            mid = str(t.column("match_id")[0].as_py()).removesuffix(".nakama-0")
            pairs[(mid, uid)] += 1
            for e in t.column("event").to_pylist():
                e = e.decode() if isinstance(e, (bytes, bytearray)) else e
                if e in POSITION_EVENTS:
                    positions += 1
                else:
                    events[e] += 1
    return pairs, events, positions


# ── Scan generated OUTPUT ─────────────────────────────────────────
def scan_output():
    out = {
        "pairs": Counter(), "cat_events": Counter(), "points": 0,
        "path_unordered": 0, "events_unordered": 0,
        "coords_total": 0, "coords_out": 0,
        "px_min": 1e9, "px_max": -1e9, "py_min": 1e9, "py_max": -1e9,
        "maps_used": set(), "bad_matches": [], "parquet_leaks": [],
        "recompute": {},  # matchId -> summary recomputed from detail
    }
    for f in glob.glob(str(OUTPUT_DIR / "matches" / "*.json")):
        d = json.loads(Path(f).read_text(encoding="utf-8"))
        mid = d["matchId"]
        out["maps_used"].add(d["mapId"])

        # #2 structural sanity
        if not d["players"] or d["mapId"] not in MAPS or d["startTs"] != 0 or d["endTs"] < 0:
            out["bad_matches"].append(mid)
        # #10 no parquet internals leaking into the wire format
        if ".nakama-0" in mid or not isinstance(d["endTs"], int):
            out["parquet_leaks"].append(mid)

        humans = bots = pts = 0
        cats = Counter()
        for pl in d["players"]:
            out["pairs"][(mid, pl["userId"])] += 1
            bots += pl["isBot"]; humans += not pl["isBot"]
            pts += len(pl["path"]); out["points"] += len(pl["path"])

            ts = [pt[0] for pt in pl["path"]]
            if ts != sorted(ts):
                out["path_unordered"] += 1
            et = [e["t"] for e in pl["events"]]
            if et != sorted(et):
                out["events_unordered"] += 1

            for pt in pl["path"]:
                _bounds(out, pt[1], pt[2])
                if not isinstance(pt[0], int):
                    out["parquet_leaks"].append(mid)
            for e in pl["events"]:
                cats[e["cat"]] += 1; out["cat_events"][e["cat"]] += 1
                _bounds(out, e["px"], e["py"])
                if e["raw"].startswith("b'") or e["raw"].startswith("b\""):
                    out["parquet_leaks"].append(mid)

        out["recompute"][mid] = {
            "humanCount": humans, "botCount": bots, "pointCount": pts,
            "eventCounts": {c: cats.get(c, 0) for c in ("kill", "death", "loot", "storm")},
            "durationMs": d["endTs"],
        }
    return out


def _bounds(out, px, py):
    out["coords_total"] += 1
    out["px_min"] = min(out["px_min"], px); out["px_max"] = max(out["px_max"], px)
    out["py_min"] = min(out["py_min"], py); out["py_max"] = max(out["py_max"], py)
    if px < 0 or px > SIZE or py < 0 or py > SIZE:
        out["coords_out"] += 1


def main():
    manifest = json.loads((OUTPUT_DIR / "manifest.json").read_text(encoding="utf-8"))
    raw_pairs, raw_events, raw_positions = scan_raw()
    out = scan_output()

    # 1. Every parquet file represented exactly once.
    # Files sharing (match,user) are merged into one player, so we verify at the
    # set level (every player present, none extra) AND the row-total level (every
    # row present exactly once — no duplication or loss).
    out_rows = out["points"] + sum(out["cat_events"].values())
    raw_rows = raw_positions + sum(raw_events.values())
    merged = sum(v - 1 for v in raw_pairs.values() if v > 1)
    check("1. Each parquet file represented exactly once",
          set(out["pairs"]) == set(raw_pairs) and out_rows == raw_rows,
          f"player-pair sets equal={set(out['pairs']) == set(raw_pairs)}; "
          f"total rows out/raw={out_rows}/{raw_rows}; "
          f"files={sum(raw_pairs.values())} -> players={len(raw_pairs)} "
          f"({merged} multi-file player merged)")

    # 2. Every match reconstructs correctly (structure + manifest reconciliation)
    mismatches = [m["matchId"] for m in manifest["matches"]
                  if out["recompute"].get(m["matchId"]) != {
                      "humanCount": m["humanCount"], "botCount": m["botCount"],
                      "pointCount": m["pointCount"], "eventCounts": m["eventCounts"],
                      "durationMs": m["durationMs"]}]
    check("2. Every match reconstructs correctly (manifest==detail)",
          not out["bad_matches"] and not mismatches and len(manifest["matches"]) == len(out["recompute"]),
          f"bad_structure={len(out['bad_matches'])}, manifest/detail_mismatches={len(mismatches)}, "
          f"match_files={len(out['recompute'])}")

    # 3. Every player path chronologically ordered
    check("3. Paths & events chronologically ordered",
          out["path_unordered"] == 0 and out["events_unordered"] == 0,
          f"unordered paths={out['path_unordered']}, unordered event lists={out['events_unordered']}")

    # 4. Coordinate mapping within minimap bounds
    inside = out["coords_total"] - out["coords_out"]
    frac = 100 * inside / out["coords_total"]
    gross = min(out["px_min"], out["py_min"]) < -SIZE or max(out["px_max"], out["py_max"]) > 2 * SIZE
    check("4. Coordinates within minimap bounds (no gross violations)",
          frac > 95.0 and not gross,
          f"inside[0,{SIZE}]={frac:.2f}% ({out['coords_out']} of {out['coords_total']} out), "
          f"px[{out['px_min']:.0f},{out['px_max']:.0f}] py[{out['py_min']:.0f},{out['py_max']:.0f}]")

    # 5. Event counts reconcile with source
    exp_cat = Counter()
    for ev, n in raw_events.items():
        exp_cat[RAW_EVENT_TO_CATEGORY[ev]] += n
    check("5. Event counts reconcile with raw parquet",
          out["points"] == raw_positions
          and sum(out["cat_events"].values()) == sum(raw_events.values())
          and out["cat_events"] == exp_cat,
          f"points out/raw={out['points']}/{raw_positions}; "
          f"events out/raw={sum(out['cat_events'].values())}/{sum(raw_events.values())}; "
          f"by_cat={dict(out['cat_events'])} expected={dict(exp_cat)}")

    # 6. Manifest completeness
    map_keys_ok = all(set(cfg) >= {"scale", "originX", "originZ", "image", "size"}
                      for cfg in manifest["maps"].values())
    files_exist = all((OUTPUT_DIR / "matches" / f"{m['matchId']}.json").exists()
                      for m in manifest["matches"])
    maps_covered = out["maps_used"] <= set(manifest["maps"])
    fields_ok = all({"matchId", "mapId", "date", "humanCount", "botCount",
                     "eventCounts", "pointCount", "durationMs"} <= set(m)
                    for m in manifest["matches"])
    check("6. Manifest contains everything the frontend needs",
          map_keys_ok and files_exist and maps_covered and fields_ok
          and len(manifest["dates"]) == 5 and len(manifest["maps"]) == 3,
          f"map_cfg_ok={map_keys_ok}, all_match_files_exist={files_exist}, "
          f"maps_covered={maps_covered}, entry_fields_ok={fields_ok}, dates={len(manifest['dates'])}")

    # 8. File sizes reasonable for the browser
    def gz(path: Path) -> int:
        return len(gzip.compress(path.read_bytes()))
    match_files = list((OUTPUT_DIR / "matches").glob("*.json"))
    agg_files = list((OUTPUT_DIR / "aggregate").glob("*.json"))
    biggest_match = max(match_files, key=lambda p: p.stat().st_size)
    biggest_agg = max(agg_files, key=lambda p: p.stat().st_size)
    man = OUTPUT_DIR / "manifest.json"
    check("8. Files reasonably sized for browser loading",
          biggest_match.stat().st_size < 512_000 and gz(biggest_agg) < 1_000_000 and gz(man) < 200_000,
          f"manifest={man.stat().st_size//1024}KB (gz {gz(man)//1024}KB); "
          f"biggest match={biggest_match.stat().st_size//1024}KB; "
          f"biggest aggregate={biggest_agg.stat().st_size//1024}KB (gz {gz(biggest_agg)//1024}KB)")

    # 10. No parquet internals leak into the JSON
    check("10. No parquet internals leak to the frontend",
          not out["parquet_leaks"],
          f"leaks(bytes-literals / .nakama-0 / non-int ts)={len(set(out['parquet_leaks']))}")

    # ── Report ────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("FINAL ETL AUDIT")
    print("=" * 70)
    allpass = True
    for name, passed, detail in results:
        allpass &= passed
        print(f"[{'PASS' if passed else 'FAIL'}] {name}")
        if detail:
            print(f"        {detail}")
    print("=" * 70)
    print("VERDICT:", "ALL AUTOMATED CHECKS PASS" if allpass else "FAILURES PRESENT")
    print("=" * 70)


if __name__ == "__main__":
    main()
