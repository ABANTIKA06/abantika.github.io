# Abantika Portfolio — Project Handoff v2

**Date:** 17 September 2026  
**Supersedes:** `PROJECT_HANDOFF.md` (Phase 2 snapshot)  
**Current implementation state:** Phases 1–5 complete locally. Phase 6 (GitHub commit publishing and GitHub Pages deploy) and Phase 7 (production polish) are not done.  
**Authoritative brief:** `ABANTIKA_CODEX_PROJECT_SPEC.md`  
**Guardrails:** `AGENTS.md`, `PROJECT_SPEC.md`

This document is the continuation guide for the current workspace. Read it before changing architecture, adding auth, or claiming that GitHub publishing works.

---

## 1. What this project is

Abantika’s personal Data Analyst / Data Scientist portfolio.

The intended product is a **static-first editorial publication**: Eleventy generates HTML from Markdown/YAML, GitHub remains the content source of truth, and GitHub Pages is the eventual public host. The visual language is Bauhaus / Swiss editorial — off-white paper, black type, hairline rules, numbered sections, and restrained red/orange accents. It must not look like a generic card grid or a SaaS dashboard.

Public copy must stay truthful. Until real source material is supplied, use visible placeholders such as `[PLACEHOLDER — …]` and `METRIC TBD`. Do not invent credentials, clients, metrics, or outcomes.

---

## 2. How to run it (read this first)

PowerShell can block `npm.ps1` on this machine. Always use `npm.cmd`.

```powershell
npm.cmd install
npm.cmd run start
```

Then open:

| What | URL |
|---|---|
| **Main website** | http://localhost:8080/ |
| About | http://localhost:8080/about/ |
| Projects | http://localhost:8080/projects/ |
| Journal | http://localhost:8080/journal/ |
| Blog | http://localhost:8080/blog/ |
| Skills | http://localhost:8080/skills/ |
| Contact | http://localhost:8080/contact/ |
| **Admin** | http://localhost:8080/admin/ |

`npm.cmd run start` and `npm.cmd run admin` are the **same command**. They start one Node server that:

1. Rebuilds the static site into `_site/`
2. Serves the public website from `_site/`
3. Serves `/admin/` and `/api/`

Do **not** run the old Eleventy-only preview (`npx @11ty/eleventy --serve`) on 8080 at the same time. That process does not rebuild from admin saves, which is why journal/blog edits appeared “missing” on 8080.

If start fails with `EADDRINUSE`, stop the other Node/Eleventy process using port 8080, then run `npm.cmd run start` again.

Static-only build (no admin, no server):

```powershell
npm.cmd run build
```

Output is `_site/`. Do not hand-edit `_site/`.

---

## 3. Phase status

| Phase | Status | What it covers |
|---|---|---|
| 1 Design system | Done | Tokens, type, homepage, CSS artifacts, reduced motion |
| 2 Public pages | Done | About, projects index, case studies, journal/skills/contact shells |
| 3 Content engine | Done | `content/` Markdown/YAML, collections, validation, sanitization |
| 4 Blog + journal | Done | `/blog/`, `/blog/:slug/`, `/journal/YYYY/MM/DD/`, related links, ShareThis |
| 5 Admin | Done locally | `/admin/`, GitHub allowlist auth, editors, preview, commit popup, local rebuild |
| 6 GitHub publishing | **Not done** | OAuth `repo` scope, GitHub API commits, Actions, Pages, sitemap |
| 7 Production polish | **Not done** | Real copy, OG images, mobile nav control, 404, a11y audit, live domain |

---

## 4. Architecture

```text
Browser
  ├── http://localhost:8080/          public HTML from _site/
  └── http://localhost:8080/admin/    admin UI (no secrets in the page)

Admin UI
  └── fetch /api/*  (cookie session, SameSite=Lax, HttpOnly)

server/admin-api.js
  ├── GET public files from _site/     Cache-Control: no-store
  └── /api/*  (server/api.js)
        ├── GitHub OAuth or localhost allowlist session
        ├── read/write content/ and src/assets/images/
        └── rebuild() → Eleventy writes _site/
```

There is **no database**, no Supabase, no Firebase, no client-side password form, and no LinkedIn API.

GitHub Pages cannot run this admin API. Production admin needs a small serverless host (Phase 6). The public site remains static HTML.

---

