# Abantika Portfolio — Project SEO Roadmap v4.0.1

**Date:** 20 September 2026  
**Based on:** `PROJECT_HANDOFF_V4.0.md`  
**Purpose:** SEO implementation roadmap for the existing V4 production portfolio. This extends the SEO infrastructure already documented in V4 without changing the core architecture.

---

## 0. Current SEO Status

V4.0 already documents:

- [x] `/sitemap.xml`
- [x] `/feed.xml` RSS 2.0
- [x] OpenGraph social preview images
- [x] Eleventy-generated static HTML
- [x] Search index
- [x] Unified Vercel production deployment
- [x] GitHub as canonical content source

Do not rebuild these systems unnecessarily. This roadmap audits, hardens and completes the remaining SEO layer.

---

# 1. Goals

Make the portfolio technically complete for search engines and social crawlers while preserving:

- Editorial Bauhaus visual system
- Eleventy static generation
- Markdown/YAML content model
- GitHub as source of truth
- Vercel as unified production host
- Existing admin/editor
- Existing search system
- Existing R2 media system
- Privacy of unpublished/private content

Do not introduce a database or replace the existing publishing architecture.

---

# 2. SEO Layers

```text
CONTENT
  ↓
SEMANTIC HTML
  ↓
METADATA
  ↓
CRAWL / INDEX CONTROL
  ↓
STRUCTURED DATA
  ↓
PERFORMANCE + MEASUREMENT
```

All six layers should be verified before SEO is declared complete.

---

# 3. Phase SEO-1 — Crawl & Index Control

## 3.1 robots.txt

### Status
- [ ] Audit
- [ ] Implement if missing

Create:

```text
/robots.txt
```

Target behavior:

```text
User-agent: *
Allow: /

Disallow: /admin/
Disallow: /api/

Sitemap: https://YOUR-DOMAIN/sitemap.xml
```

Requirements:

- Do not block public portfolio pages.
- Do not expose private routes for indexing.
- Use the real production domain.

## 3.2 Sitemap Audit

Existing:

```text
/sitemap.xml
```

Verify that it contains intended public pages and excludes:

- `/admin/`
- `/api/`
- unpublished content
- private notes
- drafts
- internal utility routes
- duplicate/non-canonical URLs

Critical rule:

```text
published: false
        ↓
NOT IN SITEMAP
```

## 3.3 Private Content Isolation

Private/draft content must not leak through:

- sitemap
- RSS
- search index
- backlinks
- related content
- tag indexes
- navigation
- generated JSON
- OpenGraph metadata
- internal recommendations

Acceptance test:

```yaml
published: false
```

Create a private test document and verify that a public visitor cannot discover it through any generated public mechanism.

---

# 4. Phase SEO-2 — Canonical URLs

Every indexable HTML page should have exactly one canonical URL.

Example:

```html
<link rel="canonical" href="https://your-domain.com/projects/customer-churn-prediction/">
```

Requirements:

- HTTPS production domain
- consistent trailing-slash policy
- no homepage canonical for unrelated pages
- private/draft pages must not be publicly indexable

Generate canonical URLs from the Eleventy base layout/data.

---

# 5. Phase SEO-3 — Page Titles

Audit every public route.

Examples:

```text
Abantika — Data Analyst & Data Scientist
Customer Churn Prediction — Abantika
Understanding A/B Testing — Abantika
About Abantika — Data Analyst & Data Scientist
```

Requirements:

- Every indexable page has a unique `<title>`.
- Titles accurately describe page content.
- Avoid duplicate titles and keyword stuffing.
- Use existing YAML/frontmatter as the content source where appropriate.

---

# 6. Phase SEO-4 — Meta Descriptions

Add/audit per-page descriptions.

Recommended frontmatter:

```yaml
title: Customer Churn Prediction
description: >
  A machine-learning case study exploring customer churn,
  feature engineering, model evaluation, and business interpretation.
```

Generate:

```html
<meta name="description" content="...">
```

Requirements:

- Every important public page has a useful description.
- Do not use one generic description everywhere.
- Do not generate public metadata for private content.

---

# 7. Phase SEO-5 — OpenGraph & Social Metadata

V4 already documents OpenGraph social preview infrastructure.

Audit:

```html
<meta property="og:title">
<meta property="og:description">
<meta property="og:image">
<meta property="og:url">
<meta property="og:type">
```

Also audit optional Twitter/X metadata:

