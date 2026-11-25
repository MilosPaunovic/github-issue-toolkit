# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

Nothing yet.

## [2.12.2] - 2026-11-25

### Changed

- The settings page has a **Pull requests** tab, holding the pull request badges, which moved there from Badges, and **Related work on pull requests**, which moved there from Epics, so what concerns pull requests is in one place. Badges now holds the issue fields and the issue age, and Epics the kanban board, the sub-issue progress and the sidebar.

## [2.12.1] - 2026-11-25

### Changed

- The **Reading the button** list on the Contributors tab has evenly spaced rows: every state sits on one line of the same height, with the Member note shortened to fit.

## [2.12.0] - 2026-11-25

### Added

- **Related work on pull requests.** A full-width box above the header of a pull request names the issue it closes and lists everything connected to it: the issues it closes, what its description says it is related to, the other pull requests on the same issues and what mentions it. The description is read for the closing words GitHub links with and for words such as `related to`, `part of`, `counterpart of`, `follow-up to`, `backport of` and `depends on`, so a counterpart in another repository is found. It opens folded like the other panels and can be turned off, or made to start open, on the Epics tab.
- The profile panel and the assignment requests box fold down to their header line, with an arrow at the left of the header (or a click on the header) to unfold and fold them again. Both open folded; a checkbox under each, on the Contributors tab, makes it start open instead.

### Changed

- The assignment requests box no longer shows on issues in private repositories, where only people with access can comment so nobody is asking to be let in. A checkbox on the Contributors tab, **Also show it on issues in private repositories**, brings it back.
- The settings page no longer adds "(on by default)" or "(off by default)" to its checkboxes; a checkbox shows its own state.
- The assignment requests box sits full width at the very top of the issue, above its title, like the panel on a profile, instead of inside the conversation column.
- The profile panel and the assignment requests box keep the same space around them: 16 pixels below the page tabs and the same distance to the first line under them.

## [2.11.4] - 2026-11-24

### Fixed

- **Show Member is now really the default.** The choice is stored under a new name, so a value saved by 2.11.2 no longer overrides it; everyone starts on **Show Member in place of the button** and can pick again on the Contributors tab.
- A member is a plain **Member** mark, not a button: nothing happens when it is clicked, no card opens and nothing is read for them.
- A name no longer shows a **Contributor** button for a second before turning into **Member**: with members shown or left out, a button appears only once the shared membership answer is in.

## [2.11.3] - 2026-11-24

### Changed

- What happens to members of the organization is one choice on the Contributors tab, **Members of the organization**, instead of two checkboxes that contradicted each other: show **Member** in place of the button (the default, as before 2.11.2), leave them out with no button and no mark, or give them a button like anyone else.

## [2.11.2] - 2026-11-24

### Added

- **Leave members of the organization out** on the Contributors tab, on by default: a member gets no contributor button at all, so the button is only for the people you do not already know. Which names on the page belong to the organization is asked once, in a shared request, and a button is shown for a name only after that answer, so a member is never seen with one. The automatic read of the author waits for the same answer. Untick it to give members a button again, and the option to mark them **Member** right away then applies.

## [2.11.1] - 2026-11-24

### Fixed

- The contributor card did not open in 2.11.0: pressing the button read the person but a mistake in the new header layout stopped the card from being built. The card opens again, and the profile panel's status tag sits in its header line as intended.

## [2.11.0] - 2026-11-24

### Added