## 5. Repository layout

```text
Personal Website/
├── ABANTIKA_CODEX_PROJECT_SPEC.md   Full product brief
├── AGENTS.md                        Implementation guardrails
├── PROJECT_SPEC.md                  Short visual/architecture notes
├── PROJECT_HANDOFF.md               Phase 2 snapshot (historical)
├── PROJECT_HANDOFF_V2.md            This document
├── package.json                     build / start / admin
├── .eleventy.js                     Eleventy config, filters, watch targets
├── .env.example                     Server env template (no secrets)
├── .env                             Local env (gitignored)
├── .gitignore                       node_modules/, _site/, .env
├── content/                         Source of truth for public copy
│   ├── about.md
│   ├── settings.yml
│   ├── skills.yml
│   ├── projects/*.md
│   ├── blog/*.md
│   └── journal/*.md
├── server/                          Admin API and local website server
│   ├── admin-api.js                 HTTP server on port 8080
│   ├── api.js                       Auth + content routes
│   ├── env.js                       Loads .env
│   ├── session.js                   HMAC cookie sessions
│   ├── store.js                     Read/write Markdown and YAML
│   └── rebuild.js                   Stamp + in-process Eleventy write
├── src/                             Eleventy input
│   ├── lib/content.js               Parse, validate, sanitize Markdown
│   ├── _data/                       Collections from content/
│   ├── _includes/                   Header, footer, share, layouts
│   ├── assets/styles.css            Public design system
│   ├── assets/admin.js / admin.css  Admin console
│   ├── admin/index.njk              /admin/
│   └── …pages
└── _site/                           Generated output (do not edit)
```

---

## 6. Public site

### 6.1 Design system

Defined in `src/assets/styles.css`:

- Paper `#f2f0ea`, ink `#111`, line `#c8c6bf`, red `#ef321f`, orange `#f05a1a`
- Inter for display/body, DM Mono for metadata and nav
- Numbered header: 01 Home … 07 Contact
- Nav labels are 14px; hover/focus draws an orange underline from the left
- `prefers-reduced-motion` disables those transitions
- Below 800px the desktop nav list is hidden (no hamburger yet — Phase 7)

### 6.2 Routes generated today

| Route | Source |
|---|---|
| `/` | `src/index.njk` + collections |
| `/about/` | `content/about.md` |
| `/projects/` | published projects |
| `/projects/:slug/` | `src/projects/pages.njk` |
| `/journal/` | published journal entries |
| `/journal/YYYY/MM/DD/` | one published note per date |
| `/blog/` | published articles |
| `/blog/:slug/` | `src/blog/pages.njk` |
| `/skills/` | `content/skills.yml` |
| `/contact/` | `content/settings.yml` |
| `/admin/` | admin shell |
| `/robots.txt` | disallows `/admin/` |
| `/assets/styles.css` | passthrough |

Only items with `published: true` get public detail pages.

### 6.3 Homepage field mapping

A previous bug: About **intro** saved from admin did not appear on the homepage, which read **homeSummary**.

Current behaviour:

- Homepage bio uses `homeSummary`, but if that value is empty or still a `[PLACEHOLDER…]`, it falls back to **intro** (`publicText` filter).
- Saving About also copies intro into homeSummary when homeSummary is still a placeholder.
- Project cards similarly prefer a real **summary**, otherwise **description**.

### 6.4 Related content and sharing

- Blog `relatedProject` → project case study
- Journal `project` → project case study
- Project page lists related articles and notes
- Share rail (`in` / `X` / `↗`) on project, article, and journal **detail** pages only
- ShareThis script loads asynchronously on those pages; the default sticky bar is hidden in CSS
- Provided property id is in `src/_includes/layouts/base.njk`

### 6.5 Content validation (`src/lib/content.js`)

Required fields:

- Project: title, slug, description, date, category, technologies, published  
- Blog: title, slug, description, date, published  
- Journal: date, title, published  

Rules:

- `published` must be a boolean
- Project/blog slug must match the filename
- Journal dates must be unique (one public note per day)
- Markdown is rendered with `html: false`
- `javascript:` / `data:` links are stripped
- Images must start with `/assets/`
- External http(s) links get `rel="noopener noreferrer"` and `target="_blank"`

Invalid content **fails the Eleventy build**.

---

## 7. Content files currently in the repo