```html
<meta name="twitter:card">
<meta name="twitter:title">
<meta name="twitter:description">
<meta name="twitter:image">
```

Project and blog pages should have page-specific metadata where possible.

Private content must never generate public social cards.

---

# 8. Phase SEO-6 — Structured Data / JSON-LD

Add schema.org JSON-LD only where it accurately represents visible/public content.

## 8.1 Person

For the portfolio identity:

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Abantika",
  "url": "https://your-domain.com"
}
```

Only include information actually present and verified on the site.

## 8.2 BlogPosting / Article

For blog posts, expose relevant metadata such as:

- headline
- description
- datePublished
- dateModified when available
- author
- image
- canonical URL

## 8.3 BreadcrumbList

For hierarchical pages:

```text
Home
  → Projects
    → Customer Churn Prediction
```

Generate breadcrumb structured data where appropriate.

Do not add structured data merely to increase markup volume.

---

# 9. Phase SEO-7 — Semantic HTML & Headings

Audit templates for:

```text
H1
 ├── H2
 │    ├── H3
 │    └── H3
 └── H2
```

Requirements:

- one clear primary H1 on important content pages;
- logical heading hierarchy;
- semantic `<nav>`, `<main>`, and `<article>` where appropriate;
- do not use heading tags only for visual styling.

The Bauhaus design can remain visually distinctive while HTML remains semantic.

---

# 10. Phase SEO-8 — Image SEO

Audit meaningful images for:

```html
<img
  src="..."
  alt="..."
  width="..."
  height="..."
  loading="lazy"
>
```

Verify:

- meaningful alt text;
- width/height;
- WebP/AVIF where appropriate;
- correct MIME type;
- descriptive filenames;
- responsive sizing;
- lazy loading below the fold;
- appropriate priority for the main above-the-fold image.

Do not keyword-stuff alt text. Decorative images should use appropriate empty alt text.

---

# 11. Phase SEO-9 — Internal Linking

Use the existing Wikilink/content relationship system to strengthen discovery.

Example:

```text
Project
  ↓
Blog explanation
  ↓
Journal experiment
  ↓
Related project
```

Audit that public internal links:

- use crawlable HTML links;
- point to canonical URLs;
- never expose drafts/private content;
- use descriptive anchor text;
- do not create unnecessary link loops.

---

# 12. Phase SEO-10 — URL Quality

Keep the existing route architecture stable.

Preferred:

```text
/projects/customer-churn-prediction/
/blog/understanding-ab-testing/
/journal/2026/09/20/
```

Requirements:

- lowercase;
- readable;
- descriptive;
- stable;
- no unnecessary IDs;
- no unnecessary query parameters.

Do not change an already-published slug without a redirect plan.

---

# 13. Phase SEO-11 — 404 & Redirects

Provide a deliberate 404 experience.

Requirements:

- custom 404 page;
- useful navigation;
- correct HTTP 404 status;
- no accidental soft-404 behavior.

When a published URL changes:

```text
OLD URL
   ↓
301 Redirect
   ↓
NEW CANONICAL URL
```

---

# 14. Phase SEO-12 — RSS Audit

V4 already includes:

```text
/feed.xml
```

Audit:

- only intended public content appears;
- canonical URLs are correct;
- publication dates are correct;
- descriptions are useful;
- author metadata is correct;
- private/draft content is excluded.

Explicitly decide whether Journal entries belong in public RSS.

---

# 15. Phase SEO-13 — Performance & Core Web Vitals

Audit:

- LCP
- CLS
- INP
- image sizes
- font loading
- JavaScript bundles
- video loading
- animated media
- unnecessary client-side work
- third-party scripts such as ShareThis

Optimize implementation before removing the site's visual identity.

---

# 16. Phase SEO-14 — Favicon & Site Identity

Verify:

- favicon;
- Apple touch icon where appropriate;
- page title;
- site identity;
- social preview identity.

Optional:

```text
/manifest.webmanifest
```

Only add a web manifest if there is an actual PWA/product requirement.

---

# 17. Phase SEO-15 — Search Engine Verification

After production changes:

### Google Search Console

Verify the production property and submit:

```text
/sitemap.xml
```

Inspect:

- indexed pages;
- discovered pages;
- crawl errors;
- canonical issues;
- sitemap errors;
- mobile usability;
- Core Web Vitals;
- search queries.

Use other webmaster tools if relevant.

---

# 18. Phase SEO-16 — Automated SEO Validation

At minimum validate:

```text
Every public page:
[x] HTTP 200
[x] unique title
[x] meta description
[x] canonical
[x] H1
[x] OpenGraph
[x] crawlable links

