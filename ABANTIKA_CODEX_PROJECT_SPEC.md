# ABANTIKA — DATA ANALYST / DATA SCIENTIST PORTFOLIO
## Master Codex Build Specification

> **Status:** Master specification  
> **Purpose:** Give Codex one authoritative document for building the portfolio website and its lightweight GitHub-backed publishing system.  
> **Primary principle:** The design system is editorial/Bauhaus/Swiss-modernist/technical. Do not turn this into a generic portfolio template.

---

# 1. PROJECT PURPOSE

Build a personal portfolio and publishing website for Abantika, a Data Analyst / Data Scientist.

The website must combine:

- Data science portfolio
- Detailed project case studies
- Technical blog
- "What I Did Today" work/research journal
- Skills and tools
- About page
- Contact page
- Lightweight private content-management interface
- GitHub-based authentication
- Git-backed content publishing
- Visitor social sharing through ShareThis

The public website must be hosted on GitHub Pages.

The repository must remain the source of truth for website content.

## Explicitly DO NOT use

- Supabase
- Firebase
- traditional database
- WordPress
- paid CMS
- LinkedIn API
- LinkedIn OAuth
- automatic LinkedIn publishing
- fake client-side authentication

The system should remain:

- static-first
- lightweight
- inexpensive
- portable
- Git-backed
- version-controlled
- maintainable

---

# 2. DESIGN DIRECTION

## 2.1 Core concept

The visual identity is:

    BAUHAUS EDITORIAL SYSTEM
    +
    SWISS / INTERNATIONAL TYPOGRAPHY
    +
    INDUSTRIAL / TECHNICAL DRAWING
    +
    DATA VISUALIZATION
    +
    SCIENTIFIC NOTEBOOK

The website should feel like a contemporary design publication documenting analytical work.

It should NOT feel like:

- generic portfolio
- SaaS landing page
- corporate consulting website
- dashboard
- Webflow template
- developer-template portfolio
- card-heavy startup website
- glassmorphism interface
- over-animated creative portfolio

The design should communicate analytical rigor through the visual system itself.

---

# 3. VISUAL REFERENCES

The supplied reference images are authoritative design references.

They establish:

- oversized typography
- large numerals
- small metadata
- strict grid
- asymmetrical composition
- technical diagrams
- dimension lines
- geometric forms
- black/off-white/red palette
- editorial whitespace
- restrained graphic accents
- object/artifact presentation
- publication-like layouts

The existing portfolio mockup is primarily a STRUCTURAL reference.

The Bauhaus, Swiss editorial, and technical-product references define the VISUAL GRAMMAR.

Do not simply copy the original portfolio screenshot.

Redesign the portfolio structure using the visual language of the supplied references.

---

# 4. DESIGN PRINCIPLES

## 4.1 Typography is the primary visual element

Use dramatic scale contrast.

Hierarchy:

- enormous display typography
- strong section titles
- medium project titles
- readable body copy
- tiny metadata
- monospace technical labels

Typography should create hierarchy before decorative elements do.

Example:

    03

    SELECTED
    WORK

    2026 / DATA / MACHINE LEARNING

Avoid generic headings such as:

    Featured Projects

inside standard UI cards.

---

## 4.2 Editorial grid

Use a consistent underlying grid.

Desktop target:

- max-width approximately 1440px
- 12-column editorial grid
- consistent page margins
- consistent vertical rhythm
- visible/implicit construction lines
- asymmetric layouts

Use:

- vertical rules
- horizontal rules
- section numbers
- aligned metadata
- offset content
- intentional whitespace

Do not force every section into symmetrical columns.

The grid should feel like a printed publication translated to the web.

---

## 4.3 Red is an accent, not a theme

Primary palette:

    OFF-WHITE  #F2F0EA
    BLACK      #111111
    GREY       #A9A7A0
    RED        #EF321F

Red should be used sparingly.

Appropriate uses:

- circle
- square
- rectangle
- selected state
- dot
- line
- important metadata
- small CTA
- data visualization highlight

Do NOT make every button red.

Red should feel like an intentional intervention in an otherwise monochrome system.

---

## 4.4 Geometric language

Use a restrained set of recurring elements:

- circle
- square
- rectangle
- line
- crosshair
- dot
- grid
- dimension line
- technical marker

Examples:

    ●
    +
    ─────────
    │
    ┌───────┐

These should create a coherent visual language, not decorative clutter.

---

## 4.5 Images are artifacts

Photography, diagrams, screenshots and charts should be treated as objects/artifacts.

Use:

- technical plates
- grayscale imagery
- architectural imagery
- analytical visualizations
- diagrams
- editorial crops

Avoid making every image a standard rounded card thumbnail.

Images may:

- break out of the text column
- overlap grid lines
- sit inside technical frames
- use a red geometric overlay
- have metadata attached

---

## 4.6 Motion

Motion must be restrained.

Allowed:

