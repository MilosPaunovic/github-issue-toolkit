const tokenInput = document.getElementById("token");
const chips = document.getElementById("chips");
const fieldInput = document.getElementById("field-input");
const status = document.getElementById("status");
const toggle = document.getElementById("toggle");
const ageEnabled = document.getElementById("age-enabled");
const ageUnit = document.getElementById("age-unit");
const pinsCount = document.getElementById("pins-count");
const api = typeof browser !== "undefined" && browser.runtime ? browser : (typeof chrome !== "undefined" ? chrome : undefined);
const hasChrome = Boolean(api && api.storage && api.runtime);
const HOSTS = ["https://github.com/*", "https://api.github.com/*"];

let fields = [];

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
  api.storage.local.get(["token", "fields", "ageEnabled", "ageUnit", "pins"]).then((stored) => {
    tokenInput.value = stored.token || "";
    fields = parseFields(stored.fields);
    renderChips();
    ageEnabled.checked = stored.ageEnabled !== false;
    ageUnit.value = stored.ageUnit || "months";
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
  if (!hasChrome) return setStatus("Preview mode: nothing saved.", false);
  await api.storage.local.set({ token, fields: fieldList, ageEnabled: ageEnabled.checked, ageUnit: ageUnit.value });
  if (!token) setStatus("Saved without a token. Badges need one.", false);
  else if (!fields.length && !ageEnabled.checked) setStatus("Saved without any field. Add a field or enable the age badge to show badges.", false);
  else setStatus("Saved. Reload the GitHub tab if badges do not appear.", true);
});

document.getElementById("test").addEventListener("click", async () => {
  if (!hasChrome) return setStatus("Preview mode: cannot reach GitHub.", false);
  setStatus("Testing...", true);
  const res = await api.runtime.sendMessage({ type: "testToken", token: tokenInput.value });
  if (res && res.login) setStatus(`Token works, authenticated as ${res.login}.`, true);
  else setStatus(res && res.error ? res.error : "Token test failed.", false);
});
