#!/usr/bin/env python3
"""Render docs/settings-dark.png and docs/settings-light.png from options.html.

The page is rendered in preview mode (no extension APIs), with the icons inlined and the dark or light
palette forced, at 900 px wide and tall enough to show every card. Requires Google Chrome (headless).

Usage: python3 scripts/render-settings.py
"""
import base64
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HEIGHT = 1900


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
            print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
