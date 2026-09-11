# Chrome Web Store submission — Markdown Preview for Jira 1.0.0

Everything the dashboard asks for, in the order the dashboard asks for it.
Copy the blocks verbatim; they are written to match what the code actually does.

Upload package: `markdown-preview-for-jira-1.0.0.zip` (built from this repo, 47 files, 1.4 MB).
Not tracked in git — rebuild it with the command at the bottom of this file.

---

## 1. Store listing tab

**Name** (limit 75) — 25 characters

```
Markdown Preview for Jira
```

**Summary** (limit 132) — 118 characters. Identical to `description` in the manifest; keep the two in sync.

```
Read .md attachments on a Jira issue without downloading them — rendered inline, with code, tables, diagrams and math.
```

**Category** — `Workflow & Planning`. `Developer Tools` is the defensible alternative; pick one and leave it
alone, since changing category later resets some review state.

**Language** — English (United States).

**Description**

```
Someone attaches a design doc, a runbook, or release notes to a Jira issue as a .md file. Today that
means downloading it, finding it, and opening it in another app — and doing it again every time the
file changes.

This extension renders it where it already is. Open the issue, click the button in the bottom-right
corner, and the file opens on top of the issue, formatted.

WHAT IT RENDERS

• GitHub-flavored markdown — tables, task lists, strikethrough, autolinks
• Syntax highlighting for around 40 languages
• Mermaid diagrams, redrawn when you switch theme
• Math, inline and display
• GitHub alerts — NOTE, TIP, IMPORTANT, WARNING, CAUTION
• YAML front matter as a table instead of a stray horizontal rule

WHILE READING

• A table of contents that follows your scroll position
• Light and dark themes, and adjustable text size
• Copy the raw markdown, or any single code block
• Export a standalone HTML file, print, or pop the preview into its own tab
• Esc closes it. Alt+Shift+M opens it from the keyboard.

WHY AN ORDINARY MARKDOWN VIEWER DOESN'T COVER THIS

Other markdown viewers wait for you to navigate to a .md file, then render that page. That never
happens with a Jira attachment: Jira serves attachments as a download rather than a page, the URL is
an opaque id that redirects to a signed media host, and the issue view shows attachments as cards
rather than links. So the usual approach never fires. This extension goes the other way round — it
reads the issue's own attachment list, fetches the file with the session you are already signed in
with, and renders the result.

PRIVACY

Nothing is collected. No analytics, no accounts, no telemetry, no servers of any kind. Every library
is bundled inside the extension, so no code is fetched at runtime. The extension only runs on Jira
domains, and the only requests it makes are to your own Jira site: the issue's attachment list, and
the one file you click.

Open source — the full source is linked below.

Not affiliated with, endorsed by, or sponsored by Atlassian. Jira is a trademark of Atlassian Pty Ltd.
```

**Additional fields**

| Field | Value |
|---|---|
| Official URL | Leave as `None`. That dropdown only offers domains verified under your own account in Google Search Console. A GitHub URL can't go there — the domain isn't yours to verify. It only affects a "verified publisher" badge, nothing about review or ranking. |
| Homepage URL | `https://github.com/FahreddinHepdonduran/markdown-preview-for-jira` |
| Support URL | `https://github.com/FahreddinHepdonduran/markdown-preview-for-jira/issues` |
| Mature content | Off |

The support URL has to actually work: `PRIVACY.md` tells users to open an issue, so that is the
contact path of record. Check that issue creation is open to the public — GitHub can restrict it to
collaborators, and if it is restricted, users who follow the privacy policy hit a dead end.

---

## 2. Graphic assets

| Dashboard slot | File | Notes |
|---|---|---|
| Store icon, 128×128, **required** | `store-assets/store-icon-128.png` | 96×96 artwork with 16px transparent padding, which is what Google asks for here. Not the same file as `icons/icon128.png`, which fills the tile because that is what the browser UI wants. |
| Screenshots, 1280×800, **1–5 required** | `screenshots/1-reader-light.png`, `2-diagram-math-light.png`, `3-code-light.png`, `4-settings-light.png` | Upload in that order — the first one is the thumbnail. Full bleed, square corners, no padding, as required. |
| Small promo tile, 440×280, **required** | `store-assets/promo-tile-440x280.png` | Deliberately just the mark and the name; Google asks that promo images still read at half size. |
| Marquee promo tile, 1400×560, optional | `store-assets/promo-marquee-1400x560.png` | Only used if the item gets featured. No harm in supplying it. |

The dark-theme screenshots (`*-dark.png`) are alternates. Do not mix light and dark in the same set —
pick one look and stay with it, or the listing reads as inconsistent.

---

## 3. Privacy tab

**Single purpose**

