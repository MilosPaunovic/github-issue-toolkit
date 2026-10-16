const api = typeof browser !== "undefined" && browser.runtime ? browser : chrome;

const GRAPHQL_URL = "https://api.github.com/graphql";

async function getSettings() {
  const stored = await api.storage.local.get(["token", "fields", "ageEnabled", "ageUnit"]);
  return {
    token: (stored.token || "").trim(),
    fields: parseFields(stored.fields),
    ageEnabled: stored.ageEnabled === true,
    ageUnit: stored.ageUnit || "months"
  };
}

// pulls: [{owner, repo, number}] -> { "owner/repo!number": { association, bot, login, fork, additions, deletions, files, mergeState, draft } }
async function fetchPullRequests(pulls) {
  const { token } = await getSettings();
  if (!token) return { error: "NO_TOKEN" };
  const byRepo = new Map();
  for (const it of pulls) {
    const key = `${it.owner}/${it.repo}`;
    if (!byRepo.has(key)) byRepo.set(key, { owner: it.owner, repo: it.repo, numbers: new Set() });
    byRepo.get(key).numbers.add(Number(it.number));
  }
  const parts = [];
  let r = 0;
  for (const { owner, repo, numbers } of byRepo.values()) {
    const items = [...numbers].map((n) => `p${n}: pullRequest(number: ${n}) { number isDraft authorAssociation author { __typename login } isCrossRepository additions deletions changedFiles mergeStateStatus }`);
    parts.push(`r${r++}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(repo)}) { nameWithOwner ${items.join("\n")} }`);
  }
  const data = await graphql(token, `{ ${parts.join("\n")} }`, { partial: true });
  const result = {};
  for (const repoNode of Object.values(data)) {
    if (!repoNode || !repoNode.nameWithOwner) continue;
    for (const [alias, pr] of Object.entries(repoNode)) {
      if (!alias.startsWith("p") || !pr || typeof pr !== "object") continue;
      result[`${repoNode.nameWithOwner}!${pr.number}`] = {
        association: pr.authorAssociation || "NONE",
        bot: Boolean(pr.author && pr.author.__typename === "Bot"),
        login: pr.author ? pr.author.login : null,
        fork: Boolean(pr.isCrossRepository),
        additions: pr.additions, deletions: pr.deletions, files: pr.changedFiles,
        mergeState: pr.mergeStateStatus || "UNKNOWN",
        draft: Boolean(pr.isDraft)
      };
    }
  }
  return { pulls: result };
}

function parseFields(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function graphql(token, query, { partial = false } = {}) {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "github-issue-toolkit"
    },
    body: JSON.stringify({ query })
  });
  if (res.status === 401) {
    throw new Error("Token rejected by GitHub (401). Check it in the extension options.");
  }
  if (!res.ok) {
    throw new Error(`GitHub API responded with HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json.errors && (!json.data || !partial)) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data || {};
}

// `withOptions` also asks for the options a single-select field defines, which gives the kanban board its
// column order. Not every GitHub deployment knows that selection, so the caller falls back to asking without it.
function fieldValueFragment(withOptions) {
  return `
  issueFieldValues(first: 30) {
    nodes {
      __typename
      ... on IssueFieldSingleSelectValue { name color field { ... on IssueFieldSingleSelect { id name ${withOptions ? "options { id name color }" : ""} } } }
      ... on IssueFieldMultiSelectValue { value field { ... on IssueFieldMultiSelect { name } } }
      ... on IssueFieldTextValue { value field { ... on IssueFieldText { name } } }
      ... on IssueFieldNumberValue { value field { ... on IssueFieldNumber { name } } }
      ... on IssueFieldDateValue { value field { ... on IssueFieldDate { name } } }
    }
  }`;
}

const FIELD_VALUE_FRAGMENT = fieldValueFragment(false);

// One field value as the content script wants it: the field name, the value as text, its colour, and,
// for a single select, the options of the field in the order the organization defined them.
function fieldValue(node) {
  const fieldName = node.field && node.field.name;
  if (!fieldName) return null;
  const value = node.__typename === "IssueFieldSingleSelectValue" ? node.name : node.value;
  if (value === null || value === undefined || value === "") return null;
  const options = node.field && Array.isArray(node.field.options)
    ? node.field.options.map((o) => ({ id: o.id, name: o.name, color: o.color || "GRAY" }))
    : null;
  return {
    field: fieldName,
    fieldId: (node.field && node.field.id) || null,
    value: String(value),
    color: node.color || "GRAY",
    kind: node.__typename.replace(/^IssueField|Value$/g, "").toLowerCase(),
    options
  };
}

async function fetchFieldValues(issues) {
  const { token, fields, ageEnabled } = await getSettings();
  if (!token) {
    return { error: "NO_TOKEN" };
  }
  // Field badges are optional: with nothing to show there is nothing to ask GitHub.
  if (!fields.length && !ageEnabled) {
    return { values: {}, created: {}, fields };
  }

  const byRepo = new Map();
  for (const it of issues) {
    const key = `${it.owner}/${it.repo}`;
    if (!byRepo.has(key)) byRepo.set(key, { owner: it.owner, repo: it.repo, numbers: new Set() });
    byRepo.get(key).numbers.add(Number(it.number));
  }

  const repoParts = [];
  let r = 0;
  for (const { owner, repo, numbers } of byRepo.values()) {
    const issueParts = [...numbers].map(
      (n) => `i${n}: issue(number: ${n}) { number createdAt ${fields.length ? FIELD_VALUE_FRAGMENT : ""} }`
    );
    repoParts.push(
      `r${r++}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(repo)}) { nameWithOwner ${issueParts.join("\n")} }`
    );
  }

  // partial: a single missing issue (deleted, transferred, no access) must not fail the whole page.
  const data = await graphql(token, `{ ${repoParts.join("\n")} }`, { partial: true });
  const wanted = new Set(fields.map((f) => f.toLowerCase()));
  const result = {};
  const created = {};

  for (const repoNode of Object.values(data)) {
    if (!repoNode || !repoNode.nameWithOwner) continue;
    for (const [alias, issueNode] of Object.entries(repoNode)) {
      if (!alias.startsWith("i") || !issueNode || typeof issueNode !== "object") continue;
      const key = `${repoNode.nameWithOwner}#${issueNode.number}`;
      if (issueNode.createdAt) created[key] = issueNode.createdAt;
      const values = [];
      for (const node of (issueNode.issueFieldValues && issueNode.issueFieldValues.nodes) || []) {
        const v = fieldValue(node);
        if (!v || !wanted.has(v.field.toLowerCase())) continue;
        values.push({ field: v.field, value: v.value, color: v.color });
      }
      values.sort((a, b) => fields.findIndex((f) => f.toLowerCase() === a.field.toLowerCase())
        - fields.findIndex((f) => f.toLowerCase() === b.field.toLowerCase()));
      result[key] = values;
    }
  }
  return { values: result, created, fields };
}