- subtle opacity transition
- underline expansion
- small image scale
- red accent appearance
- gentle section reveal

Avoid:

- bouncing
- cursor trails
- excessive parallax
- animated backgrounds
- large scroll effects
- glowing effects
- unnecessary transitions

Support:

    prefers-reduced-motion

---

# 5. TYPOGRAPHY

Use a modern grotesk/sans-serif for primary type.

Preferred:

- Inter
- Geist
- Helvetica Neue if available

Use a monospace font for metadata.

Preferred:

- IBM Plex Mono
- JetBrains Mono
- system monospace

Approximate desktop hierarchy:

    HERO DISPLAY       100–160px
    SECTION DISPLAY     60–100px
    PROJECT TITLE       40–72px
    BODY                16–20px
    METADATA            10–13px
    TECHNICAL LABEL     10–12px

Use CSS `clamp()` for responsive typography.

Do not hardcode typography independently in every component.

---

# 6. INFORMATION ARCHITECTURE

Primary navigation:

    01 HOME
    02 ABOUT
    03 PROJECTS
    04 JOURNAL
    05 BLOG
    06 SKILLS
    07 CONTACT

Primary routes:

    /
    /about/
    /projects/
    /projects/:slug/
    /journal/
    /journal/:date/
    /blog/
    /blog/:slug/
    /skills/
    /contact/

Private admin:

    /admin/

---

# 7. HOMEPAGE

The homepage is an editorial introduction, not a content dump.

Recommended flow:

    HEADER
    01 HERO
    02 ABOUT
    03 SELECTED WORK
    04 JOURNAL
    05 SKILLS
    06 CONTACT
    FOOTER

---

# 8. HEADER

Display:

    ABANTIKA
    DATA ANALYST · DATA SCIENTIST

Navigation uses numbered items.

Use:

    01 HOME
    02 ABOUT
    03 PROJECTS
    04 JOURNAL
    05 BLOG
    06 SKILLS
    07 CONTACT

Use a small geometric element on the far right if appropriate.

Header should have:

- thin rule
- generous whitespace
- small metadata
- clear active state
- red accent used minimally

---

# 9. HERO

Hero eyebrow:

    TURNING DATA INTO

Hero headline:

    CLEAR
    INSIGHTS.
    REAL
    IMPACT.

Supporting text:

    I'm a data analyst and data scientist who finds
    patterns, solves problems and builds data-driven
    solutions that make a difference.

Primary CTA:

    VIEW MY WORK →

Secondary CTA:

    GET IN TOUCH

All hero copy must be editable.

Hero should contain:

- oversized typography
- one major image/artifact
- geometric red intervention
- technical metadata
- grid lines
- asymmetry
- intentional whitespace

Do NOT center everything.

Do NOT place text over a generic hero photo.

---

# 10. ABOUT

Use an editorial composition.

Possible structure:

LEFT:
- section number
- portrait
- small vertical metadata

CENTER:
    A BLEND OF
    ANALYSIS,
    CREATIVITY
    AND CURIOSITY.

RIGHT:
- FIND PATTERNS
- SOLVE PROBLEMS
- CREATE IMPACT
- KEEP LEARNING

The portrait should feel like an editorial artifact rather than a standard profile card.

About content must be editable.

---

# 11. PROJECTS

Projects are the most important portfolio content.

Homepage should show selected projects.

Do NOT use generic rounded cards.

Each project should feel like a designed technical/editorial plate.

Project metadata:

    number
    title
    short description
    technologies
    category
    date/year
    cover image
    github URL
    live URL
    featured
    published

Example:

    01

    CUSTOMER
    CHURN
    PREDICTION

    PYTHON / XGBOOST / STATISTICS

    Predicting customer churn using
    behavioural and transactional data.

Project visuals should resemble technical documentation rather than ordinary thumbnails.

---

# 12. PROJECT CASE STUDIES

Every project may have a detailed case-study page.

Suggested structure:

    PROJECT NUMBER
    YEAR
    CATEGORY

    PROJECT TITLE

    SHORT SUMMARY

    HERO VISUAL

    01 / PROBLEM
    02 / DATA
    03 / EXPLORATION
    04 / METHODOLOGY
    05 / MODEL
    06 / RESULTS
    07 / INTERPRETATION
    08 / WHAT I LEARNED
    09 / NEXT STEPS

Support:

- rich text
- headings
- images
- captions
- charts
- tables
- code blocks
- blockquotes
- lists
- links
- metrics
- technical metadata

Charts and images are analytical artifacts.

Allow large images to break out of the text column.

---

# 13. BLOG

Blog is for long-form technical/editorial writing.

Routes:

    /blog/
    /blog/:slug/

Blog index should resemble an editorial contents page.

Example:

    2026

    09

    WHY ACCURACY
    WASN'T ENOUGH

    A practical investigation into
    model evaluation for churn prediction.

Metadata:

    DATA SCIENCE
    MACHINE LEARNING
    08 MIN READ

