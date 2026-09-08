const $ = (id) => document.getElementById(id);

const DEFAULTS = { theme: null, fontSize: 15, tocOpen: true };
const BROAD = { origins: ['*://*/*'] };

let savedTimer = null;
function flashSaved () {
  $('saved').classList.add('show');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => $('saved').classList.remove('show'), 1200);
}

async function init () {
  const prefs = await chrome.storage.local.get(DEFAULTS);

  $('theme').value = prefs.theme || '';
  $('font-size').value = prefs.fontSize;
  $('font-size-out').textContent = prefs.fontSize + 'px';
  $('toc-open').checked = prefs.tocOpen;
  $('broad-access').checked = await chrome.permissions.contains(BROAD);

  $('theme').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ theme: e.target.value || null });
    flashSaved();
  });

  $('font-size').addEventListener('input', (e) => {
    $('font-size-out').textContent = e.target.value + 'px';
  });
  $('font-size').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ fontSize: Number(e.target.value) });
    flashSaved();
  });

  $('toc-open').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ tocOpen: e.target.checked });
    flashSaved();
  });

  // Optional host access, granted and revoked by the user right here.
  $('broad-access').addEventListener('change', async (e) => {
    if (e.target.checked) {
      const granted = await chrome.permissions.request(BROAD);
      e.target.checked = granted;
      if (granted) flashSaved();
    } else {
      await chrome.permissions.remove(BROAD);
      flashSaved();
    }
  });
}

init();
