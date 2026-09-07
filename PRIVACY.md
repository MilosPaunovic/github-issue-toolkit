# Privacy policy

GitHub Issue Field Badges is a browser extension that displays the values of GitHub custom issue fields on issue pages.

## Data the extension handles

- **GitHub personal access token.** You enter it on the extension's settings page. It is stored with `chrome.storage.local`, on your device only, and is sent exclusively to `https://api.github.com/graphql` in the `Authorization` header of the requests that read issue field values. It is never sent anywhere else.
- **Issue references.** For the sub-issues visible on the page you are viewing, the extension sends the repository owner, repository name and issue number to the GitHub API to fetch the field values. Results are kept in memory for a few minutes and are discarded when the tab closes.
- **Field names to show.** Your configured list of field names is stored with `chrome.storage.local` on your device.

## Data the extension does not handle

- No analytics, telemetry or crash reporting.
- No cookies, no tracking, no third-party services.
- No data leaves your browser except the GitHub API requests described above.

## Permissions

- `storage` - saves the token and the field list locally.
- Host permission `https://api.github.com/*` - reads issue field values through the GitHub GraphQL API.
- Content script on `https://github.com/*` - finds sub-issue rows on issue pages and renders the badges.

On Firefox, access to `github.com` and `api.github.com` is granted by you after installation (the settings page asks for it once); the extension does nothing until then.

## Removing your data

Clear the token on the settings page, or uninstall the extension. Uninstalling removes everything the extension stored.

## Contact

Open an issue at https://github.com/MilosPaunovic/issue-field-badges/issues.