Site:
[x] robots.txt
[x] sitemap.xml
[x] feed.xml
[x] no private URLs in sitemap
[x] no private URLs in search index
[x] no broken internal links
```

Where practical, run these checks during CI/build.

---

# 19. Priority Order

## P0 — Do first

1. [ ] `robots.txt`
2. [ ] Sitemap privacy audit
3. [ ] Private/draft content isolation audit
4. [ ] Canonical URLs
5. [ ] Unique page titles
6. [ ] Meta descriptions

## P1 — Complete the SEO layer

7. [ ] OpenGraph audit
8. [ ] Twitter/X cards
9. [ ] JSON-LD Person
10. [ ] JSON-LD BlogPosting/Article
11. [ ] Breadcrumb structured data
12. [ ] Semantic heading audit
13. [ ] Image alt/size audit

## P2 — Quality & resilience

14. [ ] Internal-link audit
15. [ ] URL/slug audit
16. [ ] 404 page
17. [ ] Redirect strategy
18. [ ] RSS privacy/content audit
19. [ ] Favicon/site identity audit

## P3 — Measurement

20. [ ] Core Web Vitals audit
21. [ ] Google Search Console
22. [ ] Sitemap submission
23. [ ] Indexing/canonical monitoring
24. [ ] Automated SEO validation

---

# 20. Definition of SEO Complete

Do not mark SEO complete merely because `sitemap.xml` and OpenGraph exist.

SEO is complete when:

```text
                         SEO COMPLETE
                              │
          ┌───────────────────┼───────────────────┐
          ↓                   ↓                   ↓
       CRAWLABLE          INDEXABLE          UNDERSTANDABLE
          │                   │                   │
      robots.txt          canonical           titles
      sitemap             sitemap             descriptions
      404                 public pages         headings
          │                                  JSON-LD
          └───────────────────┼───────────────────┘
                              ↓
                         DISCOVERABLE
                              │
                    internal linking
                    RSS / search
                              │
                              ↓
                         PERFORMANT
                              │
                       Core Web Vitals
                              │
                              ↓
                         MEASURABLE
                              │
                      Search Console
```

---

# 21. Constraints

Do not:

- introduce a database;
- replace GitHub as canonical content source;
- replace Eleventy;
- replace the existing admin editor;
- expose GitHub credentials;
- index private/draft content;
- generate fake structured data;
- keyword-stuff titles/descriptions/alt text;
- add unsupported SEO claims/content;
- redesign the site solely for SEO.

SEO changes must remain compatible with V4.

---

# 22. Final Acceptance Checklist

### Crawl
- [ ] `robots.txt` exists and is correct.
- [ ] Sitemap is reachable.
- [ ] Sitemap contains only intended public canonical URLs.
- [ ] `/admin/` and `/api/` are not indexable.

### Metadata
- [ ] Every important page has a unique title.
- [ ] Every important page has a useful description.
- [ ] Every indexable page has a canonical URL.
- [ ] OpenGraph works.
- [ ] Social images work.

### Structured data
- [ ] Person schema validated where used.
- [ ] Article/BlogPosting schema validated where used.
- [ ] Breadcrumb schema validated where used.

### Content
- [ ] H1 hierarchy is correct.
- [ ] Images have appropriate alt text.
- [ ] Images have dimensions.
- [ ] Internal links work.
- [ ] Private content remains private.

### Technical
- [ ] 404 works.
- [ ] Redirects work where required.
- [ ] RSS contains only intended public content.
- [ ] Performance reviewed.
- [ ] Favicon/site identity verified.

### Measurement
- [ ] Production site verified in Search Console.
- [ ] Sitemap submitted.
- [ ] Indexing inspected.
- [ ] Canonical errors inspected.
- [ ] Core Web Vitals inspected.

---

# 23. Final Architecture

When this roadmap is complete:

```text
GitHub
  = canonical content

Vercel
  = production website
  = admin
  = API

Eleventy
  = static publishing engine

R2
  = media storage

SEO layer
  = crawl control
  + metadata
  + structured data
  + internal discovery
  + performance
  + measurement
```

The SEO system should become a reliable part of the existing publishing pipeline, not a separate CMS or service.
