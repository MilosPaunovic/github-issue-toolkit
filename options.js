const tokenInput = document.getElementById("token");
const chips = document.getElementById("chips");
const fieldInput = document.getElementById("field-input");
const status = document.getElementById("status");
const toggle = document.getElementById("toggle");
const ageEnabled = document.getElementById("age-enabled");
const ageUnit = document.getElementById("age-unit");
const ageWarn = document.getElementById("age-warn");
const pinsEnabledInput = document.getElementById("pins-enabled");
const skipShownInput = document.getElementById("skip-shown");
const kanbanEnabledInput = document.getElementById("kanban-enabled");
const kanbanDragInput = document.getElementById("kanban-drag");
const sidebarToggleInput = document.getElementById("sidebar-toggle");
const hideProjectsInput = document.getElementById("hide-projects");
const loadEnabledInput = document.getElementById("load-enabled");
const loadLimit = document.getElementById("load-limit");
const loadAutoInput = document.getElementById("load-auto");
const membersSkip = document.getElementById("members-skip");
const membersMark = document.getElementById("members-mark");
const membersPlain = document.getElementById("members-plain");

// What happens to members of the organization is one stored choice: "show" (the default), "skip" or "plain".
function showMembersMode(mode) {
  membersSkip.checked = mode === "skip";
  membersPlain.checked = mode === "plain";
  membersMark.checked = !membersSkip.checked && !membersPlain.checked;
}
const profileEnabledInput = document.getElementById("profile-enabled");
const profileFoldedInput = document.getElementById("profile-folded");
const relatedEnabledInput = document.getElementById("related-enabled");
const relatedFoldedInput = document.getElementById("related-folded");
const assignFoldedInput = document.getElementById("assign-folded");
const assignPrivateInput = document.getElementById("assign-private");
const profileOrgsInput = document.getElementById("profile-orgs");
const assignEnabledInput = document.getElementById("assign-enabled");
const assignWordsInput = document.getElementById("assign-words");
const assignChips = document.getElementById("assign-chips");
// The same list as content.js, which uses it when none is saved.
const ASSIGN_DEFAULT_WORDS = ["assign", "work on", "working on", "take this", "take on", "pick this", "pick up", "can i", "may i", "i'd like to", "i would like to", "would love to", "i'd love to", "i want to", "let me work", "let me take", "let me try", "let me handle", "give it a shot", "give it a try", "have a go", "still available", "is this available", "start working", "volunteer", "claim", "contribute", "interested"];
let assignWords = ASSIGN_DEFAULT_WORDS.slice();
const loadRegular = document.getElementById("load-regular");
const progressEnabledInput = document.getElementById("progress-enabled");
const progressScope = document.getElementById("progress-scope");
const progressDoneField = document.getElementById("progress-done-field");
const progressDoneValue = document.getElementById("progress-done-value");
const prInputs = {
  prAssociation: document.getElementById("pr-association"),
  prFork: document.getElementById("pr-fork"),
  prSize: document.getElementById("pr-size"),
  prMergeState: document.getElementById("pr-merge-state")
};
const pinsCount = document.getElementById("pins-count");
const api = typeof browser !== "undefined" && browser.runtime ? browser : (typeof chrome !== "undefined" ? chrome : undefined);
const hasChrome = Boolean(api && api.storage && api.runtime);
const HOSTS = ["https://github.com/*", "https://api.github.com/*"];

const shortcutList = document.getElementById("shortcuts");
// Same defaults and kinds as background.js, which uses these until a list is saved.
const DEFAULT_SHORTCUTS = [
  { name: "repo", icon: "📦", kind: "repo", query: "" },
  { name: "pr", icon: "🔀", kind: "pr", query: "is:open" }
];
const SHORTCUT_KINDS = { repo: "Repositories", issue: "Issues", pr: "Pull requests" };

const TABS = ["home", "access", "badges", "pulls", "epics", "contributors", "shortcuts"];
const savebar = document.getElementById("savebar");
const dirtyNote = document.getElementById("dirty");
const discardButton = document.getElementById("discard");

// Anything typed or ticked, a tag added or removed, is not saved until Save is pressed, and the bar says so.
function markDirty() {
  savebar.dataset.dirty = "1";
  dirtyNote.hidden = false;
  discardButton.hidden = false;
}

function clearDirty() {
  delete savebar.dataset.dirty;
  dirtyNote.hidden = true;
  discardButton.hidden = true;
}

document.addEventListener("input", (e) => { if (e.target.closest && e.target.closest(".panel")) markDirty(); });
document.addEventListener("change", (e) => { if (e.target.closest && e.target.closest(".panel")) markDirty(); });
let currentTab = "";

