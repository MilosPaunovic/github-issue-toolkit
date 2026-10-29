#!/usr/bin/env python3
"""Render docs/popup-dark.png and docs/popup-light.png from popup.html.

The page is rendered in preview mode (no extension APIs, so every switch shows its default), with the icons
inlined and the dark or light palette forced, as a framed card on a plain backdrop, then cut just below the card.
Requires Google Chrome (headless) and Pillow.

Usage: python3 scripts/render-popup.py
"""
import base64
import re
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
HEIGHT = 1400
PAD = 20

FRAME = {
    "light": "html { background: #f6f8fa; } body { box-shadow: 0 8px 24px rgba(31, 35, 40, .18); }",
    "dark": "html { background: #0d1117; } body { box-shadow: 0 8px 24px rgba(0, 0, 0, .6); }",
}
COMMON = "html { padding: 20px; } body { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }"


def trim_bottom(path: Path) -> None:
    im = Image.open(path).convert("RGB")
    bg = im.getpixel((2, im.height - 2))
    box = ImageChops.difference(im, Image.new("RGB", im.size, bg)).convert("L").point(lambda v: 255 if v > 8 else 0).getbbox()
    if box:
        im.crop((0, 0, im.width, min(im.height, box[3] + PAD))).save(path)


def main() -> None:
    html = (ROOT / "popup.html").read_text(encoding="utf-8")
    js = (ROOT / "popup.js").read_text(encoding="utf-8")
    html = re.sub(r'src="(icons/[^"]+)"', lambda m: 'src="data:image/png;base64,' + base64.b64encode((ROOT / m.group(1)).read_bytes()).decode() + '"', html)
    page = html.replace('<script src="popup.js"></script>', "<script>" + js + "</script>")
    variants = {
        "dark": page.replace("@media (prefers-color-scheme: dark)", "@media all"),
        "light": page.replace("prefers-color-scheme: dark", "prefers-color-scheme: forced-light"),
    }
    with tempfile.TemporaryDirectory() as tmp:
        for theme, doc in variants.items():
            doc = doc.replace("</style>", COMMON + FRAME[theme] + "</style>", 1)
            src = Path(tmp) / f"popup-{theme}.html"
            src.write_text(doc, encoding="utf-8")
            out = ROOT / "docs" / f"popup-{theme}.png"
            subprocess.run(["google-chrome", "--headless=new", "--no-sandbox", "--hide-scrollbars", f"--window-size=382,{HEIGHT}",
                            "--force-device-scale-factor=2", f"--screenshot={out}", src.as_uri()], check=True, capture_output=True, timeout=90)
            trim_bottom(out)
            print(f"wrote {out.relative_to(ROOT)} {Image.open(out).size}")


if __name__ == "__main__":
    main()