- **Contributor status.** The contributor load mark is now a **Contributor** button after a username on an issue or pull request. Nothing is read until it is pressed, and then one request reads the person and the button becomes their status: **Member** for people in the organization, otherwise **New contributor** (no merged pull request in the organization), **First PR here** (merged elsewhere in it, none in this repository), **Returning**, or **Regular** from a number of merged pull requests in the repository you set, 5 by default. An amber count still flags anyone assigned more than your limit. The card it opens has the pull requests and the issues of the person for this repository and for the whole organization, each number linking to the matching search, two assigned issues in view with the pull request that closes each and the rest below a scroll, and how old the answer is with a refresh button. A person is read once per repository and kept until the tab is closed.
- **Members at once.** Which names on the page belong to the organization is asked in one shared request, so **Member** shows without a press and GitHub's own Member label beside it is hidden. A setting turns it off, and another reads the author on its own when an issue opens.
- **Organization panel** on the first page of a person's profile, off by default, for each organization you name on the Contributors tab: open and merged pull requests, issues opened and assigned, pull requests reviewed and issues and pull requests commented on, each linking to the matching search, with a status for membership or experience and two accordions, closed at first, of their open pull requests and the open issues assigned to them. One request per person and organization, kept until the tab is closed.
- **Assignment requests**, off by default: a box at the top of an assigned issue lists the comments of other people that contain one of your words, with the words highlighted in a preview, apart from a closed list of what the assignee wrote and a closed list of the words searched for. Tick the ones that are no longer wanted and mark them as outdated on GitHub, after a confirmation, with an Undo. The words are a list of tags you add to and remove from in the settings, starting from defaults chosen from 3,199 real comments of October 2026 on a busy open source repository. Only comments of up to 400 characters are offered, and your own, the assignees' and hidden ones are left out. Hiding needs write access.
- Organizations with a colour of their own, Kestra's violet for `kestra-io`, carry it as a thin outline, a tinted header and the colour on headings, counts and statuses of the card, the panel and the box, on top of GitHub's own design. Other organizations keep GitHub's colours.
- When a person cannot be looked up, the card and the button say why, a missing token, a rejected one or whatever GitHub answered, and a count GitHub did not return shows as a dash instead of failing the whole read.

### Changed

- The settings page is split into tabs, Home, Access, Badges, Epics, Contributors and Shortcuts, instead of one long page. Home is a short welcome with the state of the token and of the site access, an **Add your token** button while there is none, and a map of the other tabs; it opens by itself the first time, then the page opens on the tab used last. The Save bar is fixed at the bottom, larger, and says **Unsaved changes** once something has changed, with a **Discard** button that puts every setting back to what is saved.
- The toolbar icon opens the settings page again, as it did before 2.10.0.
- The token guidance names `Pull requests: Read-only` for the pull request counts, `Issues: Read and write` for hiding comments, and the `read:org` scope for seeing members who keep their membership private.

### Removed

- The toolbar dropdown of quick switches. Every switch it held is on the settings page, in the tab of its feature.

### Fixed

- Pressing the contributor button, or opening a profile, on a tab that was open when the extension was reloaded no longer throws a ReferenceError and leaves the button on Looking up: the lookup fails with the message to reload the page.

## [2.10.1] - 2026-10-29

### Changed

- The sub-issue progress shows its scope as one tag per value, `12 / 18 done` followed by a `release:2.1` tag, instead of a long sentence that GitHub's group header clipped, and it replaces GitHub's bar in the group headers of a grouped table only. The Sub-issues progress column keeps GitHub's own bar.

## [2.10.0] - 2026-10-29

### Added

- **Sub-issue progress**: an optional setting, off by default, replaces GitHub's progress bar on a Projects table grouped by parent issue and in the Sub-issues progress column with one that counts only the sub-issues inside the scope the view is narrowed to, and says what it counts, for example `12 / 18 done for release:2.1`. The scope is one or more fields, taken from the value the view is sliced by or from a term of its filter; left empty, every sub-issue is counted. A sub-issue is done when a field you name has a value you name, or when it is closed if you name none. When the view is narrowed to none of the scope fields, GitHub's own bar stays.

### Changed

- The toolbar icon now opens a dropdown with a switch for every feature instead of the settings page. Switches are saved when flipped and open GitHub pages follow them at once. The token, the field names, the age threshold, the contributor limit and the address bar shortcuts stay on the full settings page, reached with the **All settings** button, which keeps working from the extensions page as before. The dropdown also shows the site access box on Firefox.

## [2.9.0] - 2026-10-27

### Added

- **Label badges**: an entry starting with `label:` in the field list shows matching labels as badges, `label:area/*` for every label starting with `area/` or `label:bug` for one, on sub-issue lists, project views and kanban cards. Each badge takes the badge colour nearest to the label's own, links to the issues carrying that label, and is skipped on a project table that already has a Labels column.

## [2.8.0] - 2026-10-16

### Added

- An optional setting, off by default, hides GitHub's **Projects** section of the issue sidebar on every issue, leaving the rest of the sidebar in place. The issue stays in its projects; only the box is hidden.

