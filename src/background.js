/* Service worker: fetches attachment content with the user's session, and
   hands documents to a standalone viewer tab. Nothing else. */

const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Attachments must be fetched from here rather than from the page. Jira serves
 * them from an id-based endpoint that redirects to a signed media host, and a
 * page-context fetch cannot read across that redirect.
 */
async function fetchText (url) {
  const res = await fetch(url, {
    credentials: 'include',
    redirect: 'follow',
    headers: { 'Accept': 'text/plain, text/markdown, */*' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const len = Number(res.headers.get('content-length') || 0);
  if (len > MAX_BYTES) throw new Error(`File too large (${(len / 1048576).toFixed(1)} MB)`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new Error('File too large');
  let text = new TextDecoder('utf-8').decode(buf);
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  return { text, finalUrl: res.url };
}

async function fetchJson (url) {
  const res = await fetch(url, { credentials: 'include', headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** A redirect off the Atlassian domains is the one failure we can act on. */
async function hasBroadAccess () {
  try {
    return await chrome.permissions.contains({ origins: ['*://*/*'] });
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg && msg.type) {
        case 'MDP_FETCH_TEXT':
          sendResponse({ ok: true, data: await fetchText(msg.url) });
          break;
        case 'MDP_FETCH_JSON':
          sendResponse({ ok: true, data: await fetchJson(msg.url) });
          break;
        case 'MDP_STASH': {
          const id = 'doc_' + Math.random().toString(36).slice(2);
          await chrome.storage.session.set({ [id]: msg.doc });
          sendResponse({ ok: true, id });
          break;
        }
        case 'MDP_UNSTASH': {
          const got = await chrome.storage.session.get(msg.id);
          await chrome.storage.session.remove(msg.id);
          sendResponse({ ok: true, doc: got[msg.id] || null });
          break;
        }
        case 'MDP_OPEN_TAB':
          await chrome.tabs.create({ url: msg.url });
          sendResponse({ ok: true });
          break;
        case 'MDP_OPEN_OPTIONS':
          await chrome.runtime.openOptionsPage();
          sendResponse({ ok: true });
          break;
        default:
          sendResponse({ ok: false, error: 'Unknown message' });
      }
    } catch (err) {
      const message = String((err && err.message) || err);
      // A TypeError here is Chrome refusing the request, which for this
      // extension almost always means the download redirected somewhere the
      // granted host permissions do not cover.
      const needsPermission = err instanceof TypeError && !(await hasBroadAccess());
      sendResponse({ ok: false, error: message, needsPermission });
    }
  })();
  return true;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'open-md-panel') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) return;
  chrome.tabs.sendMessage(tab.id, { type: 'MDP_TOGGLE_PANEL' }).catch(() => {});
});