// ---------------------------------------------------------------------------
// Contributor load: what one person already holds in one organization
// ---------------------------------------------------------------------------

// Who the token belongs to, so the mark can skip the reader's own name. Held for the life of the
// worker and read again after it restarts, which is cheap enough not to need storing.
let viewerLogin = null;

async function viewer() {
  if (viewerLogin !== null) return viewerLogin;
  const { token } = await getSettings();
  if (!token) return "";
  const data = await graphql(token, "{ viewer { login } }").catch(() => null);
  viewerLogin = (data && data.viewer && data.viewer.login) || "";
  return viewerLogin;
}

const LOAD_ISSUE_SAMPLE = 25;
const LOAD_PULL_SAMPLE = 50;

// GraphQL knows which issue a pull request actually closes, so the card can say which of the
// assigned issues is already being worked on instead of guessing from closing keywords in the body.
async function fetchContributorLoad(ref) {
  const { token } = await getSettings();
  if (!token) return { error: "NO_TOKEN" };
  const org = String((ref && ref.org) || "").trim();
  const login = String((ref && ref.login) || "").trim();
  if (!org || !login) return { error: "An organization and a login are both needed." };

  const assigned = JSON.stringify(`org:${org} is:issue is:open assignee:${login}`);
  const pulls = JSON.stringify(`org:${org} is:pr is:open author:${login}`);
  const data = await graphql(token, `{
    assigned: search(query: ${assigned}, type: ISSUE, first: ${LOAD_ISSUE_SAMPLE}) {
      issueCount
      nodes { ... on Issue { number title url repository { nameWithOwner } } }
    }
    pulls: search(query: ${pulls}, type: ISSUE, first: ${LOAD_PULL_SAMPLE}) {
      issueCount
      nodes {
        ... on PullRequest {
          number url
          closingIssuesReferences(first: 10) { nodes { number repository { nameWithOwner } } }
        }
      }
    }
  }`, { partial: true });

  const closes = new Map();
  for (const pull of (data.pulls && data.pulls.nodes) || []) {
    if (!pull) continue;
    for (const issue of (pull.closingIssuesReferences && pull.closingIssuesReferences.nodes) || []) {
      if (!issue || !issue.repository) continue;
      const key = `${issue.repository.nameWithOwner}#${issue.number}`;
      if (!closes.has(key)) closes.set(key, { number: pull.number, url: pull.url });
    }
  }

  const items = [];
  for (const issue of (data.assigned && data.assigned.nodes) || []) {
    if (!issue || !issue.repository) continue;
    const key = `${issue.repository.nameWithOwner}#${issue.number}`;
    items.push({
      key,
      repo: issue.repository.nameWithOwner.split("/")[1] || issue.repository.nameWithOwner,
      number: issue.number,
      title: issue.title,
      url: issue.url,
      pull: closes.get(key) || null
    });
  }

  return {
    assigned: (data.assigned && data.assigned.issueCount) || 0,
    pulls: (data.pulls && data.pulls.issueCount) || 0,
    items
  };
}

