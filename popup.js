const api = typeof browser !== "undefined" && browser.runtime ? browser : (typeof chrome !== "undefined" ? chrome : undefined);
const hasChrome = Boolean(api && api.storage && api.runtime);
const HOSTS = ["https://github.com/*", "https://api.github.com/*"];

// The switches: storage key, label and the value when nothing is stored, the same defaults as the settings page.
// What needs typing, the token, the field names, thresholds and address bar shortcuts, stays on that page.
const GROUPS = [
  { title: "Badges", items: [
    { key: "ageEnabled", label: "Issue age", def: false },
    { key: "skipShownFields", label: "Skip fields the view already shows", def: true }
  ] },
  { title: "Pull requests", items: [
    { key: "prAssociation", label: "Author's relation to the repository", def: true },
    { key: "prFork", label: "Opened from a fork", def: false },
    { key: "prSize", label: "Size", def: false },
    { key: "prMergeState", label: "Merge state", def: false }
  ] },
  { title: "Projects and epics", items: [
    { key: "progressEnabled", label: "Sub-issue progress for the view's scope", def: false },
    { key: "kanbanEnabled", label: "Kanban toggle on sub-issue lists", def: true },
    { key: "kanbanDrag", label: "Move cards by dragging them", def: true }
  ] },
  { title: "Issue pages", items: [
    { key: "sidebarToggle", label: "Button that hides the sidebar", def: true },
    { key: "hideProjectsSection", label: "Hide the Projects section", def: false },
    { key: "loadEnabled", label: "Contributor load next to usernames", def: false },
    { key: "pinsEnabled", label: "Pinned issues button in the top bar", def: true }
  ] }
];

const inputs = new Map();
const groupsEl = document.getElementById("groups");
const tokenState = document.getElementById("token-state");

for (const group of GROUPS) {
  const title = document.createElement("h2");
  title.textContent = group.title;
  const rows = group.items.map((item) => {
    const row = document.createElement("label");
    row.className = "row";
    const text = document.createElement("span");
    text.textContent = item.label;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "switch";
    input.checked = item.def;
    input.addEventListener("change", () => {
      if (hasChrome) api.storage.local.set({ [item.key]: input.checked });
    });
    inputs.set(item.key, { input, item });
    row.append(text, input);
    return row;
  });
  groupsEl.append(title, ...rows);
}

// Only the keys present in `stored` are touched, so a change to one switch leaves the others as they are.
function apply(stored) {
  for (const { input, item } of inputs.values()) {
    if (!(item.key in stored)) continue;
    const value = stored[item.key];
    input.checked = value === undefined ? item.def : (item.def ? value !== false : value === true);
  }
}

function showToken(token) {
  tokenState.textContent = token ? "Token saved" : "No token yet";
  tokenState.className = token ? "ok" : "missing";
}

document.getElementById("more").addEventListener("click", () => {
  if (hasChrome) api.runtime.openOptionsPage();
  window.close();
});

if (hasChrome) {
  const keys = ["token", ...inputs.keys()];
  api.storage.local.get(keys).then((stored) => {
    // A key never saved is missing from the answer; it still gets its default.
    apply(Object.fromEntries([...inputs.keys()].map((key) => [key, stored[key]])));
    showToken(String(stored.token || "").trim());
  });
  // The settings page, or another popup, can change a switch while this one is open.
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const next = {};
    for (const [key, change] of Object.entries(changes)) next[key] = change.newValue;
    apply(next);
    if (changes.token) showToken(String(changes.token.newValue || "").trim());
  });
  if (api.permissions) {
    api.permissions.contains({ origins: HOSTS }).then((granted) => {
      document.getElementById("access").hidden = granted;
    });
    document.getElementById("grant").addEventListener("click", async () => {
      const ok = await api.permissions.request({ origins: HOSTS });
      document.getElementById("access").hidden = ok;
    });
  }
} else {
  showToken("preview");
}