let fields = [];
let shortcuts = [];
let defaultShortcut = 0;

// The save bar is always there, except on Home while it has nothing to say.
function updateBar() {
  savebar.hidden = currentTab === "home" && !status.textContent;
}

function setStatus(text, ok) {
  status.textContent = text;
  status.className = ok ? "ok" : "err";
  updateBar();
}

// A user's own choice of tab also counts as having read the welcome, so Home opens by itself only once.
function showTab(name, byUser) {
  if (!TABS.includes(name)) name = "badges";
  currentTab = name;
  for (const id of TABS) {
    const on = id === name;
    document.getElementById(`panel-${id}`).hidden = !on;
    const tab = document.getElementById(`tab-${id}`);
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
  }
  status.textContent = "";
  status.className = "";
  updateBar();
  try { localStorage.setItem("tab", name); } catch (_) { /* private mode: the tab is just not remembered */ }
  if (byUser && name !== "home" && hasChrome) api.storage.local.set({ welcomeSeen: true });
}

function initialTab(welcomeSeen) {
  const hash = location.hash.slice(1);
  if (TABS.includes(hash)) return hash;
  if (!welcomeSeen) return "home";
  let last = "";
  try { last = localStorage.getItem("tab") || ""; } catch (_) { /* see showTab */ }
  return TABS.includes(last) ? last : "badges";
}

document.querySelectorAll("[data-tab]").forEach((el) => el.addEventListener("click", () => showTab(el.dataset.tab, true)));
document.querySelector(".tabs").addEventListener("keydown", (e) => {
  const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
  if (!step) return;
  e.preventDefault();
  const next = TABS[(TABS.indexOf(currentTab) + step + TABS.length) % TABS.length];
  showTab(next, true);
  document.getElementById(`tab-${next}`).focus();
});

function renderHomeToken(token) {
  const pill = document.getElementById("home-token");
  pill.textContent = token ? "Token saved" : "No token yet";
  pill.className = `pill ${token ? "ok" : "warn"}`;
  document.getElementById("home-add-token").hidden = Boolean(token);
}

function renderAssignWords() {
  assignChips.textContent = "";
  assignWords.forEach((word, i) => {
    const chip = document.createElement("span");
    chip.className = "chip c5";
    chip.setAttribute("role", "listitem");
    const label = document.createElement("span");
    label.textContent = word;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${word}`);
    remove.title = `Remove ${word}`;
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      assignWords.splice(i, 1);
      markDirty();
      renderAssignWords();
      assignWordsInput.focus();
    });
    chip.append(label, remove);
    assignChips.append(chip);
  });
}

function addAssignWords(raw) {
  for (const word of String(raw || "").split(",").map((w) => w.trim()).filter(Boolean)) {
    if (!assignWords.some((w) => w.toLowerCase() === word.toLowerCase())) assignWords.push(word);
  }
  assignWordsInput.value = "";
  markDirty();
  renderAssignWords();
}

assignWordsInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    addAssignWords(assignWordsInput.value);
  }
});
assignWordsInput.addEventListener("blur", () => { if (assignWordsInput.value.trim()) addAssignWords(assignWordsInput.value); });
document.getElementById("assign-reset").addEventListener("click", () => {
  assignWords = ASSIGN_DEFAULT_WORDS.slice();
  markDirty();
  renderAssignWords();
});

function renderPinsCount(pins) {
  const n = Array.isArray(pins) ? pins.length : 0;
  pinsCount.textContent = n ? `${n} pinned issue${n === 1 ? "" : "s"}.` : "No pinned issues.";
  document.getElementById("pins-clear").disabled = !n;
}

function parseFields(raw) {
  return String(raw || "").split(",").map((s) => s.trim()).filter(Boolean);
}

function renderChips() {
  chips.querySelectorAll(".chip").forEach((el) => el.remove());
  fields.forEach((name, i) => {
    const chip = document.createElement("span");
    chip.className = `chip c${i % 6}`;
    chip.setAttribute("role", "listitem");
    const label = document.createElement("span");
    label.textContent = name;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${name}`);
    remove.title = `Remove ${name}`;
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      fields.splice(i, 1);
      markDirty();
      renderChips();
      fieldInput.focus();
    });
    chip.append(label, remove);
    chips.insertBefore(chip, fieldInput);
  });
  fieldInput.placeholder = fields.length ? "Add another field" : "Add a field and press Enter";
}