Article structure:

    TITLE
    SUBTITLE
    DATE
    CATEGORY
    READING TIME
    HERO IMAGE
    CONTENT
    RELATED PROJECT
    SHARE
    NEXT ARTICLE

Blog content is Markdown-first.

---

# 14. JOURNAL — "WHAT I DID TODAY"

Journal is a distinct content type from the blog.

It should feel like:

- research log
- field notebook
- work diary
- analytical notebook

Routes:

    /journal/
    /journal/YYYY/MM/DD/

Journal entry structure:

    DATE

    WHAT I DID

    WHAT I LEARNED

    NEXT

Optional:

    METRICS
    DATASET
    PROJECT
    TOOLS
    IMAGE
    REFERENCES

Example:

    09
    09
    26

    MODEL ITERATION / 04

    WHAT I DID

    Investigated why recall was falling
    despite stable accuracy.

    DATA

    48,021 observations

    METHOD

    XGBoost / threshold analysis

    RESULT

    Recall improved from 0.71 → 0.79

    NEXT

    Test calibration.

The journal must be extremely fast to create in the admin interface.

---

# 15. SOCIAL SHARING

Use ShareThis for visitor-facing social sharing.

Provided ShareThis script:

```html
<script
  type="text/javascript"
  src="https://platform-api.sharethis.com/js/sharethis.js#property=6aa112a085a899f47bb776d5&product=sticky-share-buttons"
  async="async">
</script>
```

Use ShareThis on:

- project case studies
- blog articles
- journal entries

The purpose is:

    visitor reads page
        ↓
    visitor clicks LinkedIn
        ↓
    LinkedIn sharing flow opens
        ↓
    visitor reviews/publishes manually

Do NOT implement:

- LinkedIn API
- LinkedIn OAuth
- automatic LinkedIn publishing

ShareThis is the entire LinkedIn sharing solution.

The ShareThis UI must be visually integrated with the portfolio.

Avoid large colorful social buttons.

Preferred visual treatment:

    SHARE

    in   X   ↗

or minimal vertical sticky controls.

---

# 16. SEO

Every public page must include:

- `<title>`
- meta description
- canonical URL
- Open Graph title
- Open Graph description
- Open Graph image
- Open Graph URL
- Twitter/X card metadata

Generate:

    sitemap.xml
    robots.txt

Project/blog/journal pages should have page-specific metadata.

Example:

    title:
    Customer Churn Prediction — Abantika

    description:
    Predicting customer churn using behavioural
    and transactional data.

---

# 17. CONTENT ARCHITECTURE

Recommended repository:

```text
/
├── src/
│   ├── pages/
│   ├── layouts/
│   ├── components/
│   ├── styles/
│   └── scripts/
│
├── content/
│   ├── projects/
│   ├── blog/
│   ├── journal/
│   ├── about.md
│   ├── skills.md
│   └── settings.json
│
├── assets/
│   ├── images/
│   ├── charts/
│   └── icons/
│
├── admin/
│   ├── index.html
│   ├── styles.css
│   └── app.js
│
├── public/
│
├── package.json
└── README.md
```

Preferred static site generator:

    Eleventy (11ty)

Do NOT introduce React/Next.js unless there is a concrete technical reason.

---

# 18. PROJECT FRONT MATTER

Example:

```yaml
---
title: "Customer Churn Prediction"
slug: "customer-churn-prediction"
number: "01"
date: "2026-09-09"
year: 2026
category: "Machine Learning"
description: "Predicting customer churn using behavioural and transactional data."
technologies:
  - Python
  - Pandas
  - Scikit-learn
  - XGBoost
featured: true
published: true
cover: "/assets/images/projects/customer-churn.webp"
github: "https://github.com/..."
live: ""
readingTime: 8
---
```

---

# 19. BLOG FRONT MATTER

Example:

```yaml
---
type: "blog"
title: "Why Accuracy Wasn't Enough"
slug: "why-accuracy-wasnt-enough"
date: "2026-09-09"
category: "Machine Learning"
tags:
  - Machine Learning
  - Model Evaluation
description: "Why accuracy alone failed to describe the performance of my churn model."
cover: "/assets/images/blog/accuracy.webp"
published: true
featured: false
relatedProject: "customer-churn-prediction"
---
```

---

# 20. JOURNAL FRONT MATTER

Example:

```yaml
---
type: "journal"
date: "2026-09-09"
title: "Model Iteration / 04"
project: "customer-churn-prediction"
published: true
---
```

Content:

```markdown
## What I did

...

## What I learned

...

## Next

...
```

---

# 21. ABOUT CONTENT

About should be content-driven rather than hardcoded into templates.

Store editable content in:

    content/about.md

Possible front matter:

```yaml
---
title: "A blend of analysis, creativity and curiosity."
portrait: "/assets/images/about/portrait.webp"
---
```

---

# 22. SKILLS

