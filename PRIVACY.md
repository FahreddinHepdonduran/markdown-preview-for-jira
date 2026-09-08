# Privacy Policy — Markdown Preview for Jira

_Last updated: 7 September 2026_

## Summary

This extension collects nothing. No analytics, no accounts, no telemetry, no remote
servers. Everything it does happens inside your browser.

## What the extension accesses

On a Jira issue page, the extension makes two kinds of request, both to your own Jira
site, both using the session you are already signed in with:

1. **The issue's attachment list** — `/rest/api/3/issue/{key}?fields=attachment`, to find
   out whether any attachment is a markdown file.
2. **The contents of a markdown attachment** — only for the file you click on, so it can
   be rendered.

It makes no other network request. It does not read, modify, or transmit anything else on
the page.

## What is stored

Two things, both in your browser's local extension storage:

- **Your reading preferences** — colour theme, base text size, and whether the table of
  contents starts open.
- **A temporary hand-off** — when you open a preview in its own tab, the file's contents
  sit in `chrome.storage.session` for a few seconds so the new tab can pick them up. That
  storage is cleared when the tab reads it, and in any case when the browser closes.

The contents of your markdown files are never written to permanent storage and never
leave your machine.

## What is not collected

- No personal information
- No browsing history or activity
- No page content
- No file contents
- No identifiers, cookies, or fingerprints
- Nothing is sold, shared, or transferred to anyone

## Permissions

| Permission | Why |
|---|---|
| `storage` | Your reading preferences, and the temporary hand-off described above. |
| `*://*.atlassian.net/*`, `*://*.atlassian.com/*`, `*://*.jira.com/*` | The domains Jira runs on. Needed to read the attachment list and download the markdown file you click. |
| `*://*/*` (optional, off by default) | Some Jira instances store attachment downloads on a host outside the Atlassian domains. If yours does, you can enable this in the extension's settings so that download succeeds. It is used only to fetch a markdown attachment you explicitly clicked, and you can revoke it in the same place. |

## Third parties

None. Every library the extension uses (markdown-it, highlight.js, DOMPurify, Mermaid,
KaTeX) ships inside the extension package and runs locally. No code is fetched at runtime.

## Changes

If this policy ever changes, the updated version will be published at this address and
the date above will change with it.

## Contact

Questions, or something here that does not match what you observe? Open an issue on
this project's GitHub repository — the link is on the extension's Chrome Web Store
listing and in the project README.

---

Not affiliated with, endorsed by, or sponsored by Atlassian. Jira is a trademark of
Atlassian Pty Ltd.
