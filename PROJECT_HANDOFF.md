# Abantika Portfolio — Project Handoff and Continuation Guide

**Updated:** 17 September 2026  
**Current implementation state:** Phase 2 public-site foundation complete  
**Build command:** `npm.cmd run build`  
**Development command:** `npm.cmd run start`

This document records the work completed in this workspace, what has deliberately not been implemented, verified build status, known issues, and the recommended next steps. It exists so the project can be resumed without rediscovering its architecture or accidentally expanding scope.

---

## 1. Project purpose

This is Abantika’s personal Data Analyst / Data Scientist portfolio. The final product is intended to be a static-first editorial publication built with Eleventy and deployed through GitHub Pages.

The visual direction is intentionally not a generic portfolio template. The approved grammar is:

- Bauhaus / Swiss editorial composition
- Off-white background with black typography and restrained red accents
- Large display typography contrasted with small monospaced metadata
- Technical rules, numbering, open grids, and engineered/artifact-like illustrations
- Data visualizations as analytical objects rather than decoration
- Minimal public JavaScript

The full product brief remains in `ABANTIKA_CODEX_PROJECT_SPEC.md`. The condensed engineering rules are in `PROJECT_SPEC.md` and `AGENTS.md`.

---

## 2. Current technology and repository layout

### Stack

- **Static-site generator:** Eleventy 2.x
- **Template format:** Nunjucks (`.njk`)
- **Styling:** a single vanilla CSS design-system stylesheet
- **Public JavaScript:** none at this stage
- **Content system:** not yet implemented; current public copy is template content and clearly marked placeholders where appropriate
- **Build output:** `_site/` (generated; do not hand-edit)

### Important commands

PowerShell can block `npm.ps1` on this machine. Use the `.cmd` executable:

```powershell
npm.cmd run start
npm.cmd run build
```

### Directory map

```text
Personal Website/
├── .eleventy.js                         # Eleventy configuration
├── package.json                         # Build/start scripts and Eleventy dependency
├── package-lock.json                    # Installed dependency lockfile
├── ABANTIKA_CODEX_PROJECT_SPEC.md       # Full authoritative brief
├── PROJECT_SPEC.md                      # Concise implementation direction
├── AGENTS.md                            # Guardrails for future work
├── PROJECT_HANDOFF.md                   # This document
├── src/
│   ├── _data/site.json                  # Site name and placeholder canonical base URL
│   ├── _includes/
│   │   ├── components/header.njk        # Shared public header/navigation
│   │   ├── components/footer.njk        # Shared footer
│   │   └── layouts/base.njk             # HTML head, metadata, stylesheet inclusion
│   ├── assets/styles.css                # Global design system and all current public styles
│   ├── index.njk                        # Homepage
│   ├── about/index.njk                  # About page
│   ├── projects/index.njk               # Projects listing
│   ├── projects/*/index.njk             # Three static case-study placeholders
│   ├── journal/index.njk                # Phase 2 journal shell only
│   ├── skills/index.njk                 # Skills page
│   └── contact/index.njk                # Contact page
└── _site/                               # Generated static site output
```

---

## 3. Completed work

### 3.1 Project setup

- Eleventy has been configured in `.eleventy.js`.
- `npm.cmd install` was completed and `node_modules/` exists locally.
- The Eleventy input is `src/` and generated output is `_site/`.
- `src/assets/` is copied to `_site/assets/` at build time.
- `.gitignore` excludes `node_modules/` and `_site/`.
- The repository is not currently a Git repository in this workspace; `git status` returns “not a git repository.” GitHub Pages and Actions work cannot be configured until the project is placed in a Git repository.

### 3.2 Design system

Implemented in `src/assets/styles.css`:

- Primary palette tokens:
  - paper: `#f2f0ea`
  - ink: `#111111`
  - muted grey
  - red accent: `#ef321f`
- Inter as the primary grotesk typeface and DM Mono for technical labels.
- Responsive `clamp()` display type sizes.
- Editorial rules, small metadata labels, numbered sections, geometric CSS artifacts, project plates, and technical-chart motifs.
- Responsive desktop, tablet, and narrow mobile layout rules.
- `prefers-reduced-motion` handling for the existing lightweight transition.
- Accessible default contrast for the off-white public surface and black type.

### 3.3 Header and footer