function addField(raw) {
  for (const name of parseFields(raw)) {
    if (!fields.some((f) => f.toLowerCase() === name.toLowerCase())) fields.push(name);
  }
  fieldInput.value = "";
  markDirty();
  renderChips();
}

fieldInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    addField(fieldInput.value);
  } else if (e.key === "Backspace" && fieldInput.value === "" && fields.length) {
    fields.pop();
    renderChips();
  }
});
fieldInput.addEventListener("blur", () => { if (fieldInput.value.trim()) addField(fieldInput.value); });
fieldInput.addEventListener("paste", (e) => {
  const text = (e.clipboardData || window.clipboardData).getData("text");
  if (text.includes(",")) { e.preventDefault(); addField(text); }
});
chips.addEventListener("click", (e) => { if (e.target === chips) fieldInput.focus(); });

function loadShortcuts(saved, defaultName) {
  const list = Array.isArray(saved) && saved.length ? saved : DEFAULT_SHORTCUTS;
  shortcuts = list.map((s) => ({ name: s.name || "", icon: s.icon || "", kind: SHORTCUT_KINDS[s.kind] ? s.kind : "repo", query: s.query || "" }));
  const wanted = String(defaultName || "").toLowerCase();
  defaultShortcut = Math.max(0, shortcuts.findIndex((s) => s.name.toLowerCase() === wanted));
  renderShortcuts();
}

function renderShortcuts() {
  shortcutList.replaceChildren(...shortcuts.map((shortcut, i) => {
    const row = document.createElement("div");
    row.className = "shortcut";
    const name = document.createElement("input");
    name.type = "text";
    name.spellcheck = false;
    name.placeholder = "repo";
    name.value = shortcut.name;
    name.setAttribute("aria-label", `Shortcut ${i + 1} name`);
    name.addEventListener("input", () => { shortcut.name = name.value.trim(); });
    const icon = document.createElement("input");
    icon.type = "text";
    icon.spellcheck = false;
    icon.maxLength = 8;
    icon.value = shortcut.icon;
    icon.title = "Optional, shown before each result of this shortcut";
    icon.setAttribute("aria-label", `Shortcut ${i + 1} icon`);
    icon.addEventListener("input", () => { shortcut.icon = icon.value.trim(); });
    const kind = document.createElement("select");
    kind.setAttribute("aria-label", `Shortcut ${i + 1} searches`);
    for (const [value, label] of Object.entries(SHORTCUT_KINDS)) kind.add(new Option(label, value, false, value === shortcut.kind));
    kind.addEventListener("change", () => { shortcut.kind = kind.value; });
    const query = document.createElement("input");
    query.type = "text";
    query.spellcheck = false;
    query.placeholder = "org:acme";
    query.value = shortcut.query;
    query.setAttribute("aria-label", `Shortcut ${i + 1} qualifiers`);
    query.addEventListener("input", () => { shortcut.query = query.value.trim(); });
    const isDefault = document.createElement("input");
    isDefault.type = "radio";
    isDefault.name = "shortcut-default";
    isDefault.checked = i === defaultShortcut;
    isDefault.setAttribute("aria-label", `Shortcut ${i + 1} is the default`);
    isDefault.addEventListener("change", () => { defaultShortcut = i; });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = "Remove this shortcut";
    remove.setAttribute("aria-label", `Remove shortcut ${i + 1}`);
    remove.disabled = shortcuts.length === 1;
    remove.addEventListener("click", () => {
      shortcuts.splice(i, 1);
      if (defaultShortcut >= i && defaultShortcut > 0) defaultShortcut--;
      markDirty();
      renderShortcuts();
    });
    row.append(name, icon, kind, query, isDefault, remove);
    return row;
  }));
}

document.getElementById("shortcut-add").addEventListener("click", () => {
  shortcuts.push({ name: "", icon: "", kind: "issue", query: "" });
  markDirty();
  renderShortcuts();
  shortcutList.lastElementChild.querySelector("input").focus();
});

// The shortcuts to save, or the reason they cannot be: a name is one word, and no two are the same.
function checkShortcuts() {
  const kept = shortcuts.filter((s) => s.name || s.query);
  const seen = new Set();
  for (const s of kept) {
    if (!s.name) return { error: "Every address bar shortcut needs a name." };
    if (/\s/.test(s.name)) return { error: `The shortcut name "${s.name}" must be one word.` };
    if (seen.has(s.name.toLowerCase())) return { error: `Two address bar shortcuts are named "${s.name}".` };
    seen.add(s.name.toLowerCase());
  }
  if (!kept.length) return { error: "Keep at least one address bar shortcut." };
  const chosen = shortcuts[defaultShortcut];
  return { list: kept, defaultName: kept.includes(chosen) ? chosen.name : kept[0].name };
}