```
The extension has one purpose: to display a markdown (.md) file that is attached to a Jira issue as
rendered text, in the tab the user is already on, instead of requiring them to download the file and
open it in another application.

Everything in the extension serves that purpose. On a Jira issue page it reads the issue's attachment
list to determine whether any attachment is a markdown file. If one is, it shows a single button in
the bottom-right corner. Clicking the button fetches that file and renders it in an overlay. The
settings page exposes only reading preferences (theme, text size, table of contents) and one optional
permission toggle described below. The extension does nothing on any other site and has no other
feature.
```

**Permission justifications**

`storage`

```
Used for two things, both local to the browser. First, the user's three reading preferences — colour
theme, base text size, and whether the table of contents starts open — are kept in
chrome.storage.local so the preview looks the same next time. Second, when the user pops a preview
out into its own tab, the document is passed to that tab through chrome.storage.session and cleared
as soon as the tab reads it.

No page content, file content, or user information is written to persistent storage, and nothing in
storage is transmitted anywhere.
```

`*://*.atlassian.net/*`, `*://*.atlassian.com/*`, `*://*.jira.com/*`

```
These are the domains Jira runs on, and the extension's entire function takes place on a Jira issue
page. The host permission is needed for two things.

First, the content script runs on the issue page to determine which issue is open, to show the button,
and to host the preview overlay.

Second, the extension calls two endpoints on the user's own Jira site, using the session they are
already signed in with: the issue's attachment list
(/rest/api/3/issue/{issueKey}?fields=attachment), and the download URL of the one markdown attachment
the user clicked. Jira serves attachments with Content-Disposition: attachment and redirects to a
signed media host, so this fetch has to be made from the extension's service worker — a fetch from the
content script is blocked by CORS and cannot follow that redirect with credentials.

The extension makes no other network request, and the host list is limited to these three domains.
```

`*://*/*` (declared as `optional_host_permissions`)

```
Off by default, never requested automatically, and not needed by most users.

Some Jira deployments serve attachment downloads from a host outside the Atlassian domains — a
customer-owned S3 bucket, for example. For those users the download fetch fails, and the extension
shows an explanation with a button that opens its settings page, where the user can choose to grant
this permission. It is used for one thing only: fetching a markdown attachment the user has explicitly
clicked. The user can revoke it on the same settings page at any time.
```

**Remote code** — select **No, I am not using remote code**.

Every library (markdown-it, highlight.js, DOMPurify, Mermaid, KaTeX) is bundled in `vendor/` inside the
package. There is no `eval`, no `new Function`, and no script or stylesheet loaded over the network.
One caveat worth knowing: a *file the user exports* links the KaTeX stylesheet from a CDN, but that is
a saved HTML file opened outside the browser extension, not code the extension runs.

**Data usage** — leave **every** collection checkbox unchecked. The extension collects none of the
listed categories: no personally identifiable information, health, financial, authentication,
personal communications, location, web history, user activity, or website content.

Then check all three certifications:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL**

```
https://github.com/FahreddinHepdonduran/markdown-preview-for-jira/blob/main/PRIVACY.md
```

This has to be publicly reachable when you submit, so push the repository first and open the link in a
private window to confirm.

---

## 4. Before you hit submit

- [ ] The repository is pushed and the privacy policy URL above loads for a signed-out visitor
- [ ] `markdown-preview-for-jira-1.0.0.zip` is freshly built from a clean tree
- [ ] Name, summary, and version in the dashboard match `manifest.json`
- [ ] One screenshot set — all light or all dark, not a mix
- [ ] No collection checkbox ticked; all three certifications ticked
- [ ] Support and homepage URLs point at the repository, and issue creation is open to the public
- [ ] Visibility set the way you want it. Unlisted first is a reasonable way to see the listing before
      anyone else does; you can switch to public later without a new review.

## 5. If it comes back rejected

The likeliest cause is `optional_host_permissions: ["*://*/*"]`. Reviewers read a match-all pattern as
broad host access even when it is optional and off by default, and that is the one thing in this
package that invites an in-depth review rather than the standard one.

If that is the stated reason, the fastest path is to remove those two lines from `manifest.json` and
resubmit. The cost is real but small: users whose Jira serves attachments from a non-Atlassian host
lose the ability to fix their own case from the settings page. Everything else keeps working. Do not
remove it pre-emptively — it is a genuine feature for those users, and it may well pass.

The second thing reviewers sometimes ask about is minified code. `vendor/` contains minified library
builds, which is allowed; if you are asked, point them at `build/bundle-entry.js` and `package.json`,
which together reproduce `vendor/mdp-bundle.js` exactly via `npm run build`.

---

## Rebuilding the upload package

```bash
rm -f markdown-preview-for-jira-*.zip
zip -q -r -X "markdown-preview-for-jira-1.0.0.zip" \
  manifest.json viewer.html src options vendor icons LICENSE \
  -x "*.DS_Store" "icons/*.svg"
```

Deliberately excluded: `screenshots/`, `store-assets/`, `testfixtures/`, `build/`, `package.json`,
`package-lock.json`, `README.md`, `PRIVACY.md`, and this file. None of them are needed at runtime, and
the smaller the package, the less there is to review.
