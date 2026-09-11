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

async function fetchFieldValues(issues) {
  const { token, fields, ageEnabled } = await getSettings();
  if (!token) {
    return { error: "NO_TOKEN" };
  }
  if (!fields.length && !ageEnabled) {
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
        const fieldName = node.field && node.field.name;
        if (!fieldName || !wanted.has(fieldName.toLowerCase())) continue;
        const value = node.__typename === "IssueFieldSingleSelectValue" ? node.name : node.value;
        if (value === null || value === undefined || value === "") continue;
        values.push({ field: fieldName, value: String(value), color: node.color || "GRAY" });
      }
      values.sort((a, b) => fields.findIndex((f) => f.toLowerCase() === a.field.toLowerCase())
        - fields.findIndex((f) => f.toLowerCase() === b.field.toLowerCase()));
      result[key] = values;
    }
  }
  return { values: result, created, fields };
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
      return { login: data.viewer && data.viewer.login };
    })(), sendResponse);
  }
  return false;
});

api.action.onClicked.addListener(() => {
  api.runtime.openOptionsPage();
});