Treat these as working content, not finished biography.

| File | Notes |
|---|---|
| `content/settings.yml` | Name, role, placeholder email `hello@example.com`, empty LinkedIn/GitHub |
| `content/about.md` | Includes an edited intro (“Analyzing data for Insights”) from admin testing |
| `content/skills.yml` | Five groups from the original brief |
| `content/projects/customer-churn-prediction.md` | Featured, published, art: dots |
| `content/projects/sales-performance-analysis.md` | Featured, published, art: architecture |
| `content/projects/ab-testing-analysis.md` | Featured, published, art: chart |
| `content/blog/why-accuracy-wasnt-enough.md` | Published placeholder essay; related to churn project |
| `content/journal/2026-09-01-analytical-work-in-progress.md` | Published; related to churn |
| `content/journal/2026-09-17-what-are-we-planning-with-finance.md` | Published from admin; rebuild on 8080 via `npm.cmd run start` to generate `/journal/2026/09/17/` |

Do not “improve” these with invented finance plans, model scores, or employment history.

---

## 8. Admin (Phase 5)

### 8.1 UI

`/admin/` is a hash-routed console (`src/assets/admin.js` + `admin.css`) in the same visual system, not a blue dashboard.

| Hash | Purpose |
|---|---|
| `#/` | Counts: projects / blog / journal |
| `#/about` | About copy |
| `#/projects` `#/projects/new` `#/projects/:slug` | Case studies |
| `#/blog` `#/blog/new` `#/blog/:slug` | Articles |
| `#/journal` `#/journal/new` `#/journal/:id` | Field notes; date defaults to today |
| `#/media` | List / upload / copy path / remove |
| `#/settings` | Site settings + skills groups |

Actions:

- **Preview** uses public CSS/layout in an overlay (does not write files)
- **Save / Publish / Upload / Remove** opens a **COMMIT** popup first
- Cancel leaves files untouched
- Confirm writes Markdown/YAML (or images) and rebuilds `_site/`
- **View site :8080** opens the public site on the same origin

Journal primary action is **Save journal entry**. Publish is optional. Drafts stay off the public site.

### 8.2 Authentication

No username/password form. No secrets in frontend source.

