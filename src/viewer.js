/* Viewer: turns a markdown string into a readable page.
   Runs as an extension page — embedded in an iframe over Jira, or standalone. */

(() => {
  const { MarkdownIt, anchor, taskLists, DOMPurify, hljs, registerLanguages } = window.MDP;

  const $ = (id) => document.getElementById(id);
  const els = {
    filename: $('filename'),
    source: $('source'),
    toc: $('toc'),
    content: $('content'),
    reader: $('reader'),
    docfoot: $('docfoot'),
    toast: $('toast')
  };

  const embedded = location.hash.includes('embed');
  if (embedded) document.body.classList.add('embedded');

  let doc = null;          // { text, filename, sourceUrl, baseUrl }
  let langsReady = registerLanguages();

  /* ------------------------------------------------------- markdown-it */

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: false,
    typographer: false,
    highlight (str, lang) {
      const name = (lang || '').trim().toLowerCase();
      try {
        if (name && hljs.getLanguage(name)) {
          return hljs.highlight(str, { language: name, ignoreIllegals: true }).value;
        }
        return hljs.highlightAuto(str).value;
      } catch {
        return '';
      }
    }
  });

  md.use(taskLists, { enabled: true, label: true, labelAfter: true });
  md.use(anchor, {
    level: [1, 2, 3, 4, 5, 6],
    slugify: (s) => 'h-' + String(s).trim().toLowerCase()
      .replace(/[^\wÀ-￿\- ]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') || 'section',
    permalink: anchor.permalink.linkInsideHeader({
      symbol: '#',
      class: 'anchor',
      placement: 'before',
      ariaHidden: true
    })
  });

  // Mermaid blocks bypass the highlighter entirely — they become empty
  // containers the renderer fills in later, once the (large) library has
  // loaded. The sources travel in an array rather than a data- attribute so
  // that sanitising the HTML cannot lose them.
  let mermaidSources = [];
  const defaultFence = md.renderer.rules.fence.bind(md.renderer.rules);
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const info = (token.info || '').trim().split(/\s+/)[0].toLowerCase();
    if (info === 'mermaid') {
      mermaidSources.push(token.content);
      return '<div class="mdp-mermaid"></div>';
    }
    const html = defaultFence(tokens, idx, options, env, self);
    const label = info ? `<span class="code-lang">${escapeHtml(info)}</span>` : '';
    return `<div class="code-block">${label}<button class="code-copy" type="button">Copy</button>${html}</div>`;
  };

  // Links open in a new tab; relative hrefs resolve against the source document.
  const defaultLinkOpen = md.renderer.rules.link_open ||
    ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx].attrGet('href') || '';
    if (!href.startsWith('#')) {
      tokens[idx].attrSet('target', '_blank');
      tokens[idx].attrSet('rel', 'noopener noreferrer');
      const abs = resolve(href);
      if (abs) tokens[idx].attrSet('href', abs);
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  const defaultImage = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const src = tokens[idx].attrGet('src') || '';
    const abs = resolve(src);
    if (abs) tokens[idx].attrSet('src', abs);
    tokens[idx].attrSet('loading', 'lazy');
    return defaultImage(tokens, idx, options, env, self);
  };

  function resolve (url) {
    if (!url || /^(https?:|data:|mailto:|#)/i.test(url)) return null;
    if (!doc || !doc.baseUrl) return null;
    try { return new URL(url, doc.baseUrl).href; } catch { return null; }
  }

  function escapeHtml (s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  const escapeAttr = escapeHtml;

  /* ----------------------------------------------------------- render */

  async function render (nextDoc) {
    doc = nextDoc;
    await langsReady;

    els.filename.textContent = doc.filename || 'document.md';
    document.title = (doc.filename || 'Markdown') + ' — Preview';
    if (doc.sourceUrl && /^https?:/i.test(doc.sourceUrl)) {
      els.source.href = doc.sourceUrl;
      els.source.hidden = false;
    }

    const { text, frontmatter } = splitFrontmatter(doc.text || '');
    mermaidSources = [];
    const rawHtml = md.render(text);
    const clean = DOMPurify.sanitize(rawHtml, {
      ADD_ATTR: ['target', 'rel', 'loading', 'align'],
      ADD_TAGS: ['details', 'summary'],
      USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true }
    });

    els.content.innerHTML = '';
    if (frontmatter) els.content.appendChild(frontmatterTable(frontmatter));
    const holder = document.createElement('div');
    holder.innerHTML = clean;
    while (holder.firstChild) els.content.appendChild(holder.firstChild);

    upgradeAlerts();
    wireCodeCopy();
    buildToc();
    stats(text);

    document.body.classList.remove('mdp-loading');
    notifyParent('MDP_VIEWER_RENDERED');

    // Heavy, optional passes run after the text is already on screen.
    renderMath();
    renderMermaid();
  }

  /* ------------------------------------------------------ frontmatter */

  function splitFrontmatter (raw) {
    const m = raw.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!m) return { text: raw, frontmatter: null };
    const pairs = [];
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^([A-Za-z0-9_.\- ]+):\s*(.*)$/);
      if (kv) pairs.push([kv[1].trim(), kv[2].trim().replace(/^["']|["']$/g, '')]);
    }
    if (!pairs.length) return { text: raw, frontmatter: null };
    return { text: raw.slice(m[0].length), frontmatter: pairs };
  }

  function frontmatterTable (pairs) {
    const details = document.createElement('details');
    details.className = 'alert';
    details.open = pairs.length <= 6;
    const summary = document.createElement('summary');
    summary.className = 'alert-title frontmatter-title';
    summary.textContent = 'Front matter';
    details.appendChild(summary);
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    for (const [k, v] of pairs) {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.textContent = k;
      const td = document.createElement('td');
      td.textContent = v;
      tr.append(th, td);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    details.appendChild(table);
    return details;
  }

  /* ---------------------------------------------------- GitHub alerts */

  const ALERTS = {
    NOTE: ['alert-note', 'ℹ', 'Note'],
    TIP: ['alert-tip', '✓', 'Tip'],
    IMPORTANT: ['alert-important', '★', 'Important'],
    WARNING: ['alert-warning', '⚠', 'Warning'],
    CAUTION: ['alert-caution', '⛔', 'Caution']
  };

  function upgradeAlerts () {
    for (const bq of els.content.querySelectorAll('blockquote')) {
      const first = bq.firstElementChild;
      if (!first || first.tagName !== 'P') continue;
      const m = first.textContent.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);
      if (!m) continue;
      const [cls, icon, label] = ALERTS[m[1].toUpperCase()];
      // Strip the marker from the text without disturbing inline markup.
      const walker = document.createTreeWalker(first, NodeFilter.SHOW_TEXT);
      const node = walker.nextNode();
      if (node) node.nodeValue = node.nodeValue.replace(/^\[!\w+\]\s*/i, '');
      if (!first.textContent.trim() && !first.querySelector('img, code')) first.remove();

      const div = document.createElement('div');
      div.className = 'alert ' + cls;
      const title = document.createElement('div');
      title.className = 'alert-title';
      title.textContent = icon + ' ' + label;
      div.appendChild(title);
      while (bq.firstChild) div.appendChild(bq.firstChild);
      bq.replaceWith(div);
    }
  }

  /* ------------------------------------------------------- code copy */

  function wireCodeCopy () {
    for (const btn of els.content.querySelectorAll('.code-copy')) {
      btn.addEventListener('click', async () => {
        const code = btn.parentElement.querySelector('code');
        if (!code) return;
        await copy(code.textContent);
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1400);
      });
    }
  }

  async function copy (text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      ta.remove();
    }
  }

  /* -------------------------------------------------------------- toc */

  let tocLinks = [];

  function buildToc () {
    let headings = [...els.content.querySelectorAll('h1, h2, h3, h4, h5, h6')];
    // A lone top-level heading is the document title, already in the title bar.
    const h1s = headings.filter((h) => h.tagName === 'H1');
    if (h1s.length === 1 && headings[0] === h1s[0]) headings = headings.slice(1);

    els.toc.innerHTML = '';
    tocLinks = [];
    if (headings.length < 2) return;

    const title = document.createElement('p');
    title.className = 'toc-title';
    title.textContent = 'On this page';
    els.toc.appendChild(title);

    // Normalise so the shallowest heading in the document is the top level.
    const min = Math.min(...headings.map((h) => Number(h.tagName[1])));
    for (const h of headings) {
      const level = Number(h.tagName[1]) - min + 2;
      const a = document.createElement('a');
      a.href = '#' + h.id;
      a.className = 'lvl-' + Math.min(level, 6);
      const clone = h.cloneNode(true);
      clone.querySelectorAll('.anchor').forEach((n) => n.remove());
      a.textContent = clone.textContent.trim();
      a.addEventListener('click', (e) => {
        e.preventDefault();
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      els.toc.appendChild(a);
      tocLinks.push({ a, h });
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const { a, h } of tocLinks) a.classList.toggle('active', h === entry.target);
      }
    }, { root: els.reader, rootMargin: '0px 0px -75% 0px', threshold: 0 });
    for (const { h } of tocLinks) observer.observe(h);
  }

  /* ------------------------------------------------------------- math */

  function hasMath (text) {
    return /\$\$[\s\S]+?\$\$|(?:^|[^\\$])\$[^\s$][^$\n]*\$/.test(text || '');
  }

  async function renderMath () {
    if (!hasMath(doc.text)) return;
    try {
      await loadScript('vendor/katex.min.js');
      await loadScript('vendor/katex-auto-render.min.js');
      window.renderMathInElement(els.content, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false }
        ],
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option'],
        throwOnError: false
      });
    } catch (err) {
      console.warn('[md-preview] KaTeX failed:', err);
    }
  }

  /* ---------------------------------------------------------- mermaid */

  async function renderMermaid () {
    const blocks = [...els.content.querySelectorAll('.mdp-mermaid')];
    if (!blocks.length) return;
    try {
      await loadScript('vendor/mermaid.min.js');
      window.mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: currentTheme() === 'dark' ? 'dark' : 'default',
        fontFamily: 'inherit'
      });
    } catch (err) {
      console.warn('[md-preview] Mermaid failed to load:', err);
      return;
    }

    for (const block of blocks) {
      block.classList.remove('failed');
      block.innerHTML = '';
    }

    for (let n = 0; n < blocks.length; n++) {
      const block = blocks[n];
      const graph = mermaidSources[n] || '';
      try {
        const { svg } = await window.mermaid.render('mdp-graph-' + n + '-' + Date.now(), graph);
        block.innerHTML = svg;
      } catch (err) {
        block.classList.add('failed');
        block.textContent = 'Mermaid diagram could not be rendered: ' + (err && err.message || err);
        const pre = document.createElement('pre');
        pre.textContent = graph;
        block.appendChild(pre);
      }
    }
  }

  const loaded = new Map();
  function loadScript (path) {
    if (loaded.has(path)) return loaded.get(path);
    const p = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL(path);
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load ' + path));
      document.head.appendChild(s);
    });
    loaded.set(path, p);
    return p;
  }

  /* ------------------------------------------------------------ stats */

  function stats (text) {
    const words = (text.match(/[\wÀ-￿'’-]+/g) || []).length;
    const minutes = Math.max(1, Math.round(words / 220));
    const bytes = new Blob([text]).size;
    const size = bytes < 1024 ? bytes + ' B'
      : bytes < 1048576 ? (bytes / 1024).toFixed(1) + ' KB'
      : (bytes / 1048576).toFixed(1) + ' MB';
    els.docfoot.textContent =
      `${words.toLocaleString()} words · ~${minutes} min read · ${text.split(/\r?\n/).length.toLocaleString()} lines · ${size}`;
  }

  /* ------------------------------------------------------------ theme */

  function currentTheme () {
    return document.documentElement.dataset.theme ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function applyTheme (theme) {
    document.documentElement.dataset.theme = theme;
    chrome.storage.local.set({ theme });
  }

  function applyFontSize (px) {
    const clamped = Math.min(22, Math.max(12, px));
    document.documentElement.style.setProperty('--base-size', clamped + 'px');
    chrome.storage.local.set({ fontSize: clamped });
    return clamped;
  }

  let fontSize = 15;

  /* ----------------------------------------------------------- export */

  async function exportHtml () {
    const css = await fetch(chrome.runtime.getURL('src/viewer.css')).then((r) => r.text());
    const needsMath = els.content.querySelector('.katex');
    const mathCss = needsMath
      ? '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css">'
      : '';
    const html = `<!doctype html>
<html lang="en" data-theme="${currentTheme()}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(doc.filename || 'Markdown')}</title>
${mathCss}
<style>
${css}
body { display: block; }
.layout, .reader { display: block; overflow: visible; }
.code-copy { display: none; }
</style>
</head>
<body>
<main class="reader"><article class="markdown-body">${els.content.innerHTML}</article></main>
</body>
</html>`;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = (doc.filename || 'document').replace(/\.[^.]+$/, '') + '.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('Exported as HTML');
  }

  /* ------------------------------------------------------------ toast */

  let toastTimer = null;
  function toast (message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
  }

  /* ------------------------------------------------------------- wire */

  function notifyParent (type, extra) {
    if (embedded && window.parent !== window) {
      window.parent.postMessage({ type, ...extra }, '*');
    }
  }

  $('btn-toc').addEventListener('click', (e) => {
    const shown = els.toc.hidden;
    els.toc.hidden = !shown;
    e.currentTarget.setAttribute('aria-pressed', String(shown));
    chrome.storage.local.set({ tocOpen: shown });
  });
  $('btn-theme').addEventListener('click', () => {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    // Mermaid bakes its palette into the SVG, so diagrams need a redraw.
    renderMermaid();
  });
  $('btn-bigger').addEventListener('click', () => { fontSize = applyFontSize(fontSize + 1); });
  $('btn-smaller').addEventListener('click', () => { fontSize = applyFontSize(fontSize - 1); });
  $('btn-copy').addEventListener('click', async () => {
    await copy(doc.text || '');
    toast('Raw markdown copied');
  });
  $('btn-export').addEventListener('click', exportHtml);
  $('btn-print').addEventListener('click', () => window.print());
  $('btn-popout').addEventListener('click', () => notifyParent('MDP_VIEWER_POPOUT'));
  $('btn-close').addEventListener('click', () => notifyParent('MDP_VIEWER_CLOSE'));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && embedded) notifyParent('MDP_VIEWER_CLOSE');
    if ((e.metaKey || e.ctrlKey) && e.key === '\\') { e.preventDefault(); $('btn-toc').click(); }
  });

  /* -------------------------------------------------------------- boot */

  function showError (message) {
    document.body.classList.remove('mdp-loading');
    els.content.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'mdp-error';
    div.textContent = message;
    els.content.appendChild(div);
    notifyParent('MDP_VIEWER_RENDERED');
  }

  (async () => {
    const prefs = await chrome.storage.local.get({ theme: null, fontSize: 15, tocOpen: true });
    if (prefs.theme) document.documentElement.dataset.theme = prefs.theme;
    fontSize = applyFontSize(prefs.fontSize);
    if (prefs.tocOpen) {
      els.toc.hidden = false;
      $('btn-toc').setAttribute('aria-pressed', 'true');
    }

    if (embedded) {
      window.addEventListener('message', (event) => {
        if (event.source !== window.parent) return;
        if (event.data && event.data.type === 'MDP_RENDER') render(event.data.doc);
      });
      notifyParent('MDP_VIEWER_READY');
      return;
    }

    // Standalone tab: the document was stashed by the service worker when the
    // user popped the preview out of the modal.
    const id = new URLSearchParams(location.search).get('doc');
    if (!id) {
      showError('Nothing to preview. Open a Jira issue that has a .md attachment and click the pill in the corner.');
      return;
    }
    chrome.runtime.sendMessage({ type: 'MDP_UNSTASH', id }, (res) => {
      if (res && res.ok && res.doc) render(res.doc);
      else showError('This preview has expired. Open it again from the issue.');
    });
  })();
})();
