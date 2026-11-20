#!/usr/bin/env python3
"""Builds a preview of the judge's contact sheet from screenshots/: the cover (first by name) fitted inside
768x480 on top, the other shots in smaller cells in a row beneath it, never enlarged.
Writes /tmp/trophy-contact-sheet.jpg (outside the repository). Usage: python3 tools/contactSheet.py"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/trophy-contact-sheet.jpg")
SHEET_W, COVER_BOX, GAP, CELL_H = 1000, (768, 480), 12, 210


def fit(img, box):
    """Scale down (never up) to fit inside box, keeping the aspect ratio."""
    scale = min(box[0] / img.width, box[1] / img.height, 1.0)
    return img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)


def build():
    shots = sorted(p for p in (ROOT / "screenshots").iterdir() if p.suffix.lower() in (".jpg", ".jpeg", ".png") and not p.name.startswith("."))
    if not shots:
        sys.exit("no screenshots found")
    images = [Image.open(p).convert("RGB") for p in shots]
    cover = fit(images[0], COVER_BOX)
    rest = images[1:]
    cell_w = (SHEET_W - GAP * (len(rest) + 1)) // max(1, len(rest))
    cells = [fit(img, (cell_w, CELL_H)) for img in rest]
    height = GAP + cover.height + (GAP + max(c.height for c in cells) if cells else 0) + GAP
    sheet = Image.new("RGB", (SHEET_W, height), "white")
    sheet.paste(cover, ((SHEET_W - cover.width) // 2, GAP))
    y = GAP * 2 + cover.height
    for i, cell in enumerate(cells):
        x = GAP + i * (cell_w + GAP) + (cell_w - cell.width) // 2
        sheet.paste(cell, (x, y))
    sheet.save(OUT, "JPEG", quality=88)
    print(f"{OUT}: {sheet.width}x{sheet.height}, cover {cover.width}x{cover.height}, cells {[c.size for c in cells]}")


if __name__ == "__main__":
    build()