Store skills in structured content/configuration.

Groups:

    DATA ANALYSIS
    STATISTICS
    MACHINE LEARNING
    VISUALIZATION
    OTHER

Example:

```yaml
dataAnalysis:
  - Python
  - SQL
  - Pandas
  - NumPy
  - Excel

statistics:
  - Hypothesis Testing
  - Regression
  - Probability
  - A/B Testing
  - Time Series

machineLearning:
  - Scikit-learn
  - XGBoost
  - Classification
  - Regression
  - Clustering

visualization:
  - Power BI
  - Tableau
  - Matplotlib
  - Plotly
  - Seaborn

other:
  - Git / GitHub
  - APIs
  - ETL
  - Data Cleaning
  - Jupyter
```

Skills must be editable through admin.

---

# 23. CONTACT

Contact should remain minimal.

Primary statement:

    LET'S BUILD
    SOMETHING IMPACTFUL.

Include:

- email
- LinkedIn
- GitHub

An email CTA is sufficient for version 1.

Do not build a complicated contact form unless required.

---

# 24. JOURNAL ↔ PROJECT RELATIONSHIP

A journal entry may reference a project.

Example:

    project: customer-churn-prediction

The journal page can show:

    RELATED PROJECT
    CUSTOMER CHURN PREDICTION →

This creates a narrative:

    DAILY WORK
        ↓
    EXPERIMENTATION
        ↓
    PROJECT
        ↓
    CASE STUDY

---

# 25. BLOG ↔ PROJECT RELATIONSHIP

Blog articles may reference projects.

Example:

    relatedProject:
      customer-churn-prediction

Project pages may show:

    RELATED ARTICLE
    WHY ACCURACY WASN'T ENOUGH →

The site should feel interconnected rather than a collection of isolated pages.

---

# 26. URL STRATEGY

Use clean URLs.

Projects:

    /projects/customer-churn-prediction/

Blog:

    /blog/why-accuracy-wasnt-enough/

Journal:

    /journal/2026/09/09/

Avoid:

    ?id=123
    /post?id=123
    /page.html

---

# 27. DATE STRATEGY

Internal date:

    YYYY-MM-DD

Editorial display may use:

    09.09.26

or:

    09
    SEPTEMBER
    2026

depending on design context.

---

# 28. ADMIN SYSTEM

Admin route:

    /admin/

Admin must be private.

Unauthenticated visitors must not have access to publishing functionality.

Admin sections:

    01 HOME
    02 ABOUT
    03 PROJECTS
    04 BLOG
    05 JOURNAL
    06 MEDIA
    07 SETTINGS

The admin should use the same visual language as the public site but prioritize usability.

Do not make it look like a generic SaaS dashboard.

---

# 29. GITHUB AUTHENTICATION

Use GitHub-based authentication.

Preferred architecture:

```text
Browser
   ↓
/admin
   ↓
GitHub authentication
   ↓
lightweight serverless authentication layer
   ↓
authenticated admin session
```

Use a GitHub App or appropriately secured GitHub OAuth architecture.

Prefer least-privilege repository permissions.

Only the designated GitHub account may access publishing functionality.

Use an allowlist for the authorized GitHub identity.

Example concept:

    ALLOWED_GITHUB_USER = "..."

Do not rely on a secret admin URL.

Do not build a fake client-side username/password system.

Do not store passwords.

---

# 30. AUTHENTICATION SECURITY

The browser must NEVER contain:

- GitHub App private key
- GitHub client secret
- privileged GitHub token
- server-side secret
- any equivalent credential

Secrets must exist only in server-side/serverless environment variables.

---

# 31. GITHUB CONTENT PUBLISHING

GitHub is the source of truth.

Publishing flow:

```text
Admin
  ↓
Validate content
  ↓
Generate/update Markdown + metadata
  ↓
GitHub API
  ↓
Commit
  ↓
GitHub Actions
  ↓
Eleventy build
  ↓
GitHub Pages
```

Every publish action should create a Git commit.

Example commit messages:

    content: publish customer churn case study

    journal: add 2026-09-09 entry

    blog: publish accuracy article

    content: update about page

Publishing must be explicit.

Do not commit every keystroke.

---

# 32. DRAFTS

Content states:

    draft
    published

Draft content must not appear on the public site.

Admin must clearly display:

    DRAFT
    PUBLISHED

Never publish a draft accidentally.

---

# 33. ADMIN DASHBOARD

Suggested dashboard:

```text
ABANTIKA / ADMIN

──────────────────────────────────

01 HOME
02 ABOUT
03 PROJECTS
04 BLOG
05 JOURNAL
06 MEDIA
07 SETTINGS

──────────────────────────────────

PROJECTS
3 PUBLISHED
1 DRAFT

BLOG
7 PUBLISHED

JOURNAL
23 ENTRIES

LAST PUBLISHED
09.09.26
```

The dashboard should be sparse and editorial.

---

# 34. PROJECT EDITOR

