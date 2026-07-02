"""
Prepare minimap images for the web.

Source minimaps are huge (4320²–9000²). The coordinate system treats the map as
a 1024×1024 image (see README / coordinates.py), and that's the display size, so
we downscale to 1024×1024 and recompress. Outputs use the SAME filenames the
manifest references (config.MAPS[*].image), so no ETL change is needed.

Run:  etl/.venv/Scripts/python.exe prepare_minimaps.py   (from etl/)
"""

from pathlib import Path

from PIL import Image

from src.config import MAPS, MINIMAP_SIZE, OUTPUT_DIR, RAW_DATA_DIR

SRC = RAW_DATA_DIR / "minimaps"
OUT = OUTPUT_DIR.parent / "minimaps"  # web/public/minimaps


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for cfg in MAPS.values():
        src = SRC / cfg.image
        img = Image.open(src).convert("RGB")  # flatten alpha; backdrop is opaque
        before = src.stat().st_size // 1024

        if img.size != (MINIMAP_SIZE, MINIMAP_SIZE):
            img = img.resize((MINIMAP_SIZE, MINIMAP_SIZE), Image.LANCZOS)

        dst = OUT / cfg.image
        if dst.suffix.lower() in (".jpg", ".jpeg"):
            img.save(dst, quality=85, optimize=True)
        else:
            img.save(dst, optimize=True)

        after = dst.stat().st_size // 1024
        print(f"{cfg.image}: {before}KB -> {after}KB  ({MINIMAP_SIZE}x{MINIMAP_SIZE})")


if __name__ == "__main__":
    main()
