# Project Audit Report — Abantika Personal Website

> Audited: **2026-09-20** | Stack: Eleventy + Node.js + Vercel | ~3,400 LOC JS, ~2,350 LOC CSS

---

## 🔴 Critical (Fix Immediately)

| # | Area | Issue | File(s) |
|:--|:-----|:------|:--------|
| C1 | **Security** | Hardcoded default secrets (`SESSION_SECRET`, `ADMIN_PASSCODE`) allow auth bypass if env vars are missing | [env.js](file:///d:/Abantika_Proj/Personal%20Website/server/env.js) L39, L41 |
| C2 | **Security** | Path traversal — `slug`/`id` params passed directly to `path.join()` without sanitization. Enables arbitrary file deletion | [store.js](file:///d:/Abantika_Proj/Personal%20Website/server/store.js) (deleteNote, deleteProject, deleteBlog, deleteJournal) |
| C3 | **Security** | SVG uploads served as `image/svg+xml` without sanitization — stored XSS vector | [store.js](file:///d:/Abantika_Proj/Personal%20Website/server/store.js) L580 |
| C4 | **Security** | Fail-open auth: public JS redirects to `/admin/` on network error instead of failing closed | [base.njk](file:///d:/Abantika_Proj/Personal%20Website/src/_includes/layouts/base.njk) L316-318 |
| C5 | **CI/CD** | Two competing GitHub Actions workflows (`jekyll-gh-pages.yml` + `static.yml`) both trigger on push to `main` with same concurrency group | [.github/workflows/](file:///d:/Abantika_Proj/Personal%20Website/.github/workflows) |
| C6 | **CSS** | Reverse breakpoint cascade: `max-width: 800px` declared *before* `max-width: 850px` — 850px rule overrides at ≤800px widths | [admin.css](file:///d:/Abantika_Proj/Personal%20Website/src/assets/admin.css) L529, L713 |

---

## 🟠 High (Should Fix Soon)

| # | Area | Issue | File(s) |
|:--|:-----|:------|:--------|
| H1 | **Routing** | No public template for Notes — `/notes/bayesian-testing/` returns 404 despite backlinks pointing there | `src/notes/` missing entirely |
| H2 | **Content** | Corrupted placeholder text leaks into live meta tags: `prUHUHIUH890809808098` | [customer-churn-prediction.md](file:///d:/Abantika_Proj/Personal%20Website/content/projects/customer-churn-prediction.md) |
| H3 | **Content** | 8 content files still contain `[PLACEHOLDER — ...]` text in published entries | `content/projects/`, `content/blog/`, `content/journal/` |
| H4 | **Memory** | Event listener leaks: `mousemove`/`mouseup` on `window` in Portrait Studio never removed on close | [admin.js](file:///d:/Abantika_Proj/Personal%20Website/src/assets/admin.js) L2004, L2017 |
| H5 | **Memory** | `URL.createObjectURL()` called without `revokeObjectURL()` — retains image blobs in browser memory | [admin.js](file:///d:/Abantika_Proj/Personal%20Website/src/assets/admin.js) L1919, L2441 |
| H6 | **Memory** | Server `mediaBufferCache` (Map) has no LRU eviction, size limits, or TTL — OOM risk | [store.js](file:///d:/Abantika_Proj/Personal%20Website/server/store.js) L464 |
| H7 | **SEO** | BlogPosting JSON-LD schema never triggers — `pageType` variable is never set in blog/project templates | [base.njk](file:///d:/Abantika_Proj/Personal%20Website/src/_includes/layouts/base.njk) L40-58 |
| H8 | **Dependencies** | 4 packages used at runtime but not declared in `package.json`: `gray-matter`, `js-yaml`, `markdown-it`, `@smithy/node-http-handler` | [package.json](file:///d:/Abantika_Proj/Personal%20Website/package.json) |
| H9 | **XSS** | Preview iframe writes raw HTML via `document.write()` without sandbox | [admin.js](file:///d:/Abantika_Proj/Personal%20Website/src/assets/admin.js) L2270-2279 |

---

## 🟡 Medium (Improve When Possible)

| # | Area | Issue | File(s) |
|:--|:-----|:------|:--------|
| M1 | **CSS** | `@keyframes fadeInDown` referenced in both stylesheets but never declared — animation silently fails | [styles.css](file:///d:/Abantika_Proj/Personal%20Website/src/assets/styles.css) L139, [admin.css](file:///d:/Abantika_Proj/Personal%20Website/src/assets/admin.css) L737 |
| M2 | **CSS** | 15+ hardcoded background tint hex values that should be 2–3 CSS custom properties | [styles.css](file:///d:/Abantika_Proj/Personal%20Website/src/assets/styles.css) |
| M3 | **CSS** | `--muted` (4.04:1), `--red` (3.60:1), `--orange` (3.01:1) fail WCAG AA 4.5:1 contrast on `--paper` background | [styles.css](file:///d:/Abantika_Proj/Personal%20Website/src/assets/styles.css) |
| M4 | **CSS** | Missing `:focus-visible` on interactive elements: buttons, search input, nav links, admin rows, toolbar buttons | Both CSS files |
| M5 | **CSS** | `.main-nav` defined twice with conflicting font sizes, gaps, and hover colors | [styles.css](file:///d:/Abantika_Proj/Personal%20Website/src/assets/styles.css) L6-10 vs L454-506 |
| M6 | **CSS** | Dead artwork CSS block (L113-127) fully superseded by L207-356 | [styles.css](file:///d:/Abantika_Proj/Personal%20Website/src/assets/styles.css) |
| M7 | **CSS** | Undefined CSS variable `var(--bg)` used (never in `:root`) — renders transparent | [admin.css](file:///d:/Abantika_Proj/Personal%20Website/src/assets/admin.css) L403 |
| M8 | **JS** | Triple modal duplication (~400 lines): `showMediaSelectModal`, `showImagePickerModal`, `showImagePickerModalForPortrait` | [admin.js](file:///d:/Abantika_Proj/Personal%20Website/src/assets/admin.js) L1156, L1277, L2112 |
| M9 | **JS** | Deprecated APIs: `document.execCommand()` (L2741-2750, L3283) | [admin.js](file:///d:/Abantika_Proj/Personal%20Website/src/assets/admin.js) |
| M10 | **JS** | Console statements left in production code (4 instances) | [admin.js](file:///d:/Abantika_Proj/Personal%20Website/src/assets/admin.js) L2176, L2416, L2948, L3184 |
| M11 | **JS** | Empty `catch(e){}` blocks silently swallow errors (5 instances) | [admin.js](file:///d:/Abantika_Proj/Personal%20Website/src/assets/admin.js) L75, L1162, L1283, L2118, L1769 |
| M12 | **SEO** | Missing favicon, apple-touch-icon, and RSS auto-discovery `<link>` | [base.njk](file:///d:/Abantika_Proj/Personal%20Website/src/_includes/layouts/base.njk) |
| M13 | **SEO** | Duplicate `google-site-verification` meta tags | [base.njk](file:///d:/Abantika_Proj/Personal%20Website/src/_includes/layouts/base.njk) |
| M14 | **Content** | Duplicate project number `"01"` on two different projects | `customer-churn-prediction.md` + `financial-anomaly.md` |
| M15 | **Content** | Blog filename typo: `sql-got-a-new-competitior.md` (should be "competitor") | [sql-got-a-new-competitior.md](file:///d:/Abantika_Proj/Personal%20Website/content/blog/sql-got-a-new-competitior.md) |
| M16 | **A11y** | Admin modals lack focus trapping, `role="dialog"`, `aria-modal="true"` | [admin.js](file:///d:/Abantika_Proj/Personal%20Website/src/assets/admin.js) |
| M17 | **A11y** | WYSIWYG `contenteditable` div lacks `role="textbox"`, `aria-multiline`, label association | [admin.js](file:///d:/Abantika_Proj/Personal%20Website/src/assets/admin.js) |
| M18 | **A11y** | Search results missing `role="listbox"`, `aria-activedescendant` for keyboard navigation | [base.njk](file:///d:/Abantika_Proj/Personal%20Website/src/_includes/layouts/base.njk) |
| M19 | **Perf** | Video rewind on hover uses per-frame `currentTime` seeking — decoder thrashing on mobile | [base.njk](file:///d:/Abantika_Proj/Personal%20Website/src/_includes/layouts/base.njk) L381 |
| M20 | **Server** | No CORS headers or OPTIONS handling configured | [api.js](file:///d:/Abantika_Proj/Personal%20Website/server/api.js) |
| M21 | **Server** | No CSRF token validation on state-changing endpoints | [api.js](file:///d:/Abantika_Proj/Personal%20Website/server/api.js) |
| M22 | **UX** | 404 page missing header/footer — no navigation back to site | [404.njk](file:///d:/Abantika_Proj/Personal%20Website/src/404.njk) |
| M23 | **UX** | Blocking `alert("Link copied to clipboard!")` disrupts UX | [base.njk](file:///d:/Abantika_Proj/Personal%20Website/src/_includes/layouts/base.njk) L435 |

---

## 🟢 Low (Cleanup / Polish)

| # | Area | Issue | File(s) |
|:--|:-----|:------|:--------|
| L1 | **Repo** | Duplicate `Video Project 1.mp4` (~4.9 MB) in root `assets/` and `src/assets/` | Root `assets/` is orphaned |
| L2 | **Repo** | `og-image.png` (669 KB) could be optimized to <200 KB | [og-image.png](file:///d:/Abantika_Proj/Personal%20Website/src/assets/og-image.png) |
| L3 | **Repo** | Stray files in root: `website_style.png`, `.github/deploy.yml.bak`, 10+ handoff markdown docs | Project root |
| L4 | **Repo** | `.gitignore` missing rules for `.vercel/`, `*.bak`, `website_style.png` | [.gitignore](file:///d:/Abantika_Proj/Personal%20Website/.gitignore) |
| L5 | **Repo** | `.env.example` doesn't document R2 vars or `ADMIN_PASSCODE` | [.env.example](file:///d:/Abantika_Proj/Personal%20Website/.env.example) |
| L6 | **DX** | Missing `"dev"` script in `package.json` for local development with watch/serve | [package.json](file:///d:/Abantika_Proj/Personal%20Website/package.json) |
| L7 | **CSS** | Inconsistent button naming: `.button`, `.admin-btn`, `.admin-btn.primary`, `.admin-btn-danger`, `.wysiwyg-btn`, `.studio-mini-btn` | Both CSS files |
| L8 | **CSS** | Artwork row class names asymmetric (`.line-chart` → `.row-art-chart`, `.data-bars` → `.row-art-bars`) | [styles.css](file:///d:/Abantika_Proj/Personal%20Website/src/assets/styles.css) |
| L9 | **CSS** | Duplicate `.admin-badge` vs `.admin-status-badge` badge conventions | [admin.css](file:///d:/Abantika_Proj/Personal%20Website/src/assets/admin.css) L113 vs L1440 |
| L10 | **CSS** | 4 fragmented `@media (max-width: 800px)` blocks and 4 fragmented `@media (max-width: 510px)` blocks | [styles.css](file:///d:/Abantika_Proj/Personal%20Website/src/assets/styles.css) |
| L11 | **JS** | Hardcoded `http://localhost:8787/admin/` fallback (server runs on 8080) | [admin.js](file:///d:/Abantika_Proj/Personal%20Website/src/assets/admin.js) L2332 |
| L12 | **JS** | 3,400-line monolithic IIFE — could be modularized | [admin.js](file:///d:/Abantika_Proj/Personal%20Website/src/assets/admin.js) |
| L13 | **Content** | Resume PDF is dummy placeholder text, not a real CV | [Abantika_Resume.pdf](file:///d:/Abantika_Proj/Personal%20Website/src/assets/Abantika_Resume.pdf) |
| L14 | **Content** | KaTeX scripts placed after inline script that calls `renderMathInElement` — race condition (mitigated by server-side pre-rendering) | [base.njk](file:///d:/Abantika_Proj/Personal%20Website/src/_includes/layouts/base.njk) |

---

## Summary by Count

| Severity | Count |
|:---------|------:|
| 🔴 Critical | 6 |
| 🟠 High | 9 |
| 🟡 Medium | 23 |
| 🟢 Low | 14 |
| **Total** | **52** |
