// Background script (service worker on Chromium, event page on Firefox): performs
// the GitHub GraphQL calls on behalf of the content script so the token never has
// to live in the page context.
const api = typeof browser !== "undefined" && browser.runtime ? browser : chrome;

const GRAPHQL_URL = "https://api.github.com/graphql";

async function getSettings() {
  const stored = await api.storage.local.get(["token", "fields"]);
  return {
    token: (stored.token || "").trim(),
    fields: parseFields(stored.fields)
  };
}

function parseFields(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function graphql(token, query) {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "gh-subissue-fields-extension"
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
  if (json.errors && !json.data) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data || {};
}

const FIELD_VALUE_FRAGMENT = `
  issueFieldValues(first: 30) {
    nodes {
      __typename
      ... on IssueFieldSingleSelectValue { name color field { ... on IssueFieldSingleSelect { name } } }
      ... on IssueFieldMultiSelectValue { value field { ... on IssueFieldMultiSelect { name } } }
      ... on IssueFieldTextValue { value field { ... on IssueFieldText { name } } }
      ... on IssueFieldNumberValue { value field { ... on IssueFieldNumber { name } } }
      ... on IssueFieldDateValue { value field { ... on IssueFieldDate { name } } }
    }
  }`;

// issues: [{owner, repo, number}] -> { "owner/repo#number": [{field, value, color}] }
async function fetchFieldValues(issues) {
  const { token, fields } = await getSettings();
  if (!token) {
    return { error: "NO_TOKEN" };
  }
  if (!fields.length) {
    return { error: "NO_FIELDS" };
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
      (n) => `i${n}: issue(number: ${n}) { number ${FIELD_VALUE_FRAGMENT} }`
    );
    repoParts.push(
      `r${r++}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(repo)}) { nameWithOwner ${issueParts.join("\n")} }`
    );
  }

  const data = await graphql(token, `{ ${repoParts.join("\n")} }`);
  const wanted = new Set(fields.map((f) => f.toLowerCase()));
  const result = {};

  for (const repoNode of Object.values(data)) {
    if (!repoNode || !repoNode.nameWithOwner) continue;
    for (const [alias, issueNode] of Object.entries(repoNode)) {
      if (!alias.startsWith("i") || !issueNode || !issueNode.issueFieldValues) continue;
      const key = `${repoNode.nameWithOwner}#${issueNode.number}`;
      const values = [];
      for (const node of issueNode.issueFieldValues.nodes || []) {
        const fieldName = node.field && node.field.name;
        if (!fieldName || !wanted.has(fieldName.toLowerCase())) continue;
        const value = node.__typename === "IssueFieldSingleSelectValue" ? node.name : node.value;
        if (value === null || value === undefined || value === "") continue;
        values.push({ field: fieldName, value: String(value), color: node.color || "GRAY" });
      }
      // keep the order the user configured
      values.sort((a, b) => fields.findIndex((f) => f.toLowerCase() === a.field.toLowerCase())
        - fields.findIndex((f) => f.toLowerCase() === b.field.toLowerCase()));
      result[key] = values;
    }
  }
  return { values: result, fields };
}

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "fetchFieldValues") {
    fetchFieldValues(msg.issues || [])
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message || String(err) }));
    return true;
  }
  if (msg && msg.type === "openOptions") {
    api.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }
  if (msg && msg.type === "testToken") {
    (async () => {
      const token = String(msg.token || "").trim();
      if (!token) return { error: "No token given" };
      const data = await graphql(token, "{ viewer { login } }");
      return { login: data.viewer && data.viewer.login };
    })()
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message || String(err) }));
    return true;
  }
  return false;
});

// Toolbar icon click opens the settings page.
api.action.onClicked.addListener(() => {
  api.runtime.openOptionsPage();
});
