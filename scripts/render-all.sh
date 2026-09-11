#!/usr/bin/env bash
# Regenerates every rendered artefact in the repository. Run it before committing any change to the
# extension UI, the settings page, the site mock-ups, the icon, the name or the tagline.
#   docs/example-*.png       from the mock-ups in docs/index.html   (scripts/render-examples.py)
#   docs/settings-*.png      from options.html                       (scripts/render-settings.py)
#   docs/social-preview.png  from the icon, name, tagline and mock-up (scripts/render-social-preview.py)
# If docs/social-preview.png changed, upload it again as the repository's social preview (Settings, General).
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/render-examples.py
python3 scripts/render-settings.py
before="$(md5sum docs/social-preview.png | cut -d' ' -f1)"
python3 scripts/render-social-preview.py
after="$(md5sum docs/social-preview.png | cut -d' ' -f1)"
if [[ "$before" != "$after" ]]; then
  echo "docs/social-preview.png changed: upload it again as the repository's social preview (Settings, General)."
fi