// ---------------------------------------------------------------------------
// Address bar search: `@gh <shortcut> <words>`, each shortcut a kind of item and GitHub qualifiers
// ---------------------------------------------------------------------------

// Used until the settings page saves a list of its own, so the keyword works right after installing.
const DEFAULT_SHORTCUTS = [
  { name: "repo", icon: "📦", kind: "repo", query: "" },
  { name: "pr", icon: "🔀", kind: "pr", query: "is:open" }
];
const SEARCH_KINDS = {
  repo: { label: "Repositories", type: "repositories", qualifier: "" },
  issue: { label: "Issues", type: "issues", qualifier: "is:issue" },
  pr: { label: "Pull requests", type: "pullrequests", qualifier: "is:pr" }
};
const SEARCH_LIMIT = 8;
const OWNER_REPOS_TTL_MS = 10 * 60 * 1000;
const OWNER_REPOS_PAGES = 5;
const OPEN_SETTINGS = "github-issue-toolkit:settings";
// Chrome reads suggestion descriptions as XML with a few highlight tags; Firefox shows them as typed.
const RICH_SUGGESTIONS = !api.runtime.getURL("").startsWith("moz-extension:");

async function searchSettings() {
  const stored = await api.storage.local.get(["token", "searchShortcuts", "searchDefault"]);
  const saved = Array.isArray(stored.searchShortcuts)
    ? stored.searchShortcuts.filter((s) => s && s.name && SEARCH_KINDS[s.kind])
    : [];
  const shortcuts = saved.length ? saved : DEFAULT_SHORTCUTS;
  const wanted = String(stored.searchDefault || "").toLowerCase();
  return {
    token: (stored.token || "").trim(),
    shortcuts,
    fallback: shortcuts.find((s) => s.name.toLowerCase() === wanted) || shortcuts[0]
  };
}

// The first word picks a shortcut when it is one's name; otherwise the whole text goes to the default.
function parseSearch(text, shortcuts, fallback) {
  const trimmed = String(text || "").trim();
  const [first, ...rest] = trimmed.split(/\s+/);
  const named = first && shortcuts.find((s) => s.name.toLowerCase() === first.toLowerCase());
  if (named) return { shortcut: named, words: rest.join(" "), named: true };
  return { shortcut: fallback, words: trimmed, named: false };
}

function searchQuery(shortcut, words) {
  return [words, shortcut.query, SEARCH_KINDS[shortcut.kind].qualifier].filter(Boolean).join(" ").trim();
}

function searchPageUrl(shortcut, words) {
  const query = searchQuery(shortcut, words);
  if (!query) return "https://github.com/search";
  return `https://github.com/search?q=${encodeURIComponent(query)}&type=${SEARCH_KINDS[shortcut.kind].type}`;
}

// Chrome refuses the whole list when one description is not valid XML, so the characters XML does not
// allow, which issue titles do carry now and then, are dropped before escaping.
const NOT_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

