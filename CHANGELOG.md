# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

Nothing yet.

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
