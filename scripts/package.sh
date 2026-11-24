#!/usr/bin/env bash
# Builds the distributable packages one level above the repo (override with OUT_DIR=/path):
#   github-issue-toolkit-<version>-chrome.zip   (Chrome, Edge, Brave and other Chromium browsers)
#   github-issue-toolkit-<version>-firefox.zip  (Firefox, loadable via about:debugging)
# Optionally builds a signed .crx for Chromium when a key is given: scripts/package.sh /path/to/key.pem
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
version="$(python3 -c "import json;print(json.load(open('$root/manifest.json'))['version'])")"
out_dir="${OUT_DIR:-$(dirname "$root")}"
mkdir -p "$out_dir"
files=(background.js content.js content.css options.html options.js icons LICENSE README.md)

chrome_zip="$out_dir/github-issue-toolkit-${version}-chrome.zip"
rm -f "$chrome_zip"
(cd "$root" && zip -r "$chrome_zip" manifest.json "${files[@]}" >/dev/null)
echo "wrote $chrome_zip"

firefox_zip="$out_dir/github-issue-toolkit-${version}-firefox.zip"
tmp="$(mktemp -d)"
cp -r "$root"/. "$tmp/" && cp "$tmp/manifest.firefox.json" "$tmp/manifest.json"
rm -f "$firefox_zip"
(cd "$tmp" && zip -r "$firefox_zip" manifest.json "${files[@]}" >/dev/null)
rm -rf "$tmp"
echo "wrote $firefox_zip"

if [[ "${1:-}" != "" ]]; then
  google-chrome --headless=new --pack-extension="$root" --pack-extension-key="$1" >/dev/null 2>&1
  echo "wrote $out_dir/$(basename "$root").crx"
fi