function escapeXml(text) {
  return String(text).replace(NOT_XML, "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
}

// parts: [[text, tag]], the tag being match, dim, url or nothing.
function describe(parts) {
  return parts
    .filter(([text]) => text)
    .map(([text, tag]) => (RICH_SUGGESTIONS && tag ? `<${tag}>${escapeXml(text)}</${tag}>` : RICH_SUGGESTIONS ? escapeXml(text) : text))
    .join(" ");
}

function shortcutSummary(shortcut, fallback) {
  const kind = SEARCH_KINDS[shortcut.kind].label;
  return `${shortcut.query ? `${kind} in ${shortcut.query}` : kind}${shortcut === fallback ? " (default)" : ""}`;
}

// Every repository of an owner, newest push first, kept for ten minutes: GitHub search matches whole
// words only, so `app` finds `webapp` through this list and not through search. The worker is stopped
// after a short idle time, so the list is also kept in session storage, which lives in memory only.
const ownerRepoCache = new Map();
const sessionStore = api.storage.session || null;

function fresh(entry) {
  return entry && Date.now() - entry.at < OWNER_REPOS_TTL_MS;
}

// The list when it is already known, without waiting: what each keystroke can show at once.
function cachedRepos(owner) {
  const hit = ownerRepoCache.get(owner.toLowerCase());
  return fresh(hit) && hit.list ? hit.list : null;
}

async function readOwnerRepos(token, owner) {
  const storeKey = `repoList:${owner.toLowerCase()}`;
  const stored = sessionStore ? (await sessionStore.get(storeKey))[storeKey] : null;
  if (fresh(stored)) return stored;
  const list = [];
  let cursor = null;
  for (let page = 0; page < OWNER_REPOS_PAGES; page++) {
    const data = await graphql(token, `{ o: repositoryOwner(login: ${JSON.stringify(owner)}) {
      repositories(first: 100, orderBy: { field: PUSHED_AT, direction: DESC }${cursor ? `, after: ${JSON.stringify(cursor)}` : ""}) {
        pageInfo { hasNextPage endCursor }
        nodes { nameWithOwner description url pushedAt }
      }
    } }`);
    const connection = data.o && data.o.repositories;
    if (!connection) break;
    list.push(...(connection.nodes || []).filter(Boolean));
    if (!connection.pageInfo || !connection.pageInfo.hasNextPage) break;
    cursor = connection.pageInfo.endCursor;
  }
  const entry = { at: Date.now(), list };
  if (sessionStore) sessionStore.set({ [storeKey]: entry }).catch(() => {});
  return entry;
}

function ownerRepos(token, owner) {
  const key = owner.toLowerCase();
  const hit = ownerRepoCache.get(key);
  if (fresh(hit)) return hit.repos;
  const repos = readOwnerRepos(token, owner).then((entry) => {
    ownerRepoCache.set(key, { at: entry.at, repos, list: entry.list });
    return entry.list;
  });
  ownerRepoCache.set(key, { at: Date.now(), repos });
  // A failed read is not kept, so the next keystroke asks again.
  repos.catch(() => ownerRepoCache.delete(key));
  return repos;
}

function repoOwners(shortcut) {
  return [...shortcut.query.matchAll(/(?:^|\s)(?:org|user):(\S+)/g)].map((m) => m[1]);
}

const NO_MATCH = 4;

// Lower is better: the name itself, then a name that starts with the words, then one where they start a
// part of it (`kafka` in `plugin-kafka`), then anywhere in it. Words with a slash are matched against
// `owner/name`, and several words read as one name, `plugin kafka` as `plugin-kafka`.
function repoRank(repo, needle) {
  if (!needle) return 0;
  const full = repo.nameWithOwner.toLowerCase();
  const name = needle.includes("/") ? full : full.slice(full.indexOf("/") + 1);
  if (name === needle) return 0;
  if (name.startsWith(needle)) return 1;
  const at = name.indexOf(needle);
  if (at > 0 && /[-_./]/.test(name[at - 1])) return 2;
  return at >= 0 ? 3 : NO_MATCH;
}

// Best rank first, then the shorter name, which is the closer one, then the order the repositories came
// in: the most recently pushed first for the owner's list, followed by GitHub search's own order.
// With no words there is nothing to be close to, so the list keeps that order, newest push first.
// GitHub search also matches descriptions, so its results are kept even when the name does not match.
function rankRepos(repos, words, { keepSearched = false } = {}) {
  const needle = words.trim().toLowerCase().replace(/\s+/g, "-");
  return repos
    .map((repo, order) => ({ repo, order, rank: repoRank(repo, needle), length: needle ? repo.nameWithOwner.length : 0 }))
    .filter((r) => r.rank < NO_MATCH || (keepSearched && r.repo.searched))
    .sort((a, b) => a.rank - b.rank || a.length - b.length || a.order - b.order)
    .map((r) => r.repo);
}

// A search still unanswered after this long is reported as such, instead of leaving the old rows in place.
const SEARCH_TIMEOUT_MS = 10 * 1000;

function timedGraphql(token, query) {
  let timer;
  return Promise.race([
    graphql(token, query, { partial: true }),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("GitHub did not answer in time")), SEARCH_TIMEOUT_MS); })
  ]).finally(() => clearTimeout(timer));
}

// A repository search made again within a short while, a word typed and erased, reuses the answer instead
// of asking GitHub twice. Issues and pull requests change too often for that and are always asked again.
const RECENT_SEARCH_MS = 30 * 1000;
const recentSearches = new Map();

function cachedGraphql(token, query) {
  const now = Date.now();
  for (const [key, hit] of recentSearches) if (now - hit.at > RECENT_SEARCH_MS) recentSearches.delete(key);
  const hit = recentSearches.get(query);
  if (hit) return hit.data;
  const data = timedGraphql(token, query);
  recentSearches.set(query, { at: now, data });
  data.catch(() => recentSearches.delete(query));
  return data;
}

function repoSearchRequest(shortcut, words) {
  const query = searchQuery(shortcut, words);
  return query ? `{ s: search(query: ${JSON.stringify(query)}, type: REPOSITORY, first: ${SEARCH_LIMIT}) {
    nodes { ... on Repository { nameWithOwner description url pushedAt } }
  } }` : null;
}

function itemSearchRequest(shortcut, words) {
  // A shortcut on its own lists what its qualifiers match, the most recently updated first.
  const query = words ? searchQuery(shortcut, words) : `${searchQuery(shortcut, words)} sort:updated-desc`;
  const parts = [`s: search(query: ${JSON.stringify(query)}, type: ISSUE, first: ${SEARCH_LIMIT}) { nodes { ${ITEM_SELECTION} } }`];
  // `#1234` or a bare number, with a single repo: qualifier, goes straight to that item.
  const number = /^#?(\d+)$/.exec(words);
  const repos = [...shortcut.query.matchAll(/(?:^|\s)repo:([^/\s]+)\/(\S+)/g)];
  if (number && repos.length === 1) {
    parts.push(`n: repository(owner: ${JSON.stringify(repos[0][1])}, name: ${JSON.stringify(repos[0][2])}) {
      issueOrPullRequest(number: ${Number(number[1])}) { ${ITEM_SELECTION} }
    }`);
  }
  return `{ ${parts.join("\n")} }`;
}

