#!/usr/bin/env python3
"""Render the example mock-ups of docs/index.html to PNGs used by the README.

For every element with an id starting with "ex-", a light and a dark PNG are written to docs/example-<name>-<theme>.png.
Requires Google Chrome (headless) and Pillow.

Usage: python3 scripts/render-examples.py
"""
import re
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
WIDTHS = {"ex-sub": 640, "ex-table": 900, "ex-board": 760, "ex-age": 680, "ex-pulls": 820, "ex-palette": 760, "ex-pins": 420}
CHROME = "google-chrome"


def fragment(html: str, id_: str) -> str:
    start = re.search(rf'<div class="[^"]*" id="{id_}"[^>]*>', html).start()
    depth = 0
    for tag in re.finditer(r"<(/?)div\b[^>]*>", html[start:]):
        depth += -1 if tag.group(1) else 1
        if depth == 0:
            return html[start:start + tag.end()]
    raise SystemExit(f"unbalanced markup in {id_}")


def trim(path: Path, pad: int = 24) -> None:
    im = Image.open(path).convert("RGB")
    bg = im.getpixel((2, 2))
    box = ImageChops.difference(im, Image.new("RGB", im.size, bg)).convert("L").point(lambda v: 255 if v > 8 else 0).getbbox()
    if box:
        im.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad))).save(path)


def main() -> None:
    html = (ROOT / "docs/index.html").read_text(encoding="utf-8")
    style = re.search(r"<style>(.*?)</style>", html, re.S).group(1)
    with tempfile.TemporaryDirectory() as tmp:
        for id_, width in WIDTHS.items():
            frag = fragment(html, id_)
            for theme in ("light", "dark"):
                page = Path(tmp) / f"{id_}-{theme}.html"
                page.write_text(
                    f'<!doctype html><html data-theme="{theme}"><head><meta charset="utf-8"><style>{style}\n'
                    f"body {{ padding: 16px; width: {width}px; box-sizing: content-box; }}</style></head><body>{frag}</body></html>",
                    encoding="utf-8",
                )
                out = ROOT / "docs" / f"example-{id_[3:]}-{theme}.png"
                subprocess.run(
                    [CHROME, "--headless=new", "--no-sandbox", "--hide-scrollbars", f"--window-size={width + 32},1000",
                     "--force-device-scale-factor=2", f"--screenshot={out}", page.as_uri()],
                    check=True, capture_output=True, timeout=90,
                )
                trim(out)
                print(f"wrote {out.relative_to(ROOT)} {Image.open(out).size}")


if __name__ == "__main__":
    main()