Fields:

- Title
- Slug
- Number
- Date
- Year
- Category
- Description
- Technologies
- Cover image
- GitHub URL
- Live URL
- Featured
- Published

Case-study content:

- Problem
- Data
- Exploration
- Methodology
- Model
- Results
- Interpretation
- What I Learned
- Next Steps

Version 1 editor should use Markdown.

---

# 35. BLOG EDITOR

Fields:

- Title
- Slug
- Date
- Category
- Tags
- Description
- Cover
- Related project
- Published
- Content

Actions:

    SAVE DRAFT
    PREVIEW
    PUBLISH

---

# 36. JOURNAL EDITOR

Optimize this editor for speed.

Fields:

- Date
- Title
- What I Did
- What I Learned
- Next
- Project
- Tools
- Metrics
- Published

Date should default to today's date.

Primary action:

    SAVE JOURNAL ENTRY

Optional:

    PUBLISH

The complete operation should be possible in under one minute.

---

# 37. MEDIA MANAGER

Allow:

- upload image
- list images
- copy image path
- organize images
- safely remove unused images if supported

Directories:

    assets/images/projects/
    assets/images/blog/
    assets/images/journal/
    assets/images/about/

Prefer:

    WebP
    AVIF

Use PNG/JPEG only when necessary.

---

# 38. PREVIEW

Admin must support previewing content before publication.

Flow:

    EDIT
      ↓
    PREVIEW
      ↓
    ACTUAL PUBLIC LAYOUT
      ↓
    SAVE / PUBLISH

Preview should use the same templates and styling as production.

Do not create a separate fake preview design.

---

# 39. WYSIWYG EDITOR

Tiptap is a possible future WYSIWYG editor.

Tiptap is NOT required in Version 1.

Version 1 should use Markdown editing.

The content architecture must be designed so a WYSIWYG editor can later replace the Markdown textarea without restructuring the site.

Stored content must remain convertible to Markdown.

Do not tightly couple content storage to Tiptap.

---

# 40. STATIC SITE GENERATION

Use Eleventy to generate:

- homepage
- project pages
- project index
- blog index
- blog articles
- journal index
- journal entries
- about
- skills
- contact

Markdown collections should drive the pages.

Templates should render content.

Do not hardcode individual project/blog/journal content into HTML templates.

---

# 41. GITHUB ACTIONS

Use GitHub Actions to build and deploy.

Conceptual pipeline:

```text
push to main
    ↓
npm install
    ↓
npm run build
    ↓
Eleventy generates static site
    ↓
deploy to GitHub Pages
```

Build should fail on:

- invalid front matter
- missing required fields
- build errors
- detectable invalid configuration

---

# 42. CONTENT VALIDATION

Required project fields:

    title
    slug
    description
    date
    category
    technologies
    published

Required blog fields:

    title
    slug
    description
    date
    published

Required journal fields:

    date
    title
    published

Validate both:

- in admin before publishing
- during static build

---

# 43. CONTENT SANITIZATION

Markdown-generated HTML must be sanitized.

Do not permit arbitrary JavaScript inside Markdown.

External links should be handled safely.

Images should reference approved locations.

---

# 44. COMPONENT SYSTEM

Create reusable components where useful.

Suggested components:

    Header
    Navigation
    SectionLabel
    EditorialRule
    Hero
    ProjectFeature
    ProjectList
    ProjectMeta
    ArticleHeader
    ArticleBody
    JournalEntry
    SkillGroup
    ShareButtons
    Footer
    GeometricAccent
    ImagePlate
    MetricBlock
    DataArtifact

Do not create hundreds of tiny abstractions.

Prefer readable templates and meaningful reuse.

---

# 45. DATA VISUALIZATION PRINCIPLE

Data visualizations are first-class design objects.

Use:

- black
- grey
- red accent

Avoid:

- rainbow palettes
- chartjunk
- 3D charts
- unnecessary gradients
- excessive legends

Charts should feel like part of the publication.

---

# 46. RESPONSIVE DESIGN

Desktop design is the primary visual reference.

Mobile must be intentionally designed.

Do not simply scale the desktop version down.

Mobile should:

- preserve editorial hierarchy
- preserve numbering
- retain strong typography
- stack asymmetric layouts
- simplify grid complexity
- keep metadata readable
- prevent horizontal overflow
- keep ShareThis usable
- preserve visual rhythm

Use layout-driven breakpoints.

---

# 47. ACCESSIBILITY

Requirements:

- semantic HTML
- keyboard navigation
- visible focus states
- sufficient contrast
- alt text for meaningful images
- decorative images appropriately marked
- logical heading hierarchy
- accessible button names
- keyboard-accessible navigation
- reduced-motion support

Do not sacrifice accessibility for aesthetics.

---

# 48. PERFORMANCE

Keep the public website lightweight.

Prefer:

- static HTML
- CSS
- vanilla JavaScript
- Eleventy
- optimized images