// How long ago, in the largest unit that fits: `5m ago`, `3h ago`, `4d ago`, `2mo ago`, `1y ago`.
function ago(iso) {
  const seconds = (Date.now() - Date.parse(iso)) / 1000;
  if (!Number.isFinite(seconds)) return "";
  const units = [[365 * 86400, "y"], [30 * 86400, "mo"], [86400, "d"], [3600, "h"], [60, "m"]];
  for (const [size, unit] of units) if (seconds >= size) return `${Math.floor(seconds / size)}${unit} ago`;
  return "just now";
}

// Chrome draws the same magnifier before every extension suggestion and offers no icon of its own, so
// the optional icon of a shortcut, an emoji for example, is the first character of the text instead.
function repoSuggestion(repo, icon) {
  const details = [repo.description, repo.pushedAt && `pushed ${ago(repo.pushedAt)}`].filter(Boolean).join(" · ");
  return { content: repo.url, description: describe([[icon, ""], [repo.nameWithOwner, "match"], [details, "dim"]]) };
}

function itemSuggestion(item, icon) {
  const ref = `${item.repository.nameWithOwner}#${item.number}`;
  const state = item.isDraft ? "draft" : String(item.state || "").toLowerCase();
  const details = [state, item.author && item.author.login, item.updatedAt && `updated ${ago(item.updatedAt)}`].filter(Boolean).join(" · ");
  return { content: item.url, description: describe([[icon, ""], [ref, "url"], [item.title, "match"], [details, "dim"]]) };
}

// Chrome drops suggestions that come too long after the keystroke, so a repository list still being read
// is not waited for: GitHub search answers this keystroke, and the list serves the next ones.
async function searchRepos(token, shortcut, words) {
  const owners = repoOwners(shortcut);
  owners.forEach((owner) => ownerRepos(token, owner).catch(() => {}));
  const local = Promise.resolve(rankRepos(owners.map(cachedRepos).filter(Boolean).flat(), words));
  const request = repoSearchRequest(shortcut, words);
  const remote = request
    ? cachedGraphql(token, request).then((data) => ((data.s && data.s.nodes) || []).filter((n) => n && n.url))
    : Promise.resolve([]);
  const [found, searched] = await Promise.all([local, remote]);
  const merged = [...found, ...searched.map((repo) => ({ ...repo, searched: true }))];
  return repoSuggestions(rankRepos(merged, words, { keepSearched: true }), shortcut.icon);
}

function repoSuggestions(repos, icon) {
  const seen = new Set();
  return repos
    .filter((repo) => !seen.has(repo.url) && seen.add(repo.url))
    .slice(0, SEARCH_LIMIT)
    .map((repo) => repoSuggestion(repo, icon));
}

const ITEM_SELECTION = `
  ... on Issue { number title url state updatedAt author { login } repository { nameWithOwner } }
  ... on PullRequest { number title url state isDraft updatedAt author { login } repository { nameWithOwner } }`;

async function searchItems(token, shortcut, words) {
  const data = await timedGraphql(token, itemSearchRequest(shortcut, words));
  const direct = data.n && data.n.issueOrPullRequest;
  const seen = new Set();
  return [direct, ...((data.s && data.s.nodes) || [])]
    .filter((item) => item && item.url && !seen.has(item.url) && seen.add(item.url))
    .slice(0, SEARCH_LIMIT)
    .map((item) => itemSuggestion(item, shortcut.icon));
}

function shortcutSuggestions(typed, shortcuts, fallback) {
  // While the first word is still being typed, the shortcuts it could become come first; one already
  // typed in full is not offered again, its results follow.
  if (/\s/.test(typed)) return [];
  const prefix = typed.toLowerCase();
  return shortcuts
    .filter((shortcut) => shortcut.name.toLowerCase().startsWith(prefix) && shortcut.name.toLowerCase() !== prefix)
    .map((shortcut) => ({ content: `${shortcut.name} `, description: describe([[shortcut.icon, ""], [shortcut.name, "match"], [shortcutSummary(shortcut, fallback), "dim"]]) }));
}

// What can be answered on the keystroke itself: repository names from a list already read. Null when the
// lists are not read yet or match nothing, and GitHub search has to be asked.
function instantSuggestions(text, { token, shortcuts, fallback }) {
  const typed = String(text || "").trim();
  const { shortcut, words } = parseSearch(typed, shortcuts, fallback);
  if (!token || shortcut.kind !== "repo") return null;
  const lists = repoOwners(shortcut).map(cachedRepos);
  if (!lists.length || lists.includes(null)) return null;
  const found = rankRepos(lists.flat(), words);
  if (!found.length) return null;
  return [...shortcutSuggestions(typed, shortcuts, fallback), ...repoSuggestions(found, shortcut.icon)];
}

// Whether the text is worth a request: some words, or a shortcut name on its own with something to search.
function needsSearch({ shortcut, words, named }) {
  if (!words && !named) return false;
  return Boolean(searchQuery(shortcut, words)) || (shortcut.kind === "repo" && repoOwners(shortcut).length > 0);
}

