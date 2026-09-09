# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Badges on GitHub Projects views: the table layout shows them after the issue number in the title cell, the board layout under the card title. Badges follow the configured issue fields, so the same setup now works on `/orgs/<org>/projects/<n>/views/...` pages and on sub-issue lists alike.
- **Issue age** badge showing how long ago the issue was created, in months by default (`3 mo`, `<1 mo`), with weeks and days as alternatives in the settings. Hovering shows the exact age and the creation date. Enabled by default.
- **Pinned issues** panel, opened from a pin button added to GitHub's top bar next to the notifications bell (styled like the other header icons, with a count). Pin the epics you use most (from the current issue, or by pasting a URL or `owner/repo#123`), then for each pin: open it, copy its reference, or **Link** the issue you are looking at as a sub-issue of it. Linking uses the `addSubIssue` mutation and offers to move the issue when it already has another parent. Pins show the issue title (read from the page immediately, then completed with the issue type from the API). The panel collapses to a small pill and the pins are kept in `chrome.storage.local`.
- Settings: **Issue age** card (toggle and unit) and **Pinned issues** card with a "Remove all pins" button.

### Changed

- The field query tolerates missing or inaccessible issues instead of failing the whole page.
- The token hint now mentions that linking needs write access to issues (`repo` scope, or `Issues: Read and write` for fine-grained tokens).

## [1.0.0] - 2026-09-07

First release.

### Added

- Badges with custom issue field values on every row of the sub-issues list of a GitHub issue, placed right after the issue type badge.
- Support for all field types: single-select, multi-select, text, number and date. Single-select badges use the colour of the chosen option.
- One batched GraphQL query per page covering all visible sub-issues across repositories, with a five-minute in-memory cache.
- Badges link to the repository's issue search filtered by that field value.
- Settings page with a token input, a **Test token** button, and the list of fields to show as removable chips (Enter or comma adds, Backspace or the × button removes). No default field: nothing is shown until at least one field is added.
- In-page hints above the sub-issues list when the token or the field list is missing, with a button that opens the settings.
- Toolbar icon that opens the settings page.
- Light and dark theme on the settings page, following the browser theme.
- Firefox support (140 or newer) through `manifest.firefox.json`, with a one-time site-access prompt on the settings page.
- `scripts/package.sh` producing one package per engine, `-chrome.zip` and `-firefox.zip`, and `scripts/make-icons.py` regenerating the icons in dark and light variants.
- Documentation site in `docs/` for GitHub Pages, with a light/dark toggle.
- `release` GitHub Actions workflow: pushing a `v*` tag builds both packages and publishes the GitHub release with the matching changelog section as notes.

### Security

- The token is stored with `chrome.storage.local` on the device and is sent only to `https://api.github.com/graphql`. No analytics or third-party services. See [PRIVACY.md](PRIVACY.md).

[Unreleased]: https://github.com/MilosPaunovic/issue-field-badges/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/MilosPaunovic/issue-field-badges/releases/tag/v1.0.0