| Mode | When | How |
|---|---|---|
| GitHub OAuth | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ALLOWED_GITHUB_USER`, `SESSION_SECRET` set | `/api/auth/github` → callback → allowlist check → HttpOnly cookie. Scope is `read:user` only. |
| Localhost continue | `ADMIN_DEV_LOGIN` equals `ALLOWED_GITHUB_USER`, request host is localhost, `SESSION_SECRET` set | `POST /api/auth/dev` |

Every mutating `/api/*` route requires that session. Unauthenticated `POST /api/projects` returns **401**.

Copy `.env.example` to `.env` (gitignored). Never commit `.env`.

OAuth callback for local use:

```text
http://localhost:8080/api/auth/callback
```

### 8.3 API (same origin)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | No auth |
| GET | `/api/auth/config` | Whether GitHub/dev login is available |
| GET | `/api/auth/github` | OAuth redirect |
| GET | `/api/auth/callback` | OAuth return |
| POST | `/api/auth/dev` | Localhost allowlist session |
| POST | `/api/auth/logout` | Clears cookie |
| GET | `/api/session` | `{ login }` or `{ login: null }` |
| GET | `/api/overview` | Counts |
| GET | `/api/content` | All editable records + media |
| POST/PUT | `/api/projects`, `/api/blog`, `/api/journal` | Then rebuild |
| PUT | `/api/about`, `/api/skills`, `/api/settings` | Then rebuild |
| GET/POST/DELETE | `/api/media` | Images under `src/assets/images/{projects,blog,journal,about}/`, 2.5MB cap |

### 8.4 Rebuild after save

`server/rebuild.js`:

1. Writes `src/_data/stamp.json` (forces collection data files to reload)
2. Runs Eleventy in-process (`src` → `_site`)
3. Only then returns success to the admin UI

The 8080 server reads `_site` from disk with `Cache-Control: no-store`. After commit, refresh **http://localhost:8080/** (or View site). Do not expect an old `eleventy --serve` tab to update.

Windows note: joining a URL like `/blog/` onto `_site` with `path.join` treated `/blog/...` as an absolute path and 404’d public pages on the admin origin. `safeSiteFile` now joins path segments. That bug is why 8787 looked empty and people used 8080 Eleventy instead.

---

## 9. Design and content rules for the next agent

1. Keep the editorial Bauhaus system. Red/orange only as accents.
2. Public site stays Eleventy + Markdown. Do not add React/Next unless there is a concrete need.
3. Never invent biography, metrics, clients, or job titles.
4. Keep public JS minimal. Admin may use more JS. Secrets stay server-side.
5. Do not implement GitHub commit publishing with tokens in the browser.
6. Do not use Supabase, Firebase, a traditional database, WordPress, or LinkedIn OAuth/API.
7. Mobile nav still has no menu control; do not pretend it is done.
8. Build and inspect `_site/` (and the 8080 server) after each meaningful change.

---

## 10. Known issues and traps

1. **Wrong process on 8080.** If `npx @11ty/eleventy --serve` is still bound to 8080, admin saves will not show. Stop it. Use `npm.cmd run start`.
2. **Draft vs publish.** Save draft does not create a public URL.
3. **Journal one-per-day.** A second published note on the same date fails validation.
4. **New journal dates need a rebuild.** Example: `content/journal/2026-09-17-what-are-we-planning-with-finance.md` exists; `/journal/2026/09/17/` appears only after the 8080 start/rebuild pipeline runs.
5. **Placeholder email and empty social URLs** are still in settings.
6. **ShareThis** is a third-party script on detail pages only.
7. **No Git repository** was required for local Phase 5. GitHub Pages/Actions cannot be configured until the project is a Git repo with a remote.
8. **Admin HTML is in the static output.** That is acceptable: publishing still requires a server session. `/robots.txt` disallows `/admin/`. Pages send `noindex` on the admin layout.
9. **GitHub commit publishing is not implemented.** Saves write the local `content/` tree only.

---

## 11. Not implemented (do not mark complete)

### Phase 6 — Git-backed publishing and deployment

- GitHub OAuth/App with least-privilege **repo contents** write
- Serverless host for `/api` in production (Pages cannot run it)
- `POST` publish → GitHub API → commit messages such as `journal: add 2026-09-09 entry`
- GitHub Actions: install, `npm run build`, deploy `_site` to Pages
- Real `site.url` in settings
- `sitemap.xml` (robots.txt already exists)

### Phase 7 — polish

- Replace all placeholders with supplied real data
- Real project results and images (WebP/AVIF pipeline)
- Page-specific OG images
- Keyboard-accessible mobile navigation control
- Skip link, full a11y pass, custom 404
- Verify on the real GitHub Pages domain

---

## 12. Recommended next step: Phase 6

Order:

1. Put this folder in a GitHub repository. Do not commit `.env` or `_site/`.
2. Create a GitHub OAuth App (or GitHub App) with callback on the **serverless** origin, not GitHub Pages.
3. Store `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ALLOWED_GITHUB_USER`, `SESSION_SECRET` only in serverless env vars.
4. Extend the existing `/api` handlers so publish creates a Git commit to `content/` (and images) instead of only writing the local disk. Keep local disk writes for development.
5. Add `.github/workflows/deploy.yml`: on push to `main`, build Eleventy, upload `_site` to GitHub Pages.
6. Point `content/settings.yml` `url` at the real Pages domain.
7. Confirm drafts never appear on the live domain.
8. Only then do Phase 7 polish.

---

## 13. Resume checklist

- [ ] Read `ABANTIKA_CODEX_PROJECT_SPEC.md` and this file
- [ ] Read `AGENTS.md`
- [ ] Stop any leftover process on port 8080
- [ ] `npm.cmd run start`
- [ ] Confirm http://localhost:8080/blog/ and http://localhost:8080/journal/
- [ ] Confirm http://localhost:8080/admin/ shows the commit popup before saves
- [ ] Confirm View site opens 8080, not 8787
- [ ] Do not fabricate content
- [ ] Do not put GitHub tokens in `src/assets/admin.js`
- [ ] After code changes, `npm.cmd run build` and inspect `_site/`

---

## 14. Commands cheat sheet

```powershell
npm.cmd install
npm.cmd run build          # write _site only
npm.cmd run start          # website + admin on :8080
npm.cmd run admin          # same as start
```

Local env (gitignored): `.env`  
Template: `.env.example`