// The first row, the one Enter runs.
function defaultDescription({ shortcut, words }) {
  const scope = `${SEARCH_KINDS[shortcut.kind].label.toLowerCase()}${shortcut.query ? ` in ${shortcut.query}` : ""}`;
  return words
    ? describe([[`Search ${scope} for`, ""], [words, "match"]])
    : describe([[`Search ${scope} on GitHub`, ""]]);
}

async function searchSuggestions(text, { token, shortcuts, fallback }) {
  const typed = String(text || "").trim();
  const suggestions = shortcutSuggestions(typed, shortcuts, fallback);
  const { shortcut, words, named } = parseSearch(typed, shortcuts, fallback);
  if (!needsSearch({ shortcut, words, named })) return suggestions;
  if (!token) {
    suggestions.push({ content: OPEN_SETTINGS, description: describe([["Add a token in the extension settings to see results here", "dim"]]) });
    return suggestions;
  }
  try {
    const found = shortcut.kind === "repo"
      ? await searchRepos(token, shortcut, words)
      : await searchItems(token, shortcut, words);
    suggestions.push(...found);
  } catch (err) {
    suggestions.push({ content: OPEN_SETTINGS, description: describe([[`GitHub search failed: ${err.message || err}`, "dim"]]) });
  }
  return suggestions;
}

if (api.omnibox) {
  let latestInput = 0;

  // Reading the repository lists starts with the keyword, before the first word is typed.
  api.omnibox.onInputStarted.addListener(async () => {
    const { token, shortcuts } = await searchSettings();
    if (!token) return;
    for (const shortcut of shortcuts) {
      if (shortcut.kind === "repo") repoOwners(shortcut).forEach((owner) => ownerRepos(token, owner).catch(() => {}));
    }
  });

  // Chrome takes one list of suggestions per keystroke and silently ignores any later one, and changing
  // the first row while GitHub is asked makes it ignore the list that follows as well. So each keystroke
  // sets its first row and sends its list once, together, and the omnibox shows no "searching" state.
  api.omnibox.onInputChanged.addListener(async (text, suggest) => {
    const input = ++latestInput;
    const current = await searchSettings();
    if (input !== latestInput) return;
    const typed = String(text || "").trim();
    const parsed = parseSearch(typed, current.shortcuts, current.fallback);
    const finish = async (suggestions) => {
      // Chrome reads this text asynchronously; the list sent before it is taken would show the old one.
      try {
        await api.omnibox.setDefaultSuggestion({ description: defaultDescription(parsed) });
      } catch (err) {
        console.error("GitHub Issue Toolkit: address bar first row refused", err);
      }
      if (input !== latestInput) return;
      try {
        suggest(suggestions);
      } catch (err) {
        // A description Chrome cannot read would leave the old rows in place; plain text always reads.
        console.error("GitHub Issue Toolkit: address bar suggestions refused", err, suggestions);
        suggest(suggestions.map((s) => ({ content: s.content, description: s.description.replace(/<[^>]*>/g, "") })));
      }
    };

    if (!current.token || !needsSearch(parsed)) {
      // Nothing to ask GitHub, so the shortcut list is all there is to show.
      const hint = !current.token && needsSearch(parsed)
        ? [{ content: OPEN_SETTINGS, description: describe([["Add a token in the extension settings to see results here", "dim"]]) }]
        : [];
      return finish([...shortcutSuggestions(typed, current.shortcuts, current.fallback), ...hint]);
    }
    const instant = instantSuggestions(typed, current);
    if (instant) return finish(instant);

    // No pause before asking: Chrome drops suggestions that come too long after the keystroke. A newer
    // keystroke still wins, the answer to an older one is thrown away.
    const suggestions = await searchSuggestions(typed, current).catch((err) => {
      console.error("GitHub Issue Toolkit: address bar search failed", err);
      return [{ content: OPEN_SETTINGS, description: describe([[`GitHub search failed: ${err.message || err}`, "dim"]]) }];
    });
    if (input === latestInput) finish(suggestions);
  });

  api.omnibox.onInputEntered.addListener(async (text, disposition) => {
    if (text === OPEN_SETTINGS) {
      api.runtime.openOptionsPage();
      return;
    }
    let url = text.trim();
    if (!/^https:\/\/github\.com\//.test(url)) {
      const { shortcuts, fallback } = await searchSettings();
      const { shortcut, words } = parseSearch(text, shortcuts, fallback);
      url = searchPageUrl(shortcut, words);
    }
    if (disposition === "newForegroundTab") api.tabs.create({ url });
    else if (disposition === "newBackgroundTab") api.tabs.create({ url, active: false });
    else api.tabs.update({ url });
  });
}

// ---------------------------------------------------------------------------
// Epic kanban: every sub-issue of one issue, with the field values the board groups and orders by
// ---------------------------------------------------------------------------

