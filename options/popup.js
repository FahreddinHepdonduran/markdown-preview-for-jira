const $ = (id) => document.getElementById(id);

async function init () {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) return;

  let attachments = [];
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'MDP_LIST_ATTACHMENTS' });
    attachments = (res && res.attachments) || [];
  } catch {
    // Not a Jira page, or the issue has no markdown on it.
  }
  if (!attachments.length) return;

  $('empty').hidden = true;
  $('found').hidden = false;
  $('found-label').textContent =
    `${attachments.length} markdown ${attachments.length === 1 ? 'attachment' : 'attachments'} on this issue`;

  attachments.forEach((att, index) => {
    const btn = document.createElement('button');
    btn.className = 'item';
    btn.type = 'button';
    btn.textContent = att.filename;
    btn.addEventListener('click', async () => {
      await chrome.tabs.sendMessage(tab.id, { type: 'MDP_PREVIEW_INDEX', index });
      window.close();
    });
    $('found-list').appendChild(btn);
  });
}

$('open-options').addEventListener('click', () => chrome.runtime.openOptionsPage());

init();