- Shared header component created: `src/_includes/components/header.njk`.
- Shared footer component created: `src/_includes/components/footer.njk`.
- Header navigation links to Home, About, Projects, Journal, Skills, and Contact.
- The header has an explicit off-white background and explicit black text to prevent black navigation on a black outer document background.
- Navigation text is bold and changes to red on hover/focus.
- Footer has an explicit off-white background, avoiding the same inherited-background contrast problem.

### 3.4 Homepage

The homepage is implemented in `src/index.njk` and includes:

- Editorial hero with “Clear insights. Real impact.”
- CSS-built technical artifact instead of a generic photo/card hero.
- About preview with a placeholder portrait artifact and principles.
- Three selected project panels.
- Journal/field-notes preview.
- Skills/tool groups.
- Contact section and footer.

This is intentionally static. The homepage has no content collection wiring yet.

### 3.5 Phase 2 public pages

The following routes are generated and verified:

| Route | Current purpose |
|---|---|
| `/` | Editorial homepage |
| `/about/` | About narrative and principles with placeholder biography |
| `/projects/` | Project index with three technical/editorial list rows |
| `/projects/customer-churn-prediction/` | Static placeholder case study |
| `/projects/sales-performance-analysis/` | Static placeholder case study |
| `/projects/ab-testing-analysis/` | Static placeholder case study |
| `/journal/` | Placeholder journal landing page; no entries yet |
| `/skills/` | Skills grouped by supplied initial categories |
| `/contact/` | Minimal contact call-to-action with placeholder contact destinations |

The three case-study pages use a shared visual pattern but are currently separate static templates. They include placeholder sections such as Problem, Data, Methodology/Analysis, and Results. No outcomes or metrics were fabricated; result areas explicitly use `METRIC TBD`.

### 3.6 Metadata currently present

The base layout currently provides:

- document title
- viewport tag
- general meta description
- canonical tag using the placeholder URL in `src/_data/site.json`
- basic Open Graph title, description, and type
- Twitter summary card type

This is foundation-level metadata only. Page-specific SEO and real canonical URLs are still pending.

---

## 4. Verification already completed

The following command succeeds:

```powershell
npm.cmd run build
```

Latest verified result:

- Eleventy writes nine public HTML pages.
- The stylesheet is copied to `_site/assets/styles.css`.
- All expected output HTML files exist.
- Internal links checked at the time of verification resolved to generated static targets.

Expected generated files include:

```text
_site/index.html
_site/about/index.html
_site/projects/index.html
_site/projects/customer-churn-prediction/index.html
_site/projects/sales-performance-analysis/index.html
_site/projects/ab-testing-analysis/index.html
_site/journal/index.html
_site/skills/index.html
_site/contact/index.html
_site/assets/styles.css
```

No automated accessibility, Lighthouse, browser screenshot, or HTML validation suite has been added yet.

---

## 5. Known issue: external preview grid / parallel lines

### Symptom

The supplied files in `-checks/` show a Projects page with parallel horizontal lines spanning the whole viewport, including empty areas and content. The screenshot also shows decorative red dot patterns and header graphics not produced by the templates currently in `src/`.

### Findings

- A repository-wide search excluding generated dependencies found no page-wide `repeating-linear-gradient`, baseline-grid, or overlay declaration in the authored source.
- The only existing `repeating-linear-gradient` declarations are scoped to chart/artifact elements:
  - `.line-chart:before`
  - `.journal-plot`
  These cannot produce lines across the page background.
- The screenshots differ materially from the current source design: for example, the large red header circle and upper-right red dot array shown in screenshots are not in the templates or authored styles.
- This strongly suggests the screenshot was taken from a different/cached build, a browser extension, an injected preview/checks style, or an external visual overlay.

### Defensive source correction already applied

The public document, page shell, inner-page surface, and Projects page now explicitly use the paper background and `background-image: none !important`. This prevents an inherited background image from the authored stylesheet from appearing on those elements.

### If the issue remains in a browser preview

1. Stop the development server.
2. Start it again with `npm.cmd run start`.
3. Open the URL printed by Eleventy (normally `http://localhost:8080/projects/`).
4. Perform a hard refresh using `Ctrl+F5`.
5. Disable browser extensions that add layout/baseline/design grids.
6. Inspect the live page in browser DevTools:
   - select `html`, `body`, and `.projects-page`
   - check `background-image`
   - inspect `html::before`, `html::after`, `body::before`, and `body::after`
   - check whether a third-party stylesheet or injected DOM node is creating the lines

Do not reintroduce a global repeating background grid. Editorial section rules should be deliberate and local to their blocks.

---

## 6. Not implemented yet

