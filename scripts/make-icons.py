#!/usr/bin/env python3
"""Regenerate the extension icons (the "priority ladder" icon).

Naming: icon-<theme>-<size>.png, theme is "dark" or "light".

- icons/icon-dark-{16,32,48,128}.png   used by the manifests (toolbar, stores) and the settings page in dark mode
- icons/icon-light-{16,32,48,128}.png  used by the settings page in light mode
- docs/icon-{dark,light}-{32,48,128}.png  copies for the GitHub Pages site

Usage: python3 scripts/make-icons.py   (requires Pillow: pip install pillow)
"""
from pathlib import Path

from PIL import Image, ImageDraw

SUPERSAMPLE = 8
DARK_TILE = (33, 38, 45, 255)
DARK_EDGE = (48, 54, 61, 255)
LIGHT_TILE = (234, 238, 242, 255)
LIGHT_EDGE = (208, 215, 222, 255)
BARS = [  # (relative width, colour) top to bottom
    (0.68, (248, 81, 73, 255)),
    (0.54, (219, 109, 40, 255)),
    (0.40, (154, 103, 0, 255)),
]


def draw(size: int, light: bool) -> Image.Image:
    w = size * SUPERSAMPLE
    img = Image.new("RGBA", (w, w), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    tile, edge = (LIGHT_TILE, LIGHT_EDGE) if light else (DARK_TILE, DARK_EDGE)
    d.rounded_rectangle([0, 0, w - 1, w - 1], radius=w * 0.22, fill=tile, outline=edge, width=max(1, w // 64))
    for i, (width, colour) in enumerate(BARS):
        y0 = w * (0.22 + i * 0.21)
        d.rounded_rectangle([w * 0.16, y0, w * (0.16 + width), y0 + w * 0.14], radius=w * 0.07, fill=colour)
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    icons, docs = root / "icons", root / "docs"
    icons.mkdir(exist_ok=True)
    for theme, light in (("dark", False), ("light", True)):
        for size in (16, 32, 48, 128):
            draw(size, light).save(icons / f"icon-{theme}-{size}.png")
        for size in (32, 48, 128):
            draw(size, light).save(docs / f"icon-{theme}-{size}.png")
    print("icons written to icons/ and docs/")


if __name__ == "__main__":
    main()