Avoid unnecessary dependencies.

Public site should require as little JavaScript as possible.

ShareThis is an intentional third-party exception and should be loaded asynchronously.

---

# 49. SECURITY

Critical rules:

1. No secrets in GitHub Pages frontend.
2. No private GitHub tokens in browser JavaScript.
3. No LinkedIn credentials.
4. No database credentials.
5. Authentication must be validated server-side.
6. Serverless endpoints must validate requests.
7. Only authorized GitHub account may publish.
8. Sanitize Markdown/HTML.
9. Prevent arbitrary file writes.
10. Restrict GitHub operations to the intended repository.
11. Use least-privilege permissions.
12. Never expose server environment variables to client code.

---

# 50. IMAGE OPTIMIZATION

Optimize all uploaded images.

Preferred:

    WebP
    AVIF

Use meaningful filenames.

Example:

    customer-churn-confusion-matrix.webp

instead of:

    IMG_3847.png

---

# 51. HOMEPAGE VISUAL FLOW

Recommended conceptual layout:

```text
HEADER

01
HERO

large statement
+
image/artifact
+
red geometric element

────────────────────────

02
ABOUT

portrait
+
statement
+
principles

────────────────────────

03
SELECTED WORK

project 01
project 02
project 03

────────────────────────

04
JOURNAL

latest entry
+
archive

────────────────────────

05
SKILLS

analytical categories

────────────────────────

06
CONTACT

large closing statement

FOOTER
```

Exact composition can evolve during implementation, but the visual principles must remain.

---

# 52. HOMEPAGE CONTENT STRATEGY

The homepage should not display everything.

It should act as an editorial introduction.

Direct visitors toward:

    PROJECTS
    BLOG
    JOURNAL
    ABOUT

Do not dump all articles, projects and journal entries onto the homepage.

---

# 53. PROJECT VISUAL LANGUAGE

A project page should feel like:

    TECHNICAL REPORT
    +
    DESIGN PLATE
    +
    DATA STORY

Possible visual treatment:

```text
01 / PROJECT

CUSTOMER
CHURN
PREDICTION

PYTHON / XGBOOST / STATISTICS

────────────────────────

[ LARGE ANALYTICAL VISUAL ]

────────────────────────

01 / PROBLEM

...

02 / DATA

...

03 / METHOD

...

04 / RESULT

...
```

---

# 54. BLOG VISUAL LANGUAGE

A blog article should feel like a publication.

Example:

```text
2026
09

WHY ACCURACY
WASN'T ENOUGH

Why a high accuracy score
didn't mean my churn model
was actually useful.

ABANTIKA
DATA / MACHINE LEARNING

────────────────────

01 / CONTEXT

...

02 / EXPERIMENT

...

03 / RESULT

...

04 / WHAT CHANGED

...
```

Charts/images may break out of the main text column.

---

# 55. JOURNAL VISUAL LANGUAGE

Journal should feel more immediate and personal.

Example:

```text
06 / JOURNAL

WHAT I DID
TODAY

09
09
26

────────────────────────

MODEL ITERATION / 04

WHAT I DID

...

DATA

...

METHOD

...

RESULT

...

NEXT

...

────────────────────────

SHARE  →  in
```

---

# 56. ADMIN VISUAL LANGUAGE

Admin is practical but should still belong to the same design system.

Use:

- typography
- rules
- numbering
- off-white
- black
- grey
- red accent
- generous whitespace

Avoid:

- blue SaaS dashboards
- rounded dashboard cards
- excessive icons
- dense sidebars
- excessive UI decoration

---

# 57. VERSION 1 SCOPE

Version 1 MUST include:

- static homepage
- About
- Projects
- project detail pages
- Blog
- Journal
- Skills
- Contact
- responsive design
- SEO metadata
- ShareThis
- GitHub Pages deployment
- Markdown content
- GitHub authentication
- admin dashboard
- project editing
- blog editing
- journal editing
- draft/publish state
- GitHub commit publishing
- preview
- content validation
- GitHub Actions deployment

---

# 58. VERSION 1 MUST NOT INCLUDE

Do NOT implement:

- Supabase
- Firebase
- traditional database
- LinkedIn API
- LinkedIn OAuth
- automatic LinkedIn posting
- user registration
- visitor accounts
- comments
- complex analytics dashboard
- unnecessary frontend framework
- complex animation engine
- ecommerce
- paid CMS

---

# 59. FUTURE FEATURES

Possible future additions:

- Tiptap WYSIWYG
- image cropping
- drag-and-drop content ordering
- RSS
- newsletter
- advanced search
- tags
- related-content engine
- project filtering
- reading progress
- automatic Open Graph image generation
- lightweight analytics
- content scheduling
- GitHub issue integration
- project changelog
- downloadable CV
- interactive data visualizations

These must not complicate Version 1.

---

# 60. IMPLEMENTATION PHASES

