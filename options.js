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

let fields = [];
let shortcuts = [];
let defaultShortcut = 0;

function setStatus(text, ok) {
  status.textContent = text;
  status.className = ok ? "ok" : "err";
}

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
      renderShortcuts();
    });
    row.append(name, icon, kind, query, isDefault, remove);
    return row;
  }));
}

document.getElementById("shortcut-add").addEventListener("click", () => {
  shortcuts.push({ name: "", icon: "", kind: "issue", query: "" });
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
}

if (hasChrome) {
  refreshAccess();
  document.getElementById("grant").addEventListener("click", async () => {
    const ok = await api.permissions.request({ origins: HOSTS });
    setStatus(ok ? "Access to github.com granted." : "Access was not granted.", ok);
    refreshAccess();
  });
  api.storage.local.get(["token", "fields", "ageEnabled", "ageUnit", "ageWarnDays", "pinsEnabled", "skipShownFields", "kanbanEnabled", "kanbanDrag", "sidebarToggle", "hideProjectsSection", "prAssociation", "prFork", "prSize", "prMergeState", "loadEnabled", "loadLimit", "searchShortcuts", "searchDefault", "pins"]).then((stored) => {
    tokenInput.value = stored.token || "";
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
    loadLimit.value = stored.loadLimit === undefined ? 1 : stored.loadLimit;
    prInputs.prAssociation.checked = stored.prAssociation !== false;
    prInputs.prFork.checked = stored.prFork === true;
    prInputs.prSize.checked = stored.prSize === true;
    prInputs.prMergeState.checked = stored.prMergeState === true;
    ageUnit.value = stored.ageUnit || "months";
    ageWarn.value = stored.ageWarnDays === undefined ? 90 : stored.ageWarnDays;
    loadShortcuts(stored.searchShortcuts, stored.searchDefault);
    renderPinsCount(stored.pins);
  });
  api.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.pins) renderPinsCount(changes.pins.newValue);
  });
  document.getElementById("pins-clear").addEventListener("click", async () => {
    await api.storage.local.set({ pins: [] });
    setStatus("All pins removed.", true);
  });
  document.getElementById("version").textContent = `v${api.runtime.getManifest().version}`;
} else {
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
  if (!hasChrome) return setStatus("Preview mode: nothing saved.", false);
  await api.storage.local.set({ token, fields: fieldList, ageEnabled: ageEnabled.checked, ageUnit: ageUnit.value, ageWarnDays: Math.max(0, parseInt(ageWarn.value, 10) || 0), pinsEnabled: pinsEnabledInput.checked, skipShownFields: skipShownInput.checked, kanbanEnabled: kanbanEnabledInput.checked, kanbanDrag: kanbanDragInput.checked, sidebarToggle: sidebarToggleInput.checked, hideProjectsSection: hideProjectsInput.checked, prAssociation: prInputs.prAssociation.checked, prFork: prInputs.prFork.checked, prSize: prInputs.prSize.checked, prMergeState: prInputs.prMergeState.checked, loadEnabled: loadEnabledInput.checked, loadLimit: Number.isFinite(parseInt(loadLimit.value, 10)) ? Math.max(0, parseInt(loadLimit.value, 10)) : 1, searchShortcuts: search.list, searchDefault: search.defaultName });
  if (!token) setStatus("Saved without a token. Badges need one.", false);
  else setStatus("Saved. Reload the GitHub tab if badges do not appear.", true);
});

document.getElementById("test").addEventListener("click", async () => {
  if (!hasChrome) return setStatus("Preview mode: cannot reach GitHub.", false);
  setStatus("Testing...", true);
  const res = await api.runtime.sendMessage({ type: "testToken", token: tokenInput.value });
  if (res && res.login) setStatus(`Token works, authenticated as ${res.login}.`, true);
  else setStatus(res && res.error ? res.error : "Token test failed.", false);
});
