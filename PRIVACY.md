# Privacy policy

GitHub Issue Toolkit is a browser extension that displays the values of GitHub custom issue fields on issue pages.

## Data the extension handles

- **GitHub personal access token.** You enter it on the extension's settings page. It is stored with `chrome.storage.local`, on your device only, and is sent exclusively to `https://api.github.com/graphql` in the `Authorization` header. It is never sent anywhere else. All requests read data (issue field values, creation dates, and the title and type of issues you pin), with one exception: when you click **Link** in the pinned issues panel, the extension writes to GitHub on your behalf by making the current issue a sub-issue of the pinned one (`addSubIssue`). Nothing is written without that click.
- **Issue and pull request references.** For the issues and pull requests visible on the page you are viewing (sub-issue lists, project tables and boards, pull request lists), the extension sends the repository owner, repository name and number to the GitHub API to fetch the field values, creation dates, and for pull requests the author's relation to the repository, fork origin, size and merge state. Results are kept in memory for a few minutes and are discarded when the tab closes.
- **Settings and pins.** Your list of field names, the age badge, pull request badge and pinned issues preferences, and the issues you pin (repository, number, title, type) are stored with `chrome.storage.local` on your device.

## Data the extension does not handle

- No analytics, telemetry or crash reporting.
- No cookies, no tracking, no third-party services.
- No data leaves your browser except the GitHub API requests described above.

## Permissions

- `storage` - saves the token and the field list locally.
- Host permission `https://api.github.com/*` - reads issue field values, creation dates and pinned issue details through the GitHub GraphQL API, and performs the sub-issue link you request from the pinned issues panel.
- Content script on `https://github.com/*` - finds sub-issue rows, project table rows, board cards and pull request rows, renders the badges, and adds the pinned issues button to GitHub's header.

On Firefox, access to `github.com` and `api.github.com` is granted by you after installation (the settings page asks for it once); the extension does nothing until then.

## Removing your data

Clear the token and remove all pins on the settings page, or uninstall the extension. Uninstalling removes everything the extension stored.

## Contact

Open an issue at https://github.com/MilosPaunovic/github-issue-toolkit/issues.