## PHASE 1 — DESIGN SYSTEM

Build:

- typography
- colors
- spacing
- grid
- rules
- geometric language
- buttons
- metadata
- responsive foundation

Do not immediately build every page.

First establish the visual system.

---

## PHASE 2 — PUBLIC WEBSITE

Build:

- header
- homepage
- about
- projects
- project pages
- skills
- contact
- footer

---

## PHASE 3 — CONTENT ENGINE

Implement:

- Eleventy
- Markdown
- front matter
- collections
- project rendering
- blog rendering
- journal rendering

---

## PHASE 4 — BLOG + JOURNAL

Implement:

- blog index
- article pages
- journal index
- journal pages
- related content
- metadata
- ShareThis

---

## PHASE 5 — ADMIN

Implement:

- /admin
- GitHub authentication
- dashboard
- project editor
- blog editor
- journal editor
- draft/publish
- preview

---

## PHASE 6 — GITHUB PUBLISHING

Implement:

```text
Admin
  ↓
GitHub API
  ↓
commit
  ↓
GitHub Actions
  ↓
Eleventy
  ↓
GitHub Pages
```

---

## PHASE 7 — POLISH

Implement:

- accessibility
- SEO
- performance
- responsive refinements
- image optimization
- subtle motion
- error states
- authentication edge cases

---

# 61. ACCEPTANCE CRITERIA

The project is complete when:

1. Public website works through GitHub Pages.
2. Website follows the supplied Bauhaus/editorial references.
3. Homepage does not look like a generic portfolio template.
4. Projects have detailed case-study pages.
5. Blog supports Markdown articles.
6. Journal supports dated entries.
7. Journal entries can reference projects.
8. Blog articles can reference projects.
9. ShareThis works on projects/blog/journal.
10. Visitors can share pages to LinkedIn through ShareThis.
11. No LinkedIn API is used.
12. Admin is protected by GitHub authentication.
13. Unauthorized GitHub users cannot publish.
14. Admin can create/edit projects.
15. Admin can create/edit blog posts.
16. Admin can create/edit journal entries.
17. Drafts are not publicly visible.
18. Publishing creates a Git commit.
19. GitHub Actions rebuilds the site.
20. GitHub Pages deploys the result.
21. No database is required.
22. No secrets are exposed client-side.
23. Site works on mobile.
24. Site has proper SEO metadata.
25. Site supports keyboard navigation.
26. Site remains lightweight.
27. Visual identity remains consistent across public site and admin.

---

# 62. IMPLEMENTATION PHILOSOPHY

Do not over-engineer.

This is a personal portfolio, not a SaaS platform.

Prefer:

    simple
    static
    explicit
    maintainable
    Git-backed
    portable

over:

    abstraction
    framework complexity
    unnecessary APIs
    databases
    dependencies

When choosing between technically valid solutions, prefer the one with:

- fewer dependencies
- less infrastructure
- less JavaScript
- easier debugging
- easier migration
- easier GitHub deployment

---

# 63. AGENT BEHAVIOR RULES

Before coding:

1. Inspect the repository.
2. Inspect `package.json`.
3. Inspect existing source files.
4. Inspect GitHub Pages configuration.
5. Determine whether Eleventy is already configured.
6. Preserve useful existing work.
7. Do not overwrite working code unnecessarily.

Do not implement the whole project in one uncontrolled pass.

Work in phases.

After each phase:

- build
- test
- inspect
- fix
- continue

---

# 64. DO NOT DRIFT FROM THE DESIGN

The supplied visual references are not optional inspiration.

They establish the design grammar.

Maintain:

- editorial grid
- large type
- small metadata
- strong scale contrast
- black/off-white/red palette
- geometric accents
- technical lines
- asymmetry
- whitespace
- numbering
- artifact-style imagery

If a proposed UI element looks like a conventional SaaS component, reconsider it.

---

# 65. DO NOT OVERUSE CARDS

Cards should not become the default container.

Prefer:

- open layouts
- rules
- typography
- image plates
- columns
- editorial blocks
- asymmetrical compositions

Use borders only where they support the design.

---

# 66. DO NOT OVERUSE RED

Red is an accent.

If every CTA, link and selected state is red, the system has failed.

Use red deliberately.

---

# 67. DO NOT TURN DATA VISUALIZATION INTO DECORATION

Charts must communicate information.

Use the same visual language as the website:

    BLACK
    GREY
    RED ACCENT

Keep them analytical and legible.

---

# 68. PUBLIC SITE JAVASCRIPT

The public website should use minimal JavaScript.

JavaScript may be used for:

- navigation interactions
- ShareThis
- subtle progressive enhancement
- optional filtering
- accessible menu
- small visual interactions

Do not build the public website as a JavaScript-heavy application.

---

# 69. ADMIN JAVASCRIPT

Admin may use more JavaScript.

It can handle:

- authentication state
- editing
- validation
- preview
- GitHub publishing requests
- image uploads
- draft state