const SUB_ISSUE_PAGE = 100;
const SUB_ISSUE_MAX_PAGES = 5;
// Whether this GitHub knows the option list of a single-select field: unknown until one query has answered.
// A deployment that does not know it is asked again after a while, so one passing error never disables the
// column order and the drag targets for the rest of the worker's life.
let selectOptionsKnown = null;
let selectOptionsRetryAt = 0;
const SELECT_OPTIONS_RETRY_MS = 10 * 60 * 1000;
// The validation error GraphQL returns for a selection the schema does not have, and nothing else.
const UNKNOWN_OPTIONS_SELECTION = /Field 'options' doesn't exist on type 'IssueFieldSingleSelect'/;

function subIssueQuery(ref, cursor, withOptions) {
  return `{ r: repository(owner: ${JSON.stringify(ref.owner)}, name: ${JSON.stringify(ref.repo)}) {
    issue(number: ${Number(ref.number)}) {
      number
      title
      subIssues(first: ${SUB_ISSUE_PAGE}${cursor ? `, after: ${JSON.stringify(cursor)}` : ""}) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes {
          id number title url state stateReason createdAt
          repository { nameWithOwner }
          issueType { name color }
          assignees(first: 3) { nodes { login avatarUrl } }
          ${fieldValueFragment(withOptions)}
        }
      }
    }
  } }`;
}

async function subIssuePage(token, ref, cursor) {
  if (selectOptionsKnown === false && Date.now() >= selectOptionsRetryAt) selectOptionsKnown = null;
  if (selectOptionsKnown !== false) {
    try {
      const data = await graphql(token, subIssueQuery(ref, cursor, true), { partial: true });
      selectOptionsKnown = true;
      return data;
    } catch (err) {
      // Only an unknown `options` selection is worth a second, plainer attempt; anything else is the real answer.
      if (!UNKNOWN_OPTIONS_SELECTION.test(err.message || "")) throw err;
      selectOptionsKnown = false;
      selectOptionsRetryAt = Date.now() + SELECT_OPTIONS_RETRY_MS;
    }
  }
  return graphql(token, subIssueQuery(ref, cursor, false), { partial: true });
}

function subIssueItem(node) {
  const nameWithOwner = node.repository ? node.repository.nameWithOwner : "";
  const [owner, repo] = nameWithOwner.split("/");
  const values = [];
  for (const valueNode of (node.issueFieldValues && node.issueFieldValues.nodes) || []) {
    const value = fieldValue(valueNode);
    if (value) values.push(value);
  }
  return {
    key: `${nameWithOwner}#${node.number}`,
    id: node.id,
    owner,
    repo,
    number: node.number,
    title: node.title,
    url: node.url,
    state: node.state,
    stateReason: node.stateReason || null,
    createdAt: node.createdAt,
    type: node.issueType ? node.issueType.name : null,
    typeColor: node.issueType ? node.issueType.color : null,
    assignees: ((node.assignees && node.assignees.nodes) || []).map((a) => ({ login: a.login, avatarUrl: a.avatarUrl })),
    values
  };
}

// All sub-issues of `ref`, paginated, with every field value they carry: the board groups and orders by
// fields that are not necessarily among the ones configured for badges.
async function fetchEpic(ref) {
  const { token, fields } = await getSettings();
  if (!token) return { error: "NO_TOKEN" };
  const items = [];
  let cursor = null;
  let total = 0;
  for (let page = 0; page < SUB_ISSUE_MAX_PAGES; page++) {
    const data = await subIssuePage(token, ref, cursor);
    const issue = data.r && data.r.issue;
    if (!issue) return { error: `Issue ${ref.owner}/${ref.repo}#${ref.number} not found or not accessible with this token.` };
    const connection = issue.subIssues || {};
    total = connection.totalCount || total;
    for (const node of connection.nodes || []) {
      if (node) items.push(subIssueItem(node));
    }
    if (!connection.pageInfo || !connection.pageInfo.hasNextPage) break;
    cursor = connection.pageInfo.endCursor;
  }
  return { items, total, fields };
}

// Moving a card writes to GitHub: a single-select field value, or the state of the issue. Nothing else
// is written, and only a drag the user performed asks for it.
async function moveIssue(move) {
  const { token } = await getSettings();
  if (!token) return { error: "NO_TOKEN" };
  const issueId = JSON.stringify(String(move.issueId || ""));
  if (move.kind === "state") {
    // An issue that was closed as not planned is closed that way again; everything else is completed.
    const reason = move.stateReason === "NOT_PLANNED" ? "NOT_PLANNED" : "COMPLETED";
    const mutation = move.state === "CLOSED"
      ? `mutation { closeIssue(input: { issueId: ${issueId}, stateReason: ${reason} }) { issue { number state } } }`
      : `mutation { reopenIssue(input: { issueId: ${issueId} }) { issue { number state } } }`;
    await graphql(token, mutation);
    return { ok: true };
  }
  if (move.kind !== "field" || !move.fieldId) return { error: "This column cannot be a drop target." };
  const fieldId = JSON.stringify(String(move.fieldId));
  if (!move.optionId) {
    await graphql(token, `mutation { deleteIssueFieldValue(input: { issueId: ${issueId}, fieldId: ${fieldId} }) { success } }`);
    return { ok: true };
  }
  const set = `mutation { createIssueFieldValue(input: { issueId: ${issueId}, issueField: { fieldId: ${fieldId}, singleSelectOptionId: ${JSON.stringify(String(move.optionId))} } }) { issueFieldValue { __typename } } }`;
  try {
    await graphql(token, set);
  } catch (err) {
    // The input is a create-or-update, but a deployment that refuses to overwrite gets the value cleared first.
    if (!/exist/i.test(err.message || "")) throw err;
    await graphql(token, `mutation { deleteIssueFieldValue(input: { issueId: ${issueId}, fieldId: ${fieldId} }) { success } }`);
    await graphql(token, set);
  }
  return { ok: true };
}

