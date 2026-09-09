(() => {
  const api = typeof browser !== "undefined" && browser.runtime ? browser : chrome;
  const ISSUE_PATH = /^\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/;
  const PROJECT_PATH = /^\/(?:orgs|users)\/[^/]+\/projects\/\d+(?:\/|$)|^\/[^/]+\/[^/]+\/projects\/\d+(?:\/|$)/;
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const FETCH_CHUNK = 60;
  const cache = new Map(); // "owner/repo#n" -> { at, values, createdAt }
  const pending = new Set();
  let scheduled = null;
  let noticeShown = false;
  let settings = { ageEnabled: false, ageUnit: "months", pinsEnabled: true };
  let pins = [];
  let pinsCollapsed = true;

  // ---------------------------------------------------------------------------
  // Issue references
  // ---------------------------------------------------------------------------

  function refFromPath(path) {
    const m = ISSUE_PATH.exec(path);
    if (!m) return null;
    return { owner: m[1], repo: m[2], number: Number(m[3]), key: `${m[1]}/${m[2]}#${m[3]}` };
  }

  function issueRef(anchor) {
    try {
      return refFromPath(new URL(anchor.href, location.origin).pathname);
    } catch {
      return null;
    }
  }

  // Accepts a URL, "owner/repo#123", or "#123" / "123" when a repository can be inferred from the page.
  function parseIssueInput(text, fallbackRepo) {
    const s = String(text || "").trim();
    if (!s) return null;
    let m = /^([^/\s]+)\/([^#\s]+)#(\d+)$/.exec(s);
    if (m) return { owner: m[1], repo: m[2], number: Number(m[3]), key: `${m[1]}/${m[2]}#${m[3]}` };
    m = /^#?(\d+)$/.exec(s);
    if (m) {
      if (!fallbackRepo) return null;
      return { owner: fallbackRepo.owner, repo: fallbackRepo.repo, number: Number(m[1]), key: `${fallbackRepo.owner}/${fallbackRepo.repo}#${m[1]}` };
    }
    // Only absolute URLs: a relative value would resolve against the current page and pick up its issue number.
    if (/^https?:\/\//i.test(s)) {
      try {
        const url = new URL(s);
        if (/(^|\.)github\.com$/.test(url.hostname)) return refFromPath(url.pathname);
      } catch { /* not a url */ }
    }
    return null;
  }

  // The issue the user is currently looking at: an issue page, or the item opened in a project side panel.
  function currentIssue() {
    const fromPath = refFromPath(location.pathname);
    if (fromPath) return fromPath;
    const param = new URLSearchParams(location.search).get("issue");
    if (param) {
      const parts = param.split("|");
      if (parts.length === 3 && /^\d+$/.test(parts[2])) {
        return { owner: parts[0], repo: parts[1], number: Number(parts[2]), key: `${parts[0]}/${parts[1]}#${parts[2]}` };
      }
    }
    const dialog = document.querySelector('[role="dialog"][class*="SidePanel"], [role="dialog"] [class*="SidePanel"]');
    if (dialog) {
      for (const a of dialog.querySelectorAll("a[href]")) {
        if (a.closest(".gsf-pins")) continue;
        const ref = issueRef(a);
        if (ref) return ref;
      }
    }
    return null;
  }

  // Title of an issue as shown on the current page: issue header, side panel, project row or board card.
  function titleFromPage(ref) {
    if (refFromPath(location.pathname) && refFromPath(location.pathname).key === ref.key) {
      const h1 = document.querySelector('[data-testid="issue-title"], h1 bdi, .js-issue-title');
      if (h1 && h1.textContent.trim()) return h1.textContent.trim();
    }
    const suffix = `/${ref.owner}/${ref.repo}/issues/${ref.number}`;
    for (const a of document.querySelectorAll("a[href]")) {
      if (a.closest(".gsf-pins, .gsf-badge")) continue;
      let path;
      try { path = new URL(a.href, location.origin).pathname.replace(/\/$/, ""); } catch { continue; }
      if (path !== suffix) continue;
      const text = a.textContent.replace(/\s+/g, " ").trim();
      if (text && !/^#?\d+$/.test(text) && !/^(?:[^/\s]+\/[^#\s]+)?#\d+$/.test(text)) return text;
    }
    return "";
  }

  function currentRepo() {
    const m = /^\/([^/]+)\/([^/]+)(?:\/|$)/.exec(location.pathname);
    if (!m || m[1] === "orgs" || m[1] === "users") return null;
    return { owner: m[1], repo: m[2] };
  }

  // ---------------------------------------------------------------------------
  // Rows: sub-issue lists, project table rows, project board cards
  // ---------------------------------------------------------------------------

  function collectRows() {
    const rows = [];
    const seen = new Set();

    const containers = document.querySelectorAll('[data-testid="sub-issues-issue-container"], [data-testid*="sub-issues"]');
    for (const container of containers) {
      for (const li of container.querySelectorAll('li[role="treeitem"]')) {
        if (seen.has(li)) continue;
        seen.add(li);
        const titleLink = [...li.querySelectorAll("a[href]")].find((a) => issueRef(a) && !a.closest(".gsf-badge"));
        if (!titleLink) continue;
        const ownContent = li.querySelector(":scope > .PRIVATE_TreeView-item-container, :scope > [class*='TreeViewItemContainer']") || li;
        if (!ownContent.contains(titleLink)) continue;
        rows.push({ kind: "sub", li, titleLink, ref: issueRef(titleLink), content: ownContent });
      }
    }

    // Project table layout: the title cell of each row.
    for (const cell of document.querySelectorAll('[role="grid"] [role="rowheader"]')) {
      if (seen.has(cell)) continue;
      seen.add(cell);
      const titleLink = [...cell.querySelectorAll("a[href]")].find((a) => issueRef(a) && !a.closest(".gsf-badge"));
      if (!titleLink) continue;
      rows.push({ kind: "table", li: cell, titleLink, ref: issueRef(titleLink), content: cell });
    }

    // Project board layout: one card per item.
    for (const h3 of document.querySelectorAll('h3[id^="board-card-title-"]')) {
      const titleLink = h3.closest("a[href]");
      if (!titleLink) continue;
      const ref = issueRef(titleLink);
      if (!ref) continue;
      // The title link itself has role="button"; the card is the closest one above it.
      const card = titleLink.parentElement.closest('[role="button"]') || titleLink.parentElement;
      if (seen.has(card)) continue;
      seen.add(card);
      rows.push({ kind: "board", li: card, titleLink, ref, content: card });
    }

    return rows;
  }

  function findAnchorSlot(row) {
    if (row.kind === "table") {
      return { parent: row.titleLink.parentElement, before: null };
    }
    if (row.kind === "board") {
      let wrap = row.titleLink.parentElement.querySelector(":scope > .gsf-badges");
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.className = "gsf-badges";
        row.titleLink.parentElement.insertBefore(wrap, row.titleLink.nextSibling);
      }
      return { parent: wrap, before: null };
    }
    const typeIndicator = row.content.querySelector('[data-testid*="sub-issue-type-indicator"]');
    if (typeIndicator) {
      const link = typeIndicator.closest("a") || typeIndicator;
      return { parent: link.parentElement, before: link.nextSibling };
    }
    const titleContainer = row.titleLink.closest('[class*="Title-module__container"]') || row.titleLink.parentElement;
    return { parent: titleContainer, before: titleContainer.firstChild };
  }

  // ---------------------------------------------------------------------------
  // Age
  // ---------------------------------------------------------------------------

  function ageOf(createdAt) {
    const created = new Date(createdAt);
    if (Number.isNaN(created.getTime())) return null;
    const days = Math.max(0, Math.floor((Date.now() - created.getTime()) / DAY_MS));
    let text;
    if (settings.ageUnit === "days") {
      text = `${days}d`;
    } else if (settings.ageUnit === "weeks") {
      const weeks = Math.floor(days / 7);
      text = weeks < 1 ? "<1w" : `${weeks}w`;
    } else {
      const months = Math.floor(days / 30.4375);
      text = months < 1 ? "<1 mo" : `${months} mo`;
    }
    const months = Math.floor(days / 30.4375);
    const title = `Age: ${months} month${months === 1 ? "" : "s"} (${days} day${days === 1 ? "" : "s"}), created ${created.toISOString().slice(0, 10)}`;
    return { text, title, days };
  }

  // ---------------------------------------------------------------------------
  // Badges
  // ---------------------------------------------------------------------------

  function render(row, hit) {
    const values = (hit && hit.values) || [];
    const scope = row.content.contains(row.titleLink) ? row.content : row.titleLink.parentElement;
    scope.querySelectorAll(`.gsf-badge[data-gsf-for="${row.ref.key}"]`).forEach((el) => el.remove());
    row.titleLink.parentElement.querySelectorAll(`.gsf-badge[data-gsf-for="${row.ref.key}"]`).forEach((el) => el.remove());
    const age = settings.ageEnabled && hit && hit.createdAt ? ageOf(hit.createdAt) : null;
    if (!values.length && !age) {
      row.li.dataset.gsfState = "empty";
      return;
    }
    const slot = findAnchorSlot(row);
    if (!slot || !slot.parent) return;
    const frag = document.createDocumentFragment();
    for (const v of values) {
      const badge = document.createElement("a");
      badge.className = "gsf-badge";
      badge.dataset.gsfColor = v.color || "GRAY";
      badge.dataset.gsfFor = row.ref.key;
      badge.textContent = v.value;
      badge.title = `${v.field}: ${v.value}`;
      const q = `field.${v.field}:"${v.value}"`;
      badge.href = `/${row.ref.owner}/${row.ref.repo}/issues?q=${encodeURIComponent(q)}`;
      badge.addEventListener("click", (e) => e.stopPropagation());
      frag.appendChild(badge);
    }
    if (age) {
      const badge = document.createElement("span");
      badge.className = "gsf-badge gsf-age";
      badge.dataset.gsfColor = "GRAY";
      badge.dataset.gsfFor = row.ref.key;
      badge.textContent = age.text;
      badge.title = age.title;
      frag.appendChild(badge);
    }
    slot.parent.insertBefore(frag, slot.before);
    row.li.dataset.gsfState = "done";
  }

  function hasBadges(row) {
    const sel = `.gsf-badge[data-gsf-for="${row.ref.key}"]`;
    return Boolean(row.content.querySelector(sel) || row.titleLink.parentElement.querySelector(sel));
  }

  function showNotice(message, withOptionsButton) {
    if (noticeShown) return;
    const container = document.querySelector('[data-testid="sub-issues-issue-container"]');
    if (!container) {
      // No sub-issues list on this page (project view): report through the pins panel and flag its button.
      if (panel) setPanelStatus(message, false, withOptionsButton);
      flagHeaderButton(message);
      return;
    }
    noticeShown = true;
    const box = document.createElement("div");
    box.className = "gsf-notice";
    const text = document.createElement("span");
    text.textContent = message;
    box.appendChild(text);
    if (withOptionsButton) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Open extension options";
      btn.addEventListener("click", () => api.runtime.sendMessage({ type: "openOptions" }));
      box.appendChild(btn);
    }
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Dismiss";
    close.addEventListener("click", () => box.remove());
    box.appendChild(close);
    container.prepend(box);
  }

  async function scan() {
    scheduled = null;
    syncPanel();
    const rows = collectRows();
    if (!rows.length) return;

    const now = Date.now();
    const toFetch = new Map();
    for (const row of rows) {
      const hit = cache.get(row.ref.key);
      if (hit && now - hit.at < CACHE_TTL_MS) {
        if (!hasBadges(row) && row.li.dataset.gsfState !== "empty") render(row, hit);
        continue;
      }
      if (!pending.has(row.ref.key)) toFetch.set(row.ref.key, row.ref);
    }
    if (!toFetch.size) return;

    for (const key of toFetch.keys()) pending.add(key);
    const issues = [...toFetch.values()].map(({ owner, repo, number }) => ({ owner, repo, number }));

    // Project tables can hold hundreds of rows: keep each GraphQL request small enough for GitHub's limits.
    const chunks = [];
    for (let i = 0; i < issues.length; i += FETCH_CHUNK) chunks.push(issues.slice(i, i + FETCH_CHUNK));

    let response;
    try {
      const parts = await Promise.all(chunks.map((chunk) => api.runtime.sendMessage({ type: "fetchFieldValues", issues: chunk })));
      const failed = parts.find((part) => !part || part.error);
      response = failed || parts.reduce((acc, part) => {
        Object.assign(acc.values, part.values || {});
        Object.assign(acc.created, part.created || {});
        return acc;
      }, { values: {}, created: {} });
    } catch (err) {
      response = { error: err && err.message ? err.message : String(err) };
    } finally {
      for (const key of toFetch.keys()) pending.delete(key);
    }

    if (!response || response.error) {
      if (response && response.error === "NO_TOKEN") {
        showNotice("GitHub Issue Toolkit: add a GitHub token in the extension settings to show field values here.", true);
      } else if (response && response.error === "NO_FIELDS") {
        showNotice("GitHub Issue Toolkit: choose which fields to show, or enable the age badge, in the extension settings.", true);
      } else {
        showNotice(`GitHub Issue Toolkit: ${response ? response.error : "unknown error"}`, true);
      }
      return;
    }

    const at = Date.now();
    for (const key of toFetch.keys()) {
      cache.set(key, {
        at,
        values: (response.values && response.values[key]) || [],
        createdAt: (response.created && response.created[key]) || null
      });
    }
    for (const row of collectRows()) {
      const hit = cache.get(row.ref.key);
      if (hit && toFetch.has(row.ref.key)) render(row, hit);
    }
  }

  function clearBadges() {
    cache.clear();
    noticeShown = false;
    if (headerButton) {
      headerButton.classList.remove("gsf-has-error");
      headerButton.title = "Pinned issues";
    }
    document.querySelectorAll(".gsf-badge, .gsf-badges, .gsf-notice").forEach((el) => el.remove());
    document.querySelectorAll("[data-gsf-state]").forEach((el) => delete el.dataset.gsfState);
  }

  // ---------------------------------------------------------------------------
  // Pinned issues panel
  // ---------------------------------------------------------------------------

  let panel = null;
  let panelParts = null;
  let panelStatusTimer = null;
  let lastHref = null;
  let headerButton = null;

  const PIN_ICON = "M11.294.984l3.722 3.722a1.75 1.75 0 0 1-.504 2.826l-1.327.613a3.089 3.089 0 0 0-1.707 2.084l-.584 2.454c-.317 1.332-1.972 1.8-2.94.832L5.75 11.311 1.78 15.28a.749.749 0 1 1-1.06-1.06l3.969-3.97-2.204-2.204c-.968-.968-.5-2.623.832-2.94l2.454-.584a3.08 3.08 0 0 0 2.084-1.707l.613-1.327a1.75 1.75 0 0 1 2.826-.504ZM6.283 9.723l2.732 2.731a.25.25 0 0 0 .42-.119l.584-2.454a4.586 4.586 0 0 1 2.537-3.098l1.328-.613a.25.25 0 0 0 .072-.404l-3.722-3.722a.25.25 0 0 0-.404.072l-.613 1.328a4.584 4.584 0 0 1-3.098 2.537l-2.454.584a.25.25 0 0 0-.119.42l2.731 2.732Z";

  function pinIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("octicon", "octicon-pin");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", PIN_ICON);
    svg.appendChild(path);
    return svg;
  }

  // Panel content is useful on project views and issue pages; the header button is shown everywhere the header is.
  function panelWanted() {
    return PROJECT_PATH.test(location.pathname) || ISSUE_PATH.test(location.pathname);
  }

  // GitHub's global header: put our button among the action icons, right before the notifications bell.
  // Class names change between GitHub's server-rendered and React headers, so this is structural:
  // find the notifications control inside a <header>, and copy the classes of a neighbouring icon button.
  function findHeaderSlot() {
    for (const header of document.querySelectorAll("header")) {
      const bell = header.querySelector('notification-indicator, #AppHeader-notifications-button, a[href^="/notifications"], [data-testid*="notification"]');
      if (!bell) continue;
      let ref = bell;
      while (ref.parentElement && ref.parentElement !== header && ref.parentElement.children.length === 1) ref = ref.parentElement;
      const twin = header.querySelector('a[href="/pulls"], a[href="/issues"], #AppHeader-notifications-button, a[href^="/notifications"]');
      return { header, ref, twin };
    }
    return null;
  }

  function mountHeaderButton() {
    if (headerButton && headerButton.isConnected) return true;
    const slot = findHeaderSlot();
    if (!slot) return false;
    if (!headerButton) {
      headerButton = document.createElement("button");
      headerButton.type = "button";
      headerButton.setAttribute("aria-label", "Pinned issues");
      headerButton.title = "Pinned issues";
      headerButton.appendChild(pinIcon());
      const count = document.createElement("span");
      count.className = "gsf-pins-count";
      headerButton.appendChild(count);
      headerButton.addEventListener("click", (e) => {
        e.stopPropagation();
        setCollapsed(!pinsCollapsed);
      });
    }
    const twinClasses = slot.twin
      ? [...slot.twin.classList].filter((c) => !/hasIndicator|unread|selected|gsf-/.test(c)).join(" ")
      : "AppHeader-button Button--iconOnly Button--secondary Button--medium Button";
    headerButton.className = `gsf-pins-header-btn ${twinClasses}`;
    slot.ref.parentElement.insertBefore(headerButton, slot.ref);
    updateHeaderButton();
    return true;
  }

  function flagHeaderButton(message) {
    if (!headerButton) return;
    headerButton.classList.add("gsf-has-error");
    headerButton.title = message ? `Pinned issues. ${message}` : "Pinned issues";
  }

  function updateHeaderButton() {
    if (!headerButton) return;
    const count = headerButton.querySelector(".gsf-pins-count");
    count.textContent = pins.length ? String(pins.length) : "";
    count.hidden = !pins.length;
    headerButton.setAttribute("aria-expanded", pinsCollapsed ? "false" : "true");
    headerButton.classList.toggle("gsf-open", !pinsCollapsed);
  }

  function positionBox() {
    if (!panelParts) return;
    const { box } = panelParts;
    if (headerButton && headerButton.isConnected) {
      const r = headerButton.getBoundingClientRect();
      box.style.top = `${Math.round(r.bottom + 8)}px`;
      box.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`;
    } else {
      box.style.top = "";
      box.style.right = "";
    }
  }

  function buildPanel() {
    const root = document.createElement("aside");
    root.className = "gsf-pins";
    root.setAttribute("aria-label", "Pinned issues");

    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "gsf-pins-pill";
    pill.title = "Pinned issues";
    pill.setAttribute("aria-label", "Pinned issues");
    pill.appendChild(pinIcon());
    const pillCount = document.createElement("span");
    pillCount.className = "gsf-pins-count";
    pill.appendChild(pillCount);
    pill.addEventListener("click", (e) => { e.stopPropagation(); setCollapsed(false); });

    const box = document.createElement("div");
    box.className = "gsf-pins-box";

    const head = document.createElement("div");
    head.className = "gsf-pins-head";
    const heading = document.createElement("span");
    heading.className = "gsf-pins-title";
    heading.textContent = "Pinned issues";
    const collapse = document.createElement("button");
    collapse.type = "button";
    collapse.className = "gsf-pins-icon";
    collapse.title = "Close";
    collapse.setAttribute("aria-label", "Close pinned issues");
    collapse.textContent = "×";
    collapse.addEventListener("click", () => setCollapsed(true));
    head.append(heading, collapse);

    const current = document.createElement("div");
    current.className = "gsf-pins-current";

    const list = document.createElement("ul");
    list.className = "gsf-pins-list";

    const form = document.createElement("form");
    form.className = "gsf-pins-form";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Issue URL or owner/repo#123";
    input.setAttribute("aria-label", "Issue to pin");
    input.spellcheck = false;
    input.autocomplete = "off";
    const add = document.createElement("button");
    add.type = "submit";
    add.textContent = "Pin";
    form.append(input, add);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const ref = parseIssueInput(input.value, currentRepo());
      if (!ref) {
        setPanelStatus("Enter an issue URL or owner/repo#number.", false);
        return;
      }
      input.value = "";
      await pinIssue(ref);
    });
    // GitHub's keyboard shortcuts must not fire while typing here; Escape still closes the panel.
    for (const type of ["keydown", "keyup", "keypress"]) input.addEventListener(type, (e) => e.stopPropagation());
    input.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); setCollapsed(true); } });

    const status = document.createElement("div");
    status.className = "gsf-pins-status";
    status.setAttribute("role", "status");

    box.append(head, current, list, form, status);
    box.addEventListener("click", (e) => e.stopPropagation());
    root.append(pill, box);
    document.documentElement.appendChild(root);
    panel = root;
    panelParts = { pill, pillCount, box, current, list, input, status };

    // Behave like a GitHub overlay: click outside or Escape closes it.
    document.addEventListener("click", (e) => {
      if (pinsCollapsed || !panel || panel.hidden) return;
      if (box.contains(e.target) || (headerButton && headerButton.contains(e.target))) return;
      setCollapsed(true);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !pinsCollapsed && panel && !panel.hidden && !e.defaultPrevented) setCollapsed(true);
    });
    window.addEventListener("resize", positionBox);
  }

  function setCollapsed(collapsed) {
    pinsCollapsed = collapsed;
    renderPanel();
  }

  function setPanelStatus(message, ok, withOptionsButton) {
    if (!panelParts) return;
    const { status } = panelParts;
    status.textContent = "";
    status.className = `gsf-pins-status ${ok ? "ok" : "err"}`;
    const text = document.createElement("span");
    text.textContent = message;
    status.appendChild(text);
    if (withOptionsButton) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Open options";
      btn.addEventListener("click", () => api.runtime.sendMessage({ type: "openOptions" }));
      status.appendChild(btn);
    }
    clearTimeout(panelStatusTimer);
    if (ok) panelStatusTimer = setTimeout(() => { status.textContent = ""; status.className = "gsf-pins-status"; }, 4000);
  }

  function pinIndex(key) {
    return pins.findIndex((p) => p.key === key);
  }

  async function savePins() {
    await api.storage.local.set({ pins });
    renderPanel();
  }

  async function pinIssue(ref) {
    if (pinIndex(ref.key) !== -1) {
      setPanelStatus(`${ref.key} is already pinned.`, false);
      return;
    }
    const pin = { key: ref.key, owner: ref.owner, repo: ref.repo, number: ref.number, title: titleFromPage(ref), type: null, typeColor: null };
    pins.push(pin);
    await savePins();
    let res;
    try {
      res = await api.runtime.sendMessage({ type: "fetchIssueMeta", issue: { owner: ref.owner, repo: ref.repo, number: ref.number } });
    } catch (err) {
      res = { error: err && err.message ? err.message : String(err) };
    }
    if (res && res.issue) {
      // Saving above fired storage.onChanged in this tab too, which replaced `pins` with a fresh copy:
      // update the entry that is in the array now, not the object created before the save.
      const saved = pins[pinIndex(ref.key)] || pin;
      saved.title = res.issue.title || saved.title;
      saved.type = res.issue.type;
      saved.typeColor = res.issue.typeColor;
      saved.state = res.issue.state;
      await savePins();
      setPanelStatus(`Pinned ${ref.key}.`, true);
    } else if (res && res.error === "NO_TOKEN") {
      setPanelStatus(pin.title
        ? "Pinned. Add a GitHub token in the options to load the issue type and to link issues."
        : "Pinned without title: add a GitHub token in the options to load issue details.", false, true);
    } else {
      setPanelStatus(res && res.error ? res.error : "Could not load the issue.", false);
    }
  }

  async function unpin(key) {
    const i = pinIndex(key);
    if (i === -1) return;
    pins.splice(i, 1);
    await savePins();
  }

  async function copyRef(pin) {
    const text = pin.key;
    try {
      await navigator.clipboard.writeText(text);
      setPanelStatus(`Copied ${text}.`, true);
    } catch {
      setPanelStatus(`Could not copy. Reference: ${text}`, false);
    }
  }

  async function linkCurrentTo(pin, replaceParent) {
    const child = currentIssue();
    if (!child) {
      setPanelStatus("Open an issue first, then link it.", false);
      return;
    }
    if (child.key === pin.key) {
      setPanelStatus("An issue cannot be its own sub-issue.", false);
      return;
    }
    setPanelStatus(`Linking ${child.key} to ${pin.key}...`, true);
    let res;
    try {
      res = await api.runtime.sendMessage({
        type: "linkSubIssue",
        parent: { owner: pin.owner, repo: pin.repo, number: pin.number },
        child: { owner: child.owner, repo: child.repo, number: child.number },
        replaceParent: Boolean(replaceParent)
      });
    } catch (err) {
      res = { error: err && err.message ? err.message : String(err) };
    }
    if (res && res.ok) {
      setPanelStatus(`${res.child} is now a sub-issue of ${res.parent}. Reload the page to see it.`, true);
      return;
    }
    if (res && res.error === "HAS_PARENT") {
      if (res.parent === pin.key) {
        setPanelStatus(`${child.key} is already a sub-issue of ${pin.key}.`, true);
        return;
      }
      const ok = window.confirm(`${child.key} already has parent ${res.parent}.\nMove it under ${pin.key} instead?`);
      if (ok) await linkCurrentTo(pin, true);
      else setPanelStatus("Kept the existing parent.", false);
      return;
    }
    if (res && res.error === "NO_TOKEN") {
      setPanelStatus("Add a GitHub token in the options to link issues.", false, true);
      return;
    }
    setPanelStatus(res && res.error ? `${res.error} Linking needs a token with write access to the issue's repository.` : "Linking failed.", false);
  }

  function typeBadge(pin) {
    if (!pin.type) return null;
    const el = document.createElement("span");
    el.className = "gsf-badge gsf-pin-type";
    el.dataset.gsfColor = pin.typeColor || "GRAY";
    el.textContent = pin.type;
    return el;
  }

  function renderPanel() {
    if (!panel || !panelParts) return;
    const { pillCount, current, list } = panelParts;
    panel.dataset.collapsed = pinsCollapsed ? "true" : "false";
    panel.dataset.inHeader = headerButton && headerButton.isConnected ? "true" : "false";
    pillCount.textContent = pins.length ? String(pins.length) : "";
    pillCount.hidden = !pins.length;
    updateHeaderButton();
    if (pinsCollapsed) return;
    positionBox();

    const cur = currentIssue();
    current.textContent = "";
    if (cur) {
      const label = document.createElement("span");
      label.className = "gsf-pins-current-label";
      label.textContent = "Current: ";
      const code = document.createElement("code");
      code.textContent = cur.key;
      current.append(label, code);
      if (pinIndex(cur.key) === -1) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "Pin it";
        btn.title = "Pin the issue you are looking at";
        btn.addEventListener("click", () => pinIssue(cur));
        current.appendChild(btn);
      }
    } else {
      const hint = document.createElement("span");
      hint.className = "gsf-pins-current-label";
      hint.textContent = PROJECT_PATH.test(location.pathname)
        ? "Open an item to link it to a pinned epic."
        : "Open an issue to link it to a pinned epic.";
      current.appendChild(hint);
    }

    list.textContent = "";
    if (!pins.length) {
      const empty = document.createElement("li");
      empty.className = "gsf-pins-empty";
      empty.textContent = "No pinned issues yet. Pin the epics you link to most often.";
      list.appendChild(empty);
    }
    for (const pin of pins) {
      const li = document.createElement("li");
      li.className = "gsf-pin";
      if (pin.state === "CLOSED") li.dataset.closed = "true";

      const main = document.createElement("div");
      main.className = "gsf-pin-main";
      const type = typeBadge(pin);
      if (type) main.appendChild(type);
      const link = document.createElement("a");
      link.className = "gsf-pin-title";
      link.href = `https://github.com/${pin.owner}/${pin.repo}/issues/${pin.number}`;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = pin.title || pin.key;
      link.title = `${pin.key}${pin.title ? ` – ${pin.title}` : ""}`;
      main.appendChild(link);

      const meta = document.createElement("div");
      meta.className = "gsf-pin-meta";
      const ref = document.createElement("span");
      ref.className = "gsf-pin-ref";
      ref.textContent = pin.key;
      meta.appendChild(ref);

      const actions = document.createElement("div");
      actions.className = "gsf-pin-actions";
      const linkBtn = document.createElement("button");
      linkBtn.type = "button";
      linkBtn.className = "gsf-pin-link";
      linkBtn.textContent = "Link";
      linkBtn.title = cur
        ? `Make ${cur.key} a sub-issue of ${pin.key}`
        : "Open an issue to link it as a sub-issue of this one";
      linkBtn.disabled = !cur || cur.key === pin.key;
      linkBtn.addEventListener("click", () => linkCurrentTo(pin, false));
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.textContent = "Copy";
      copyBtn.title = `Copy ${pin.key} to the clipboard`;
      copyBtn.addEventListener("click", () => copyRef(pin));
      const unpinBtn = document.createElement("button");
      unpinBtn.type = "button";
      unpinBtn.className = "gsf-pins-icon";
      unpinBtn.textContent = "×";
      unpinBtn.title = `Unpin ${pin.key}`;
      unpinBtn.setAttribute("aria-label", `Unpin ${pin.key}`);
      unpinBtn.addEventListener("click", () => unpin(pin.key));
      actions.append(linkBtn, copyBtn, unpinBtn);
      meta.appendChild(actions);

      li.append(main, meta);
      list.appendChild(li);
    }
  }

  // Show, hide or refresh the panel when the page or the open item changes (GitHub navigates without reloads).
  function syncPanel() {
    if (!settings.pinsEnabled) {
      if (headerButton && headerButton.isConnected) headerButton.remove();
      if (panel) panel.hidden = true;
      return;
    }
    const inHeader = mountHeaderButton();
    const wanted = inHeader || panelWanted();
    if (wanted && !panel) buildPanel();
    if (!panel) return;
    panel.hidden = !wanted;
    if (!wanted) return;
    const href = location.href;
    if (href !== lastHref) {
      lastHref = href;
      renderPanel();
    } else if (panel.dataset.inHeader !== String(inHeader)) {
      renderPanel();
    }
  }

  // ---------------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------------

  function schedule() {
    if (scheduled) return;
    scheduled = setTimeout(() => scan().catch((err) => console.warn("[github-issue-toolkit]", err)), 250);
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.target && m.target.closest && m.target.closest(".gsf-badge, .gsf-badges, .gsf-notice, .gsf-pins, .gsf-pins-header-btn")) continue;
      let ours = true;
      for (const n of m.addedNodes) {
        if (!(n.nodeType === 1 && n.classList && (n.classList.contains("gsf-badge") || n.classList.contains("gsf-badges") || n.classList.contains("gsf-notice") || n.classList.contains("gsf-pins") || n.classList.contains("gsf-pins-header-btn")))) { ours = false; break; }
      }
      if (ours && m.addedNodes.length) continue;
      schedule();
      return;
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", schedule);

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.token || changes.fields || changes.ageEnabled || changes.ageUnit) {
      if (changes.ageEnabled) settings.ageEnabled = changes.ageEnabled.newValue === true;
      if (changes.ageUnit) settings.ageUnit = changes.ageUnit.newValue || "months";
      clearBadges();
      schedule();
    }
    if (changes.pinsEnabled) {
      settings.pinsEnabled = changes.pinsEnabled.newValue !== false;
      lastHref = null;
      syncPanel();
    }
    if (changes.pins) {
      pins = Array.isArray(changes.pins.newValue) ? changes.pins.newValue : [];
      lastHref = null;
      syncPanel();
    }
  });

  api.storage.local.get(["ageEnabled", "ageUnit", "pinsEnabled", "pins"]).then((stored) => {
    settings.ageEnabled = stored.ageEnabled === true;
    settings.ageUnit = stored.ageUnit || "months";
    settings.pinsEnabled = stored.pinsEnabled !== false;
    pins = Array.isArray(stored.pins) ? stored.pins : [];
    lastHref = null;
    schedule();
  }).catch(() => schedule());
})();