async function refreshAccess() {
  const box = document.getElementById("access");
  if (!hasChrome || !api.permissions) return;
  const granted = await api.permissions.contains({ origins: HOSTS });
  box.hidden = granted;
  document.getElementById("home-access").hidden = granted;
}

if (hasChrome) {
  refreshAccess();
  document.getElementById("grant").addEventListener("click", async () => {
    const ok = await api.permissions.request({ origins: HOSTS });
    setStatus(ok ? "Access to github.com granted." : "Access was not granted.", ok);
    refreshAccess();
  });
  // What is saved, put back on the page: at the start, and again when changes are discarded.
  const STORED_KEYS = ["token", "fields", "ageEnabled", "ageUnit", "ageWarnDays", "pinsEnabled", "skipShownFields", "kanbanEnabled", "kanbanDrag", "sidebarToggle", "hideProjectsSection", "prAssociation", "prFork", "prSize", "prMergeState", "loadEnabled", "loadAuto", "loadMembersMode", "profileEnabled", "profileOrgs", "assignEnabled", "assignFolded", "assignPrivate", "profileFolded", "relatedEnabled", "relatedFolded", "assignWords", "loadLimit", "loadRegular", "progressEnabled", "progressScopeField", "progressDoneField", "progressDoneValue", "searchShortcuts", "searchDefault", "pins", "welcomeSeen"];
  function applyStored(stored, first) {
    tokenInput.value = stored.token || "";
    renderHomeToken(String(stored.token || "").trim());
    fields = parseFields(stored.fields);
    renderChips();
    ageEnabled.checked = stored.ageEnabled === true;
    pinsEnabledInput.checked = stored.pinsEnabled !== false;
    skipShownInput.checked = stored.skipShownFields !== false;
    kanbanEnabledInput.checked = stored.kanbanEnabled !== false;
    kanbanDragInput.checked = stored.kanbanDrag !== false;
    sidebarToggleInput.checked = stored.sidebarToggle !== false;
    hideProjectsInput.checked = stored.hideProjectsSection === true;
    loadEnabledInput.checked = stored.loadEnabled === true;
    loadAutoInput.checked = stored.loadAuto === true;
    showMembersMode(stored.loadMembersMode);
    profileEnabledInput.checked = stored.profileEnabled === true;
    profileFoldedInput.checked = stored.profileFolded !== false;
    relatedEnabledInput.checked = stored.relatedEnabled !== false;
    relatedFoldedInput.checked = stored.relatedFolded !== false;
    assignFoldedInput.checked = stored.assignFolded !== false;
    assignPrivateInput.checked = stored.assignPrivate === true;
    profileOrgsInput.value = stored.profileOrgs || "";
    assignEnabledInput.checked = stored.assignEnabled === true;
    const savedWords = String(stored.assignWords || "").split(",").map((w) => w.trim()).filter(Boolean);
    assignWords = savedWords.length ? savedWords : ASSIGN_DEFAULT_WORDS.slice();
    renderAssignWords();
    loadLimit.value = stored.loadLimit === undefined ? 1 : stored.loadLimit;
    loadRegular.value = stored.loadRegular === undefined ? 5 : stored.loadRegular;
    progressEnabledInput.checked = stored.progressEnabled === true;
    progressScope.value = stored.progressScopeField || "";
    progressDoneField.value = stored.progressDoneField || "";
    progressDoneValue.value = stored.progressDoneValue || "";
    prInputs.prAssociation.checked = stored.prAssociation !== false;
    prInputs.prFork.checked = stored.prFork === true;
    prInputs.prSize.checked = stored.prSize === true;
    prInputs.prMergeState.checked = stored.prMergeState === true;
    ageUnit.value = stored.ageUnit || "months";
    ageWarn.value = stored.ageWarnDays === undefined ? 90 : stored.ageWarnDays;
    loadShortcuts(stored.searchShortcuts, stored.searchDefault);
    renderPinsCount(stored.pins);
    if (first) showTab(initialTab(stored.welcomeSeen === true), false);
  }
  function loadFromStorage(first) {
    return api.storage.local.get(STORED_KEYS).then((stored) => applyStored(stored, first));
  }
  loadFromStorage(true);
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.pins) renderPinsCount(changes.pins.newValue);
    if (changes.token) renderHomeToken(String(changes.token.newValue || "").trim());
  });
  document.getElementById("pins-clear").addEventListener("click", async () => {
    await api.storage.local.set({ pins: [] });
    setStatus("All pins removed.", true);
  });
  document.getElementById("version").textContent = `v${api.runtime.getManifest().version}`;
} else {
  document.documentElement.classList.add("preview");
  showTab(initialTab(false), false);
  renderChips();
  renderPinsCount([]);
  loadShortcuts(DEFAULT_SHORTCUTS, "repo");
  pinsEnabledInput.checked = true;
  skipShownInput.checked = true;
  kanbanEnabledInput.checked = true;
  kanbanDragInput.checked = true;
  sidebarToggleInput.checked = true;
  prInputs.prAssociation.checked = true;
  ageWarn.value = 90;
  loadLimit.value = 1;
  loadRegular.value = 5;
  showMembersMode("show");
  renderAssignWords();
}