However, secrets must remain server-side.

---

# 70. AUTHENTICATION ARCHITECTURE DETAIL

Recommended:

```text
Public GitHub Pages
        |
        | /admin
        v
Admin frontend
        |
        | authentication request
        v
Small serverless backend
        |
        v
GitHub authentication
        |
        v
Authorized identity
        |
        v
Admin session
```

Publishing:

```text
Admin session
      ↓
serverless publishing endpoint
      ↓
GitHub API
      ↓
repository commit
```

Use short-lived/least-privilege credentials where possible.

Do not expose GitHub credentials to the browser.

---

# 71. GITHUB REPOSITORY STRUCTURE

Recommended final structure:

```text
abantika-portfolio/
│
├── src/
│   ├── _data/
│   ├── _includes/
│   │   ├── layouts/
│   │   └── components/
│   ├── pages/
│   ├── styles/
│   └── scripts/
│
├── content/
│   ├── projects/
│   ├── blog/
│   ├── journal/
│   ├── about.md
│   ├── skills.yml
│   └── settings.yml
│
├── assets/
│   ├── images/
│   │   ├── projects/
│   │   ├── blog/
│   │   ├── journal/
│   │   └── about/
│   ├── charts/
│   └── icons/
│
├── admin/
│   ├── index.html
│   ├── styles.css
│   └── app.js
│
├── public/
│
├── .github/
│   └── workflows/
│       └── deploy.yml
│
├── .gitignore
├── AGENTS.md
├── PROJECT_SPEC.md
├── package.json
└── README.md
```

Codex may adjust the exact Eleventy directory convention if required, but the content architecture must remain equivalent.

---

# 72. INITIAL CONTENT

Use placeholder content where real content has not yet been supplied.

Do not invent personal achievements, employment history, degrees, metrics, publications, clients, or claims.

Clearly label placeholders.

Example:

    [PLACEHOLDER — REPLACE WITH REAL PROJECT]

The visual system can be built with representative placeholder content.

---

# 73. EXISTING PROJECTS

Initial featured projects:

    01 CUSTOMER CHURN PREDICTION
    02 SALES PERFORMANCE ANALYSIS
    03 A/B TESTING ANALYSIS

These are initial placeholders/content directions and should be editable.

Do not fabricate technical results.

If metrics are not supplied, use placeholders such as:

    METRIC TBD

rather than inventing numbers.

---

# 74. CONTENT TONE

Public content should be:

- clear
- analytical
- concise
- thoughtful
- technically credible
- human

Avoid:

- corporate buzzword overload
- exaggerated claims
- generic motivational copy
- fabricated achievements
- fake metrics

---

# 75. FINAL PRODUCT CHARACTER

The finished website should feel like:

    A DATA SCIENTIST'S
    PERSONAL EDITORIAL PUBLICATION

It should communicate through design:

    analytical
    curious
    rigorous
    creative
    technical
    thoughtful
    modern

The visual result should feel closer to:

    ARCHITECTURAL DRAWING
    +
    DESIGN JOURNAL
    +
    DATA NOTEBOOK

than:

    PORTFOLIO TEMPLATE
    +
    DASHBOARD
    +
    BLOG

This principle takes priority over individual UI components.

---

# 76. FINAL ARCHITECTURE SUMMARY

```text
                         ABANTIKA
                    PERSONAL WEBSITE
                           |
              +------------+------------+
              |                         |
           PUBLIC                     ADMIN
              |                         |
       GitHub Pages              GitHub Auth
              |                         |
       Static HTML/CSS/JS        Admin Dashboard
              |                         |
              |                 Markdown Editor
              |                         |
              |                  GitHub API
              |                         |
              +-----------+-------------+
                          |
                       GitHub
                          |
                  Markdown / YAML
                    Images / Assets
                          |
                    GitHub Actions
                          |
                       Eleventy
                          |
                    GitHub Pages
```

Social sharing:

```text
PUBLIC PAGE
    ↓
ShareThis
    ↓
LinkedIn / X / WhatsApp / Email / Copy
```

No LinkedIn API.

No database.

No Supabase.

No Firebase.

No automatic LinkedIn publishing.

---

# 77. FIRST TASK FOR CODEX

Before implementing the complete website:

1. Inspect the repository.
2. Create or update `PROJECT_SPEC.md` from this specification.
3. Create `AGENTS.md` with the implementation rules.
4. Set up Eleventy if it is not already present.
5. Establish the design tokens.
6. Build the header and homepage design system.
7. Use placeholder content where real content is unavailable.
8. Run the build.
9. Verify the static output.
10. Do NOT begin the admin/authentication system until the public design foundation is established.

The first implementation goal is:

    A BEAUTIFUL, RESPONSIVE, STATIC HOMEPAGE

that visibly follows the supplied Bauhaus/Swiss/editorial references.

Only after the design foundation is approved should the project continue into the content engine and admin system.
