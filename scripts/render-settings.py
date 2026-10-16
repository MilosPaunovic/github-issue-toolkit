#!/usr/bin/env python3
"""Render docs/settings-dark.png and docs/settings-light.png from options.html.

The page is rendered in preview mode (no extension APIs), with the icons inlined and the dark or light
palette forced, at 900 px wide on a tall canvas that is then cut just below the last card, so a new setting
never pushes the buttons out of the picture. Requires Google Chrome (headless) and Pillow.

Usage: python3 scripts/render-settings.py
"""
import base64
import re
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
HEIGHT = 6000
PAD = 40


def trim_bottom(path: Path) -> None:
    im = Image.open(path).convert("RGB")
    bg = im.getpixel((2, im.height - 2))
    box = ImageChops.difference(im, Image.new("RGB", im.size, bg)).convert("L").point(lambda v: 255 if v > 8 else 0).getbbox()
    if box:
        im.crop((0, 0, im.width, min(im.height, box[3] + PAD))).save(path)


def main() -> None:
    html = (ROOT / "options.html").read_text(encoding="utf-8")
    js = (ROOT / "options.js").read_text(encoding="utf-8")
    html = re.sub(r'src="(icons/[^"]+)"', lambda m: 'src="data:image/png;base64,' + base64.b64encode((ROOT / m.group(1)).read_bytes()).decode() + '"', html)
    page = html.replace('<script src="options.js"></script>', "<script>" + js + "</script>")
    variants = {
        "dark": page.replace("@media (prefers-color-scheme: dark)", "@media all"),
        "light": page.replace("prefers-color-scheme: dark", "prefers-color-scheme: forced-light"),
    }
    with tempfile.TemporaryDirectory() as tmp:
        for theme, doc in variants.items():
            src = Path(tmp) / f"settings-{theme}.html"
            src.write_text(doc, encoding="utf-8")
            out = ROOT / "docs" / f"settings-{theme}.png"
            subprocess.run(["google-chrome", "--headless=new", "--no-sandbox", "--hide-scrollbars", f"--window-size=900,{HEIGHT}",
                            f"--screenshot={out}", src.as_uri()], check=True, capture_output=True, timeout=90)
            trim_bottom(out)
            print(f"wrote {out.relative_to(ROOT)} {Image.open(out).size}")


if __name__ == "__main__":
    main()