## [2.7.0] - 2026-10-16

### Added

- **Address bar search**: type `@gh` and a space in the address bar, then a shortcut name and your words, `@gh repo flow`, to see matching repositories, issues or pull requests as suggestions while you type. Each shortcut set on the settings page has a name, a kind and GitHub qualifiers added to the search, such as `org:acme is:open`, and one shortcut is the default for text that starts with no shortcut name. Each shortcut can carry an optional icon, an emoji for example, shown before its results. A shortcut name typed on its own lists what its qualifiers match at once, most recently updated first. Repository names inside an `org:` or `user:` match on any part of the name, and `#1234` with a `repo:` qualifier goes straight to that item. Enter on the text opens the GitHub search page. Ships with a `repo` (📦) and a `pr` (🔀) shortcut.

### Changed

- The field list is optional. With no field and the age badge off, sub-issue lists and project views no longer show a notice asking for one, the settings page saves without a warning, and no request is made for field values.

## [2.6.0] - 2026-10-16

### Added

- A **contributor load** mark next to usernames on issues and pull requests, off by default. An outlined dot is nothing assigned in that organization, a filled dot is at or under the limit you set, and above it a count of assigned issues over open pull requests, filled in when that second number is zero. Hovering it lists what the person holds, each issue with the pull request that closes it, taken from GitHub's own references rather than from closing keywords. A name is only read once the pointer rests on it, and a red outlined dot marks a read that failed.

## [2.5.0] - 2026-09-24

### Added

- A **Hide closed** checkbox in the kanban toolbar takes every closed sub-issue off the board, whatever the columns are made of. The choice is remembered like the other board settings.

## [2.4.2] - 2026-09-22

### Changed

- The age badge reads `today`, `this week` or `this month` for an issue younger than the chosen unit, instead of `0d`, `<1w` and `<1 mo`.

## [2.4.1] - 2026-09-17

### Changed

- Kanban: an issue that had been closed as not planned is closed as not planned again when its card is dragged back to the Closed column, instead of always as completed.
- Kanban: the note saying when cards can be dragged sits in the toolbar rather than as a tooltip over the whole board, the List and Kanban buttons announce which one is pressed, and the filter value select has a name for screen readers.
- Kanban: a GitHub deployment that does not know the option list of single-select fields is asked again after ten minutes, and only that exact schema error triggers the plainer query, so column order and dragging are never switched off for good by an unrelated error.
- Kanban: sub-issue lists of epics visited more than five minutes ago are dropped from memory when a fresh one is loaded.
- Issue sidebar: the layout of the issue page is measured once per page and after a resize rather than on every scan.

## [2.4.0] - 2026-09-17

### Added

- Epic kanban: a List and Kanban toggle above the sub-issues list of an issue draws those sub-issues as a board. The columns come from any field the sub-issues carry, or from their state, type or assignee, and follow the order the organization gave a single-select field's options; the cards inside a column are ordered by the field, number, creation date, title, state, type or assignee you pick, in either direction. Both choices and the toggle are remembered. The board reads up to 500 sub-issues. On by default, one checkbox in the settings turns it off.
- Issue sidebar toggle: a chevron in the gutter between an issue and its metadata column hides that column, assignees, labels, type, fields, projects and the rest, leaving the width to the issue body and the board. The button keeps its place either way, the choice holds on every issue and in every tab, and it is not shown on a narrow window where GitHub stacks the sidebar anyway. On by default, one checkbox in the settings turns it off.
- Kanban filter: one value of any of those same dimensions keeps only the matching sub-issues, and the toolbar count says how many of the epic are left. Filtering happens in the page, without another request.
- Kanban drag and drop: a card dragged to another column writes the new value to GitHub when the columns come from a single-select field (`createIssueFieldValue`, or `deleteIssueFieldValue` for the "No field" column) or from the issue state (`closeIssue`, `reopenIssue`). The card moves first and returns to its column with the reason in the toolbar if the write fails, columns made of types or assignees are not drop targets, and a second checkbox in the settings turns dragging off. This is the only part of the board that writes, and it needs a token with write access.

## [2.3.1] - 2026-09-11

### Changed