function issueSelection(ref) {
  return `repository(owner: ${JSON.stringify(ref.owner)}, name: ${JSON.stringify(ref.repo)}) {
    nameWithOwner
    issue(number: ${Number(ref.number)}) {
      id number title state url createdAt
      issueType { name color }
      parent { number repository { nameWithOwner } }
    }
  }`;
}

function pickIssue(repoNode) {
  if (!repoNode || !repoNode.issue) return null;
  const i = repoNode.issue;
  return {
    id: i.id,
    number: i.number,
    title: i.title,
    state: i.state,
    url: i.url,
    createdAt: i.createdAt,
    type: i.issueType ? i.issueType.name : null,
    typeColor: i.issueType ? i.issueType.color : null,
    parent: i.parent ? `${i.parent.repository.nameWithOwner}#${i.parent.number}` : null,
    nameWithOwner: repoNode.nameWithOwner
  };
}

// Title, type and node id of one issue, used when pinning it.
async function fetchIssueMeta(ref) {
  const { token } = await getSettings();
  if (!token) return { error: "NO_TOKEN" };
  const data = await graphql(token, `{ r: ${issueSelection(ref)} }`);
  const issue = pickIssue(data.r);
  if (!issue) return { error: `Issue ${ref.owner}/${ref.repo}#${ref.number} not found or not accessible with this token.` };
  return { issue };
}

// Make `child` a sub-issue of `parent`. Needs a token with write access to the child's repository.
async function linkSubIssue(parent, child, replaceParent) {
  const { token } = await getSettings();
  if (!token) return { error: "NO_TOKEN" };
  const data = await graphql(token, `{ p: ${issueSelection(parent)} c: ${issueSelection(child)} }`);
  const p = pickIssue(data.p);
  const c = pickIssue(data.c);
  if (!p) return { error: `Epic ${parent.owner}/${parent.repo}#${parent.number} not found.` };
  if (!c) return { error: `Issue ${child.owner}/${child.repo}#${child.number} not found.` };
  if (c.parent && !replaceParent) {
    return { error: "HAS_PARENT", parent: c.parent };
  }
  const mutation = `mutation {
    addSubIssue(input: { issueId: ${JSON.stringify(p.id)}, subIssueId: ${JSON.stringify(c.id)}, replaceParent: ${replaceParent ? "true" : "false"} }) {
      issue { number }
      subIssue { number }
    }
  }`;
  await graphql(token, mutation);
  return { ok: true, parent: `${p.nameWithOwner}#${p.number}`, child: `${c.nameWithOwner}#${c.number}` };
}

function reply(promise, sendResponse) {
  promise
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.message || String(err) }));
  return true;
}

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return false;
  if (msg.type === "fetchFieldValues") {
    return reply(fetchFieldValues(msg.issues || []), sendResponse);
  }
  if (msg.type === "fetchPullRequests") {
    return reply(fetchPullRequests(msg.pulls || []), sendResponse);
  }
  if (msg.type === "viewerLogin") {
    return reply(viewer().then((login) => ({ login })), sendResponse);
  }
  if (msg.type === "fetchContributorLoad") {
    return reply(fetchContributorLoad(msg.contributor), sendResponse);
  }
  if (msg.type === "fetchEpic") {
    return reply(fetchEpic(msg.issue), sendResponse);
  }
  if (msg.type === "moveIssue") {
    return reply(moveIssue(msg.move || {}), sendResponse);
  }
  if (msg.type === "fetchIssueMeta") {
    return reply(fetchIssueMeta(msg.issue), sendResponse);
  }
  if (msg.type === "linkSubIssue") {
    return reply(linkSubIssue(msg.parent, msg.child, Boolean(msg.replaceParent)), sendResponse);
  }
  if (msg.type === "openOptions") {
    api.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }
  if (msg.type === "testToken") {
    return reply((async () => {
      const token = String(msg.token || "").trim();
      if (!token) return { error: "No token given" };
      const data = await graphql(token, "{ viewer { login } }");
      viewerLogin = null;
      return { login: data.viewer && data.viewer.login };
    })(), sendResponse);
  }
  return false;
});

api.action.onClicked.addListener(() => {
  api.runtime.openOptionsPage();
});
