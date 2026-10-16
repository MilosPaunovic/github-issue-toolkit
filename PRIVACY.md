# Privacy policy

GitHub Issue Toolkit is a browser extension that displays the values of GitHub custom issue fields on issue pages.

## Data the extension handles

- **GitHub personal access token.** You enter it on the extension's settings page. It is stored with `chrome.storage.local`, on your device only, and is sent exclusively to `https://api.github.com/graphql` in the `Authorization` header. It is never sent anywhere else. All requests read data (issue field values, creation dates, the sub-issues of an issue you view as a board, the title and type of issues you pin, the open issues and pull requests of a contributor whose name you hover, and the search results for what you type after `@gh` in the address bar), with two exceptions: when you click **Link** in the pinned issues panel, the extension makes the current issue a sub-issue of the pinned one (`addSubIssue`), and when you drag a card to another column on the kanban board, it writes that column's value to the issue (`createIssueFieldValue`, `deleteIssueFieldValue`) or closes and reopens the issue (`closeIssue`, `reopenIssue`). Nothing is written without that click or that drag.
- **Issue and pull request references.** For the issues and pull requests visible on the page you are viewing (sub-issue lists, project tables and boards, pull request lists), the extension sends the repository owner, repository name and number to the GitHub API to fetch the field values, creation dates, and for pull requests the author's relation to the repository, fork origin, size and merge state. With the kanban board open it sends the owner, name and number of the issue you are looking at to read its sub-issues: their numbers, titles, states, types, assignees, creation dates and field values. Results are kept in memory for a few minutes and are discarded when the tab closes.
- **Usernames you hover.** With the contributor load mark enabled, hovering a username on an issue or pull request sends that login and the organization in the page URL to the GitHub API, to read how many open issues are assigned to that person, how many open pull requests they have, and the titles and references of up to twenty five of those issues together with the pull requests that close them. It is a read, it happens only on hover, and the result is kept in memory for ten minutes. Your own login is read once so the mark can skip your name.
- **What you type after `@gh` in the address bar.** Once you type the `@gh` keyword and a space, the words that follow and the qualifiers of the matching shortcut are sent to the GitHub search API to show suggestions, as you type. For a shortcut with an `org:` or `user:` qualifier, the extension also reads the names, descriptions, links and last push dates of up to five hundred repositories of that owner as soon as you type the keyword, kept for ten minutes in the browser's session storage, which stays in memory and is cleared when the browser closes. Nothing is sent for anything you type in the address bar without the keyword.
- **Settings and pins.** Your list of field names, the age badge, pull request badge, contributor load, address bar shortcuts, kanban, sidebar and pinned issues preferences (including whether the board or the list is shown, the field the board groups by, the one it orders by, the filter, whether closed sub-issues are hidden, whether the issue sidebar is folded away, and whether its Projects section is hidden), and the issues you pin (repository, number, title, type) are stored with `chrome.storage.local` on your device.

## Data the extension does not handle

- No analytics, telemetry or crash reporting.
- No cookies, no tracking, no third-party services.
- No data leaves your browser except the GitHub API requests described above.

## Permissions

- `storage` - saves the token and the field list locally.
- Host permission `https://api.github.com/*` - reads issue field values, creation dates, the sub-issues behind the kanban board, pinned issue details, the contributor load of a hovered username and the address bar search results through the GitHub GraphQL API, and performs the sub-issue link you request from the pinned issues panel and the card move you perform by dragging.
- Content script on `https://github.com/*` - finds sub-issue rows, project table rows, board cards and pull request rows, renders the badges and the kanban board, adds the contributor load mark next to usernames, adds the button that hides the issue sidebar, optionally hides the sidebar's Projects section, and adds the pinned issues button to GitHub's header.

On Firefox, access to `github.com` and `api.github.com` is granted by you after installation (the settings page asks for it once); the extension does nothing until then.

## Removing your data

Clear the token and remove all pins on the settings page, or uninstall the extension. Uninstalling removes everything the extension stored.

## Contact

Open an issue at https://github.com/MilosPaunovic/github-issue-toolkit/issues.