- The added and removed line counts in the pull request size badge use the regular weight instead of bold.

## [2.3.0] - 2026-09-11

### Added

- Age threshold: the age badge turns yellow once an issue has been open longer than a number of days set on the Issue age card, 90 by default; 0 turns the highlight off. The hover text says when the threshold is exceeded.
- A badge reference on the site and in the README showing every badge and what its colour means.

### Changed

- The pull request size badge shows added lines in green and removed lines in red, like GitHub's own diff counters.

## [2.2.1] - 2026-09-11

### Changed

- Badges are back to GitHub's outlined field-chip style, coloured text on a tinted background, so they stay visually distinct from labels. The solid style introduced in 2.2.0 is gone.

## [2.2.0] - 2026-09-11

### Added

- Pull request badges on Projects views: table rows and board cards whose item is a pull request get the same author, fork, size and merge state badges as the pull request list.

### Changed

- Badges are solid pills like GitHub's labels instead of outlined, tinted chips, so they sit naturally among labels on pull request lists and project cards.
- The first option on the Pull requests settings card is shorter; the possible values are documented on the site and in the README.

## [2.1.0] - 2026-09-11

### Added

- **Pull request badges** on the pull request list, among the labels of each row. On by default: the author's relation to the repository (`First-time contributor`, `First PR on GitHub`, `External`, `Contributor`, `Collaborator`, `Member`, or `Bot` for apps). Optional, each with its own checkbox on the new Pull requests settings card: `From fork`, size as added and removed lines with the changed file count on hover, and merge state (`Mergeable`, `Behind base`, `Blocked`, `Conflicts`, `Checks failing`).
- Documentation: a pull request list example on the site and in the README, and an FAQ entry explaining each badge.

### Changed

- The manifest description and the site mention pull request badges.

## [2.0.6] - 2026-09-10

### Changed

- On a board grouped by a field, the badge carrying that field's value is skipped too, since the column header already says it.

## [2.0.5] - 2026-09-09

### Added

- On Projects views, fields that the view already displays are skipped: a column in the table layout, or a field chip on a board card. A setting on the fields card turns this off.

## [2.0.4] - 2026-09-09

### Fixed

- On the notifications page the pin button landed next to the page title on the left and its dropdown opened off screen: the header slot now targets the bell button itself, never a breadcrumb link to the same address, falls back to the user menu when the bell is hidden, and the dropdown stays inside the viewport.

## [2.0.3] - 2026-09-09

### Changed

- The README no longer mentions the former name.

## [2.0.2] - 2026-09-09

### Added

- Social preview card for the repository and the documentation site, generated by `scripts/render-social-preview.py` and shown at the top of the README.

### Changed

- Pull requests are squash-merged only; the guide describes how to write PR titles and descriptions so the resulting commit follows the repository's conventions.

## [2.0.1] - 2026-09-09

### Changed

- The documentation site shows the latest release version in its header, read from the GitHub releases API with the shipped version as fallback.

## [2.0.0] - 2026-09-09

A major version because the extension changes name and Firefox identity and grows from a badge renderer into a small toolkit.

### Added

- Badges on GitHub Projects views: the table layout shows them after the issue number in the title cell, the board layout under the card title. Badges follow the configured issue fields, so the same setup works on `/orgs/<org>/projects/<n>/views/...` pages and on sub-issue lists alike.
- **Issue age** badge showing how long ago the issue was created, in months (`3 mo`, `<1 mo`), weeks or days. Hovering shows the exact age and the creation date. Off by default, enabled in the settings.
- **Pinned issues** panel, opened from a pin button added to GitHub's top bar next to the notifications bell (styled like the other header icons, with a count). Pin the epics you use most (from the current issue, or by pasting a URL or `owner/repo#123`), then for each pin: open it, copy its reference, or **Link** the issue you are looking at as a sub-issue of it. Linking uses the `addSubIssue` mutation and offers to move the issue when it already has another parent. Pins show the issue title and type. The open or closed state of the panel is per tab, and the pins are kept in `chrome.storage.local`. A red dot on the button flags a failed request on pages that have no sub-issues list. The feature can be switched off in the settings.
- Settings: **Issue age** card (toggle and unit) and **Pinned issues** card (toggle and a "Remove all pins" button).
- Documentation site: examples of every surface with an invented repository, a compact navigation with a mobile menu, and a `scripts/render-examples.py` script that renders the README images from those examples.
- `release` GitHub Actions workflow: pushing a `v*` tag builds both packages and publishes the GitHub release with the matching changelog section as notes.

