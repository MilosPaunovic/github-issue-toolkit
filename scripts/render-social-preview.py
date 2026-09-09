#!/usr/bin/env python3
"""Render docs/social-preview.png (1280x640), the card shown when the repository or the site is shared.

It combines the extension icon, the name and tagline, and the issue age mock-up from docs/index.html,
so it follows the site's styling. Requires Google Chrome (headless).

Usage: python3 scripts/render-social-preview.py
"""
import base64
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TAGLINE = "Custom issue fields, issue age and pinned epics on sub-issue lists and Projects views, right inside GitHub."
CHIPS = ["Chrome", "Edge", "Brave", "Firefox", "MIT"]


def fragment(html: str, id_: str) -> str:
    start = re.search(rf'<div class="[^"]*" id="{id_}"[^>]*>', html).start()
    depth = 0
    for tag in re.finditer(r"<(/?)div\b[^>]*>", html[start:]):
        depth += -1 if tag.group(1) else 1
        if depth == 0:
            return html[start:start + tag.end()]
    raise SystemExit(f"unbalanced markup in {id_}")


def main() -> None:
    html = (ROOT / "docs/index.html").read_text(encoding="utf-8")
    style = re.search(r"<style>(.*?)</style>", html, re.S).group(1)
    mock = fragment(html, "ex-age").replace('style="max-width:680px"', "")
    icon = base64.b64encode((ROOT / "icons/icon-dark-128.png").read_bytes()).decode()
    chips = "".join(f"<span>{c}</span>" for c in CHIPS)
    page = f"""<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><style>{style}
html, body {{ margin: 0; width: 1280px; height: 640px; overflow: hidden; }}
body {{ background: #0d1117; background-image: radial-gradient(70% 60% at 85% 20%, rgba(88,166,255,.14), transparent 70%), radial-gradient(50% 50% at 10% 100%, rgba(219,109,40,.14), transparent 70%); }}
.left {{ position: absolute; left: 64px; top: 0; height: 640px; width: 520px; display: flex; flex-direction: column; justify-content: center; }}
.left img {{ width: 96px; height: 96px; border-radius: 22px; box-shadow: 0 8px 24px rgba(0,0,0,.4); }}
.left h1 {{ font-size: 52px; margin: 26px 0 12px; letter-spacing: -0.02em; color: #e6edf3; line-height: 1.05; }}
.left p {{ font-size: 22px; line-height: 1.4; color: #8b949e; margin: 0 0 22px; }}
.chips {{ display: flex; gap: 8px; flex-wrap: wrap; }}
.chips span {{ font-size: 14px; font-weight: 600; color: #c9d1d9; border: 1px solid #30363d; background: #161b22; border-radius: 999px; padding: 6px 12px; }}
.mock {{ position: absolute; right: 56px; top: 50%; transform: translateY(-50%) rotate(-2deg); width: 600px; }}
.mock .panel {{ box-shadow: 0 30px 60px rgba(0,0,0,.55); }}
.mock .row {{ font-size: 15px; }}
.mock .badge {{ font-size: 13px; height: 22px; line-height: 20px; }}
</style></head><body>
<div class="left"><img src="data:image/png;base64,{icon}" alt=""><h1>GitHub Issue Toolkit</h1><p>{TAGLINE}</p><div class="chips">{chips}</div></div>
<div class="mock">{mock}</div>
</body></html>"""
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "social.html"
        src.write_text(page, encoding="utf-8")
        out = ROOT / "docs/social-preview.png"
        subprocess.run(["google-chrome", "--headless=new", "--no-sandbox", "--hide-scrollbars", "--window-size=1280,640",
                        f"--screenshot={out}", src.as_uri()], check=True, capture_output=True, timeout=90)
        print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
