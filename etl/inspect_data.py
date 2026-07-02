"""
Throwaway data-inspection script (Phase 0).

Goal: VERIFY our understanding of the raw parquet before building the ETL.
We check: schema, byte-decoding of `event`, human vs bot, timestamp behaviour,
event-type distribution, coordinate ranges, and the README's worked coordinate
example. If any assumption is wrong, we want to know NOW — not after building a UI.

Run:  etl/.venv/Scripts/python.exe etl/inspect_data.py
"""

from pathlib import Path
import pyarrow.parquet as pq

# Raw data lives beside the project (provided separately, never committed).
RAW = Path(__file__).resolve().parent.parent.parent / "player_data"


def read_file(path: Path):
    """Read one parquet file -> pandas DataFrame with `event` decoded to str."""
    df = pq.read_table(path).to_pandas()
    # `event` is stored as raw bytes (e.g. b'Position'); decode to plain text.
    df["event"] = df["event"].apply(lambda v: v.decode("utf-8") if isinstance(v, (bytes, bytearray)) else v)
    return df


def show_one(label: str, path: Path):
    df = read_file(path)
    print(f"\n===== {label}: {path.name[:40]}... =====")
    print("shape:", df.shape)
    print("dtypes:\n", df.dtypes)
    print("event value counts:\n", df["event"].value_counts())
    print("ts range:", df["ts"].min(), "->", df["ts"].max())
    print("x range:", round(df["x"].min(), 1), "->", round(df["x"].max(), 1))
    print("z range:", round(df["z"].min(), 1), "->", round(df["z"].max(), 1))
    print("first row:\n", df.iloc[0])
    return df


def verify_coord_example():
    """README worked example: AmbroseValley, scale=900, origin=(-370,-473).
    World (x=-301.45, z=-355.55) should map to pixel (~78, ~890)."""
    scale, ox, oz = 900, -370, -473
    x, z = -301.45, -355.55
    u = (x - ox) / scale
    v = (z - oz) / scale
    px = u * 1024
    py = (1 - v) * 1024
    print("\n===== coordinate conversion check =====")
    print(f"world (x={x}, z={z}) -> pixel ({px:.1f}, {py:.1f})   [README expects ~78, ~890]")
    assert abs(px - 78) < 2 and abs(py - 890) < 2, "Coordinate formula mismatch!"
    print("OK: formula matches README.")


def main():
    feb10 = RAW / "February_10"
    files = sorted(feb10.iterdir())
    # A UUID-named file = human; a numeric-prefixed file = bot.
    human = next(f for f in files if f.name[:8].count("-") == 0 and len(f.name.split("_")[0]) == 36)
    bot = next(f for f in files if f.name.split("_")[0].isdigit())

    show_one("HUMAN", human)
    show_one("BOT", bot)
    verify_coord_example()
    print("\nDone. Assumptions verified.")


if __name__ == "__main__":
    main()
