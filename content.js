// Content script: finds sub-issue rows on a GitHub issue page and decorates
// each one with the configured custom issue field values.

(() => {
  const api = typeof browser !== "undefined" && browser.runtime ? browser : chrome;
  const ISSUE_PATH = /^\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/;
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const cache = new Map(); // "owner/repo#n" -> { at, values }
  const pending = new Set();
  let scheduled = null;
  let noticeShown = false;

  function issueRef(anchor) {
    let path;
    try {
      path = new URL(anchor.href, location.origin).pathname;
    } catch {
      return null;
    }
    const m = ISSUE_PATH.exec(path);
    if (!m) return null;
    return { owner: m[1], repo: m[2], number: Number(m[3]), key: `${m[1]}/${m[2]}#${m[3]}` };
  }

  // A sub-issue row is a tree item that links to an issue and has a title container.
  function collectRows() {
    const rows = [];
    const containers = document.querySelectorAll('[data-testid="sub-issues-issue-container"], [data-testid*="sub-issues"]');
    const seen = new Set();
    for (const container of containers) {
      for (const li of container.querySelectorAll('li[role="treeitem"]')) {
        if (seen.has(li)) continue;
        seen.add(li);
        const titleLink = [...li.querySelectorAll("a[href]")].find((a) => {
          const ref = issueRef(a);
          return ref && !a.closest(".gsf-badge");
        });
        if (!titleLink) continue;
        // Only consider the row's own content, not nested children rows.
        const ownContent = li.querySelector(":scope > .PRIVATE_TreeView-item-container, :scope > [class*='TreeViewItemContainer']") || li;
        if (!ownContent.contains(titleLink)) continue;
        rows.push({ li, titleLink, ref: issueRef(titleLink), content: ownContent });
      }
    }
    return rows;
  }

  function findAnchorSlot(row) {
    // Preferred: right after the issue type badge ("Bug", "Feature", ...).
    const typeIndicator = row.content.querySelector('[data-testid*="sub-issue-type-indicator"]');
    if (typeIndicator) {
      const link = typeIndicator.closest("a") || typeIndicator;
      return { parent: link.parentElement, before: link.nextSibling };
    }
    // Fallback: at the start of the title container.
    const titleContainer = row.titleLink.closest('[class*="Title-module__container"]') || row.titleLink.parentElement;
    return { parent: titleContainer, before: titleContainer.firstChild };
  }

  function render(row, values) {
    const existing = row.content.querySelectorAll(`.gsf-badge[data-gsf-for="${row.ref.key}"]`);
    existing.forEach((el) => el.remove());
    if (!values || !values.length) {
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
    slot.parent.insertBefore(frag, slot.before);
    row.li.dataset.gsfState = "done";
  }

  function showNotice(message, withOptionsButton) {
    if (noticeShown) return;
    const container = document.querySelector('[data-testid="sub-issues-issue-container"]');
    if (!container) return;
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
    const rows = collectRows();
    if (!rows.length) return;

    const now = Date.now();
    const toFetch = new Map();
    for (const row of rows) {
      const hit = cache.get(row.ref.key);
      if (hit && now - hit.at < CACHE_TTL_MS) {
        // Re-render when the row was re-created by React or not yet decorated.
        const drawn = row.content.querySelector(`.gsf-badge[data-gsf-for="${row.ref.key}"]`);
        if (!drawn && row.li.dataset.gsfState !== "empty") render(row, hit.values);
        else if (!drawn && row.li.dataset.gsfState === "empty" && hit.values.length) render(row, hit.values);
        continue;
      }
      if (!pending.has(row.ref.key)) toFetch.set(row.ref.key, row.ref);
    }
    if (!toFetch.size) return;

    for (const key of toFetch.keys()) pending.add(key);
    const issues = [...toFetch.values()].map(({ owner, repo, number }) => ({ owner, repo, number }));

    let response;
    try {
      response = await api.runtime.sendMessage({ type: "fetchFieldValues", issues });
    } catch (err) {
      response = { error: err && err.message ? err.message : String(err) };
    } finally {
      for (const key of toFetch.keys()) pending.delete(key);
    }

    if (!response || response.error) {
      if (response && response.error === "NO_TOKEN") {
        showNotice("Issue field badges: add a GitHub token in the extension settings to show field values here.", true);
      } else if (response && response.error === "NO_FIELDS") {
        showNotice("Issue field badges: choose which fields to show in the extension settings.", true);
      } else {
        showNotice(`Issue field badges: ${response ? response.error : "unknown error"}`, true);
      }
      return;
    }

    const at = Date.now();
    for (const key of toFetch.keys()) {
      cache.set(key, { at, values: response.values[key] || [] });
    }
    for (const row of collectRows()) {
      const hit = cache.get(row.ref.key);
      if (hit && toFetch.has(row.ref.key)) render(row, hit.values);
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = setTimeout(() => scan().catch((err) => console.warn("[gh-subissue-fields]", err)), 250);
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      // Ignore mutations caused by our own badges.
      if (m.target && m.target.closest && m.target.closest(".gsf-badge, .gsf-notice")) continue;
      let ours = true;
      for (const n of m.addedNodes) {
        if (!(n.nodeType === 1 && (n.classList.contains("gsf-badge") || n.classList.contains("gsf-notice")))) { ours = false; break; }
      }
      if (ours && m.addedNodes.length) continue;
      schedule();
      return;
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Settings changes (token or field list) invalidate the cache.
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.token || changes.fields) {
      cache.clear();
      noticeShown = false;
      document.querySelectorAll(".gsf-badge, .gsf-notice").forEach((el) => el.remove());
      document.querySelectorAll("[data-gsf-state]").forEach((el) => delete el.dataset.gsfState);
      schedule();
    }
  });

  schedule();
})();
