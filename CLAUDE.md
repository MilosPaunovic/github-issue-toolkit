# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

GitHub Issue Toolkit, a Manifest V3 browser extension (Chromium and Firefox) with no build step. The documentation site in `docs/` is served by GitHub Pages; the README embeds images rendered from that site.

## Commits

- Conventional format: `feat: ...`, `fix(pins): ...`, `docs(site): ...`, `chore: ...`, `build: ...`.
- The subject is entirely lowercase, product and brand names included: write `rename the extension`, not `rename to GitHub Issue Toolkit`. Only code identifiers keep their case.
- **Every commit has a title and a body.** The body opens with one paragraph saying what the change is and why, followed by one bullet per notable change, each a full statement on a single unwrapped line. The initial commit is the reference shape. Never a subject alone.
- Never put a version or release number in the subject; versions live in the manifests, the changelog and the tag.
- No em dashes or en dashes anywhere, use a plain hyphen.
- Never amend or force-push commits that are already on `origin/main` unless the maintainer explicitly asks for a history rewrite.

## Releases

1. Bump `version` in `manifest.json` and `manifest.firefox.json` to the same value.
2. In `CHANGELOG.md` rename the `Unreleased` section to `[x.y.z] - YYYY-MM-DD`, add a fresh empty `Unreleased`, and add the compare and release link lines at the bottom.
3. Commit, then `git tag vx.y.z && git push origin main vx.y.z`. The `release` workflow verifies the tag against the manifests, builds both zips with `scripts/package.sh` and publishes the GitHub release with the changelog section as notes.

Never commit built packages or a signing key.

The repository has GitHub's immutable releases setting on. Once a release is published, its tag name can never be reused, not even after deleting the release or disabling the setting. Never delete a release expecting to recreate it under the same version; move to the next patch version instead.

## Keep in sync

- `manifest.json` and `manifest.firefox.json` differ only in `background` and `browser_specific_settings`. The Firefox add-on id `github-issue-toolkit@milospaunovic.github.io` must never change.
- After changing the settings page, re-render `docs/settings-dark.png` and `docs/settings-light.png`.
- After changing a mock-up in `docs/index.html`, run `python3 scripts/render-examples.py` to refresh the README images.
- After changing icons, run `python3 scripts/make-icons.py` (icons are shared by the manifests, the settings page and the site).
- README, `PRIVACY.md`, the site and the settings page describe the same behaviour; when a default or permission changes, update all four.

## Local testing

The maintainer loads this folder as an unpacked extension. Content and background scripts only reload after clicking the reload icon on the extension card in `chrome://extensions`, then reloading the GitHub tab. Firefox: build the zip and load it through `about:debugging`.