### Changed

- Renamed to **GitHub Issue Toolkit**. The repository moved to https://github.com/MilosPaunovic/github-issue-toolkit (the old address redirects) and the documentation site to https://milospaunovic.github.io/github-issue-toolkit/ (the old address does not). Icons are unchanged.
- Package files are `github-issue-toolkit-<version>-chrome.zip` and `github-issue-toolkit-<version>-firefox.zip`.
- The Firefox add-on id is `github-issue-toolkit@milospaunovic.github.io`; Firefox treats it as a different add-on from 1.0.0, so remove the old temporary add-on before loading this one.
- The field query tolerates missing or inaccessible issues instead of failing the whole page, and is sent in batches of 60 issues so large project tables stay within GitHub's limits.
- The token hint now mentions that linking needs write access to issues (`repo` scope, or `Issues: Read and write` for fine-grained tokens).

### Fixed

- Pinned issues keep their title and type: the metadata loaded after pinning was written to a stale copy of the pin.

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

[Unreleased]: https://github.com/MilosPaunovic/github-issue-toolkit/compare/v2.12.2...HEAD
[2.12.2]: https://github.com/MilosPaunovic/github-issue-toolkit/compare/v2.12.1...v2.12.2
[2.12.1]: https://github.com/MilosPaunovic/github-issue-toolkit/compare/v2.12.0...v2.12.1
[2.12.0]: https://github.com/MilosPaunovic/github-issue-toolkit/compare/v2.11.4...v2.12.0
[2.11.4]: https://github.com/MilosPaunovic/github-issue-toolkit/compare/v2.11.3...v2.11.4
[2.11.3]: https://github.com/MilosPaunovic/github-issue-toolkit/compare/v2.11.2...v2.11.3
[2.11.2]: https://github.com/MilosPaunovic/github-issue-toolkit/compare/v2.11.1...v2.11.2
[2.11.1]: https://github.com/MilosPaunovic/github-issue-toolkit/compare/v2.11.0...v2.11.1
[2.11.0]: https://github.com/MilosPaunovic/github-issue-toolkit/compare/v2.10.1...v2.11.0
[2.10.1]: https://github.com/MilosPaunovic/github-issue-toolkit/compare/v2.10.0...v2.10.1
[2.10.0]: https://github.com/MilosPaunovic/github-issue-toolkit/compare/v2.9.0...v2.10.0
[2.9.0]: https://github.com/MilosPaunovic/github-issue-toolkit/compare/v2.8.0...v2.9.0
[2.8.0]: https://github.com/MilosPaunovic/github-issue-toolkit/compare/v2.7.0...v2.8.0
[2.7.0]: https://github.com/MilosPaunovic/github-issue-toolkit/compare/v2.6.0...v2.7.0
[2.6.0]: https://github.com/MilosPaunovic/github-issue-toolkit/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/MilosPaunovic/github-issue-toolkit/compare/v2.4.2...v2.5.0
[2.4.2]: https://github.com/MilosPaunovic/github-issue-toolkit/compare/v2.4.1...v2.4.2
[2.10.1]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.10.1
[2.10.0]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.10.0
[2.9.0]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.9.0
[2.8.0]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.8.0
[2.7.0]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.7.0
[2.6.0]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.6.0
[2.5.0]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.5.0
[2.4.2]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.4.2
[2.4.1]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.4.1
[2.4.0]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.4.0
[2.3.1]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.3.1
[2.3.0]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.3.0
[2.2.1]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.2.1
[2.2.0]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.2.0
[2.1.0]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.1.0
[2.0.6]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.0.6
[2.0.5]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.0.5
[2.0.4]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.0.4
[2.0.3]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.0.3
[2.0.2]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.0.2
[2.0.1]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.0.1
[2.0.0]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v2.0.0
[1.0.0]: https://github.com/MilosPaunovic/github-issue-toolkit/releases/tag/v1.0.0