The following are intentionally outstanding and must not be represented as complete.

### Phase 3 — Content engine

- Markdown content folders:
  - `content/projects/`
  - `content/blog/`
  - `content/journal/`
  - `content/about.md`
  - `content/skills.yml`
  - `content/settings.yml`
- Front matter parsing, validation, and Eleventy collections.
- Generic project, article, and journal templates driven by content instead of duplicate page files.
- Draft/public filtering.
- Rich Markdown rendering with safe sanitization.
- Relationships between journal entries/blog articles and projects.
- Real image asset folders and optimized WebP/AVIF asset pipeline.

### Phase 4 — Blog and journal

- `/blog/` index and `/blog/:slug/` article routes.
- Markdown-generated blog articles.
- Dated journal entry routes such as `/journal/YYYY/MM/DD/`.
- Journal entry structure: What I Did, What I Learned, Next, optional Data/Method/Result metadata.
- Related project/article links.
- ShareThis integration on project, blog, and journal detail pages.

### Phase 5 — Private admin

- `/admin/` UI.
- GitHub-based sign-in through a real serverless backend.
- Allowlist for the authorized GitHub identity.
- Project/blog/journal editors.
- Fast journal composer.
- Draft/published controls.
- Safe content preview.
- Media management UI.

### Phase 6 — Git-backed publishing and deployment

- Server-side GitHub OAuth or GitHub App authentication architecture.
- Secrets stored only in server-side/serverless environment variables.
- Serverless publishing endpoint that validates all requests.
- Explicit GitHub commits for publish actions.
- GitHub Actions workflow to build and deploy to GitHub Pages.
- GitHub Pages setup and final `site.url` value.
- Sitemap and `robots.txt` generation.

### Phase 7 — polish and production readiness

- Replace all placeholder copy, links, portrait, email address, and social URLs with supplied real data.
- Add real project descriptions, datasets, methods, results, and visuals.
- Page-specific title, description, canonical URL, Open Graph URL/image, and Twitter metadata.
- Open Graph images.
- Keyboard-focused mobile navigation (current mobile navigation hides the desktop list but does not yet provide a menu control).
- Complete semantic/accessibility audit, skip link, and alt-text strategy for real images.
- Image compression and performance pass.
- Browser/device testing.
- Custom 404 page.
- Deployment verification on the actual GitHub Pages domain.

---

## 7. Important content and security constraints

### Do not fabricate content

Until source material is supplied, do not add invented:

- education, work history, clients, titles, or certificates
- metrics, model scores, accuracy, business impact, or research findings
- project results or claims of deployment
- contact details or social profile URLs

Use clearly visible placeholders such as `[PLACEHOLDER — ...]` and `METRIC TBD`.

### Do not introduce prohibited architecture

Do not use:

- Supabase
- Firebase
- a traditional database
- WordPress or paid CMS products
- LinkedIn API/OAuth/automatic posting
- client-side usernames/passwords as fake authentication
- GitHub tokens, OAuth client secrets, private keys, or any privileged credential in frontend source

The future admin must use server-side authentication and restricted GitHub operations. GitHub remains the content source of truth.

---

## 8. Recommended next implementation step

The next appropriate step is **Phase 3: content engine**, not admin/authentication.

Recommended order:

1. Create the `content/` structure and representative Markdown/YAML files using only placeholders.
2. Add Eleventy collections and validation for project, blog, journal, about, skills, and settings content.
3. Replace the three duplicate static project templates with one content-driven project template.
4. Update homepage/project index to query collections and display only `published: true` items.
5. Add project-page Markdown section rendering and safe content processing.
6. Re-run `npm.cmd run build` after each meaningful portion.
7. Only after public content rendering is approved, proceed to blog/journal detail routes and then the secure admin architecture.

---

## 9. Resume checklist

Before making the next change:

- [ ] Read `ABANTIKA_CODEX_PROJECT_SPEC.md`.
- [ ] Read `PROJECT_SPEC.md` and `AGENTS.md`.
- [ ] Run `npm.cmd run build` before changing source to establish a baseline.
- [ ] Confirm whether the browser preview is serving this workspace’s `_site/` build.
- [ ] Preserve the off-white/black/red editorial design grammar.
- [ ] Keep content truthful and explicitly placeholder-based until real source content is supplied.
- [ ] Do not modify generated `_site/` files directly; edit `src/` and rebuild.
- [ ] Run `npm.cmd run build` after the change.
- [ ] Test every new route and all links to it.