toggle.addEventListener("click", () => {
  const show = tokenInput.type === "password";
  tokenInput.type = show ? "text" : "password";
  toggle.textContent = show ? "Hide" : "Show";
});

document.getElementById("save").addEventListener("click", async () => {
  if (fieldInput.value.trim()) addField(fieldInput.value);
  const token = tokenInput.value.trim();
  const fieldList = fields.join(", ");
  const search = checkShortcuts();
  if (search.error) return setStatus(search.error, false);
  if (Boolean(progressDoneField.value.trim()) !== Boolean(progressDoneValue.value.trim())) return setStatus("Fill in both the field and the value that count as done, or leave both empty.", false);
  if (assignWordsInput.value.trim()) addAssignWords(assignWordsInput.value);
  if (!assignWords.length) return setStatus("Keep at least one word that marks an assignment request, or reset the list.", false);
  if (!hasChrome) return setStatus("Preview mode: nothing saved.", false);
  await api.storage.local.set({ token, fields: fieldList, ageEnabled: ageEnabled.checked, ageUnit: ageUnit.value, ageWarnDays: Math.max(0, parseInt(ageWarn.value, 10) || 0), pinsEnabled: pinsEnabledInput.checked, skipShownFields: skipShownInput.checked, kanbanEnabled: kanbanEnabledInput.checked, kanbanDrag: kanbanDragInput.checked, sidebarToggle: sidebarToggleInput.checked, hideProjectsSection: hideProjectsInput.checked, prAssociation: prInputs.prAssociation.checked, prFork: prInputs.prFork.checked, prSize: prInputs.prSize.checked, prMergeState: prInputs.prMergeState.checked, loadEnabled: loadEnabledInput.checked, loadAuto: loadAutoInput.checked, loadMembersMode: membersSkip.checked ? "skip" : (membersPlain.checked ? "plain" : "show"), assignEnabled: assignEnabledInput.checked, assignFolded: assignFoldedInput.checked, assignPrivate: assignPrivateInput.checked, relatedEnabled: relatedEnabledInput.checked, relatedFolded: relatedFoldedInput.checked, profileFolded: profileFoldedInput.checked, assignWords: assignWords.join(", "), profileEnabled: profileEnabledInput.checked, profileOrgs: profileOrgsInput.value.split(",").map((x) => x.trim().replace(/^@/, "")).filter(Boolean).slice(0, 3).join(", "), loadRegular: Math.max(1, parseInt(loadRegular.value, 10) || 5), loadLimit: Number.isFinite(parseInt(loadLimit.value, 10)) ? Math.max(0, parseInt(loadLimit.value, 10)) : 1, progressEnabled: progressEnabledInput.checked, progressScopeField: progressScope.value.trim(), progressDoneField: progressDoneField.value.trim(), progressDoneValue: progressDoneValue.value.trim(), searchShortcuts: search.list, searchDefault: search.defaultName });
  renderHomeToken(token);
  clearDirty();
  if (!token) setStatus("Saved without a token. Badges need one.", false);
  else setStatus("Saved. Reload the GitHub tab if badges do not appear.", true);
});

// Puts every field back to what is saved and forgets what was typed since.
discardButton.addEventListener("click", async () => {
  if (!hasChrome) {
    location.reload();
    return;
  }
  fieldInput.value = "";
  assignWordsInput.value = "";
  await loadFromStorage(false);
  clearDirty();
  setStatus("Changes discarded.", true);
});

document.getElementById("test").addEventListener("click", async () => {
  if (!hasChrome) return setStatus("Preview mode: cannot reach GitHub.", false);
  setStatus("Testing...", true);
  const res = await api.runtime.sendMessage({ type: "testToken", token: tokenInput.value });
  if (res && res.login) setStatus(`Token works, authenticated as ${res.login}.`, true);
  else setStatus(res && res.error ? res.error : "Token test failed.", false);
});
