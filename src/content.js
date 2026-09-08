/* Content script: find the markdown attachments on a Jira issue and offer to
   render them. One job, one affordance — the pill in the corner. */

(() => {
  if (window.__mdpInjected) return;
  window.__mdpInjected = true;

  const MD_NAME_RE = /\.(md|markdown|mdown|mkd|mdx|mdtext|mkdn|mdwn)$/i;

  const send = (msg) => new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (res) => {
        if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
        else resolve(res || { ok: false, error: 'No response' });
      });
    } catch (e) {
      resolve({ ok: false, error: String(e.message || e) });
    }
  });

  /* ------------------------------------------------------------- the modal */

  let shell = null;

  function ensureShell () {
    if (shell) return shell;

    const host = document.createElement('div');
    host.id = 'mdp-modal-host';
    // Shadow DOM so Jira's stylesheets cannot reach into our chrome.
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { all: initial; }
        .backdrop {
          position: fixed; inset: 0; z-index: 2147483646;
          background: rgba(9, 12, 20, .55);
          backdrop-filter: blur(2px);
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
          animation: fade .12s ease-out;
        }
        @keyframes fade { from { opacity: 0 } to { opacity: 1 } }
        .frame {
          position: relative;
          width: min(1240px, 100%); height: min(900px, 100%);
          background: #fff; border-radius: 12px; overflow: hidden;
          box-shadow: 0 24px 64px rgba(0,0,0,.4);
          display: flex; flex-direction: column;
        }
        @media (prefers-color-scheme: dark) { .frame { background: #0d1117; } }
        iframe { border: 0; width: 100%; height: 100%; display: block; }
        .loading {
          position: absolute; inset: 0; display: flex; align-items: center;
          justify-content: center; color: #6b7280; gap: 10px;
        }
        .spinner {
          width: 16px; height: 16px; border: 2px solid currentColor;
          border-top-color: transparent; border-radius: 50%;
          animation: spin .7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg) } }
        .error {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 12px; padding: 40px;
          text-align: center; color: #374151;
        }
        @media (prefers-color-scheme: dark) { .error { color: #d1d5db; } }
        .error h3 { margin: 0; font-size: 15px; font-weight: 600; }
        .error p { margin: 0; max-width: 460px; color: #6b7280; font-size: 13px; }
        .error code {
          font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
          background: rgba(127,127,127,.14); padding: 7px 10px; border-radius: 6px;
          max-width: 100%; overflow-wrap: anywhere;
        }
        .error button {
          margin-top: 4px; padding: 8px 16px; border: 0; border-radius: 6px;
          background: #0969da; color: #fff; font: 600 13px inherit;
          font-family: inherit; cursor: pointer;
        }
        .error button:hover { filter: brightness(1.08); }
        .hidden { display: none !important; }
      </style>
      <div class="backdrop">
        <div class="frame">
          <div class="loading"><span class="spinner"></span><span>Loading markdown…</span></div>
          <div class="error hidden"></div>
          <iframe class="hidden" allow="clipboard-write"></iframe>
        </div>
      </div>`;

    (document.body || document.documentElement).appendChild(host);

    const backdrop = root.querySelector('.backdrop');
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });

    shell = {
      host,
      root,
      backdrop,
      iframe: root.querySelector('iframe'),
      loading: root.querySelector('.loading'),
      error: root.querySelector('.error')
    };
    return shell;
  }

  function close () {
    if (!shell) return;
    shell.host.remove();
    shell = null;
    document.removeEventListener('keydown', onKey, true);
  }

  function onKey (e) {
    if (e.key === 'Escape' && shell) { e.stopPropagation(); close(); }
  }

  function showError ({ title, detail, action }) {
    const s = ensureShell();
    s.loading.classList.add('hidden');
    s.iframe.classList.add('hidden');
    s.error.classList.remove('hidden');
    s.error.innerHTML = '';

    const h = document.createElement('h3');
    h.textContent = title;
    s.error.appendChild(h);

    if (detail) {
      const p = document.createElement('p');
      p.textContent = detail;
      s.error.appendChild(p);
    }
    if (action) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = action.label;
      btn.addEventListener('click', action.onClick);
      s.error.appendChild(btn);
    }
  }

  /** Open the modal and stream a document into the viewer iframe. */
  function openViewer (doc) {
    const s = ensureShell();
    document.addEventListener('keydown', onKey, true);
    s.error.classList.add('hidden');
    s.loading.classList.remove('hidden');
    s.iframe.classList.add('hidden');

    const url = chrome.runtime.getURL('viewer.html') + '#embed';
    if (s.iframe.src !== url) s.iframe.src = url;

    const onMessage = (event) => {
      if (!shell || event.source !== shell.iframe.contentWindow) return;
      const data = event.data || {};
      if (data.type === 'MDP_VIEWER_READY') {
        shell.iframe.contentWindow.postMessage({ type: 'MDP_RENDER', doc }, '*');
      } else if (data.type === 'MDP_VIEWER_RENDERED') {
        shell.loading.classList.add('hidden');
        shell.iframe.classList.remove('hidden');
        shell.iframe.focus();
      } else if (data.type === 'MDP_VIEWER_CLOSE') {
        window.removeEventListener('message', onMessage);
        close();
      } else if (data.type === 'MDP_VIEWER_POPOUT') {
        window.removeEventListener('message', onMessage);
        popOut(doc);
        close();
      }
    };
    window.addEventListener('message', onMessage);
  }

  async function popOut (doc) {
    const stash = await send({ type: 'MDP_STASH', doc });
    if (!stash.ok) return;
    await send({ type: 'MDP_OPEN_TAB', url: chrome.runtime.getURL('viewer.html') + '?doc=' + stash.id });
  }

  async function previewAttachment (att) {
    ensureShell();
    document.addEventListener('keydown', onKey, true);
    const res = await send({ type: 'MDP_FETCH_TEXT', url: att.url });

    if (!res.ok) {
      if (res.needsPermission) {
        showError({
          title: 'Chrome blocked the download',
          detail: 'This attachment is served from a host outside your Jira site, which this extension is not allowed to read yet. You can grant that access in the extension settings — it is off by default.',
          action: { label: 'Open settings', onClick: () => send({ type: 'MDP_OPEN_OPTIONS' }) }
        });
      } else {
        showError({ title: 'Could not load this markdown file', detail: res.error });
      }
      return;
    }

    openViewer({
      text: res.data.text,
      filename: att.filename,
      sourceUrl: att.url,
      baseUrl: res.data.finalUrl || att.url
    });
  }

  /* ---------------------------------------------- Jira attachment discovery */

  function issueKeyFromUrl () {
    const KEY = /^[A-Z][A-Z0-9_]{1,20}-\d+$/i;
    const path = decodeURIComponent(location.pathname);

    const fromPath = path.match(/\/(?:browse|issues)\/([A-Z][A-Z0-9_]{1,20}-\d+)/i);
    if (fromPath) return fromPath[1].toUpperCase();

    const selected = new URLSearchParams(location.search).get('selectedIssue');
    if (selected && KEY.test(selected)) return selected.toUpperCase();

    const boardIssue = path.match(/\/(?:boards|projects)\/[^/]+\/(?:issues|backlog)?\/?([A-Z][A-Z0-9_]{1,20}-\d+)/i);
    if (boardIssue) return boardIssue[1].toUpperCase();

    return null;
  }

  let lastKey = null;
  let attachments = [];

  /**
   * The issue REST endpoint is the only reliable source: the modern issue view
   * renders attachments as media cards, so the filename never reaches the DOM
   * in a form we could match on.
   */
  async function loadAttachments () {
    const key = issueKeyFromUrl();
    if (!key) { setAttachments([]); lastKey = null; return; }
    if (key === lastKey) return;
    lastKey = key;

    const url = `${location.origin}/rest/api/3/issue/${encodeURIComponent(key)}?fields=attachment`;
    const res = await send({ type: 'MDP_FETCH_JSON', url });
    if (!res.ok) { setAttachments([]); return; }

    const list = (res.data && res.data.fields && res.data.fields.attachment) || [];
    setAttachments(list
      .filter((a) => MD_NAME_RE.test(a.filename || ''))
      .map((a) => ({ filename: a.filename, url: a.content, size: a.size })));
  }

  function setAttachments (next) {
    attachments = next;
    renderLauncher();
  }

  /* ------------------------------------------------------------- launcher */

  let launcher = null;

  function renderLauncher () {
    if (!attachments.length) {
      if (launcher) { launcher.remove(); launcher = null; }
      return;
    }
    if (!launcher) {
      launcher = document.createElement('div');
      launcher.className = 'mdp-launcher';
      (document.body || document.documentElement).appendChild(launcher);
      document.addEventListener('click', (e) => {
        const menu = launcher && launcher.querySelector('.mdp-menu');
        if (menu && !launcher.contains(e.target)) menu.classList.add('mdp-hidden');
      });
    }
    launcher.innerHTML = '';

    const single = attachments.length === 1;

    const pill = document.createElement('button');
    pill.className = 'mdp-pill';
    pill.type = 'button';
    const mark = document.createElement('span');
    mark.className = 'mdp-pill-mark';
    mark.textContent = 'MD';
    const label = document.createElement('span');
    label.textContent = single
      ? attachments[0].filename
      : `${attachments.length} markdown attachments`;
    pill.append(mark, label);
    pill.title = single ? 'Preview ' + attachments[0].filename : 'Show markdown attachments';
    launcher.appendChild(pill);

    if (single) {
      pill.addEventListener('click', () => previewAttachment(attachments[0]));
      return;
    }

    const menu = document.createElement('div');
    menu.className = 'mdp-menu mdp-hidden';
    for (const att of attachments) {
      const item = document.createElement('button');
      item.className = 'mdp-menu-item';
      item.type = 'button';
      const name = document.createElement('span');
      name.className = 'mdp-menu-name';
      name.textContent = att.filename;
      const meta = document.createElement('span');
      meta.className = 'mdp-menu-meta';
      meta.textContent = formatSize(att.size);
      item.append(name, meta);
      item.addEventListener('click', () => {
        menu.classList.add('mdp-hidden');
        previewAttachment(att);
      });
      menu.appendChild(item);
    }
    launcher.appendChild(menu);
    pill.addEventListener('click', () => menu.classList.toggle('mdp-hidden'));
  }

  function formatSize (bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  /* -------------------------------------------------------------- messages */

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'MDP_TOGGLE_PANEL') {
      const pill = launcher && launcher.querySelector('.mdp-pill');
      if (pill) pill.click();
      sendResponse({ ok: true });
    } else if (msg.type === 'MDP_LIST_ATTACHMENTS') {
      sendResponse({ ok: true, attachments });
    } else if (msg.type === 'MDP_PREVIEW_INDEX') {
      const att = attachments[msg.index];
      if (att) previewAttachment(att);
      sendResponse({ ok: !!att });
    }
    return true;
  });

  /* ----------------------------------------------------------------- boot */

  function boot () {
    loadAttachments();

    // Jira is a SPA: the issue changes without a navigation event.
    let href = location.href;
    setInterval(() => {
      if (location.href === href) return;
      href = location.href;
      loadAttachments();
    }, 700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
