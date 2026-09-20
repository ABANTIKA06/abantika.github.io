# Abantika Portfolio — Product Guideline v4.0.2

**Date:** 20 September 2026  
**Based on:** `PROJECT_HANDOFF_V4.0.md`  
**Purpose:** Redesign the authoring experience of the private admin workspace so Projects, Blog, Journal, and Notes use a flexible, section-based publishing model. This is a product/UX implementation guideline, not a new hosting or content-storage architecture.

---

# 0. Product Decision

The admin editor should no longer behave like one large database-style form.

It should behave like an **editorial publishing workspace**.

The core model is:

```text
CONTENT TYPE
    ↓
METADATA
    ↓
UNLIMITED SECTIONS
    ↓
EACH SECTION = EDIT + SOURCE + PREVIEW
    ↓
REORDER / DUPLICATE / COLLAPSE
    ↓
ADD SECTION
    ↓
SAVE / PREVIEW / PUBLISH
```

The author should be able to decide how many sections a document needs.

There is **no fixed four-section limit**.

A short project may contain 2 sections.

A detailed project may contain 14 sections.

Both are valid.

---

# 1. The Problem With the Current Editor

The current project editor presents a very long sequence of:

- metadata fields;
- descriptions;
- technologies;
- artwork settings;
- links;
- fixed project sections;
- textareas;
- and finally a separate WYSIWYG editor.

This makes the editor feel like a large database form rather than a writing environment.

The WYSIWYG being at the very end creates a poor authoring hierarchy because the primary activity — writing the project — is visually subordinate to configuration.

The goal of v4.0.2 is **not to remove capabilities**.

The goal is to reorganize them so that:

> **Writing is the primary activity. Metadata and configuration are supporting activities.**

---

# 2. New Product Mental Model

The admin should feel like:

```text
Editorial CMS
+
Markdown workspace
+
Structured document editor
```

It should NOT feel like:

```text
Database record editor
+
large settings form
```

The author should be able to open a project and immediately think:

> What do I want to say?

rather than:

> Which field do I have to fill next?

---

# 3. Universal Document Model

The same authoring philosophy should work across:

- Projects
- Blog
- Journal
- Notes
- Pages where applicable

Every document has:

```text
DOCUMENT
│
├── Metadata
│
├── Section 01
│
├── Section 02
│
├── Section 03
│
├── ...
│
├── Section N
│
└── Publishing
```

There is no arbitrary maximum number of sections.

---

# 4. Unlimited Sections

## 4.1 Core requirement

The author can click:

```text
+ ADD SECTION
```

as many times as required.

Do not hard-code:

```text
Section 01
Section 02
Section 03
Section 04
```

as the permanent document structure.

Those are examples, not limits.

---

## 4.2 Examples

A simple project:

```text
01 / THE PROBLEM
02 / THE RESULT
```

A detailed analytical project:

```text
01 / THE PROBLEM
02 / THE DATA
03 / DATA CLEANING
04 / EXPLORATION
05 / FEATURE ENGINEERING
06 / STATISTICAL ANALYSIS
07 / MODEL
08 / MODEL COMPARISON
09 / RESULTS
10 / ERROR ANALYSIS
11 / BUSINESS INTERPRETATION
12 / LIMITATIONS
13 / WHAT I LEARNED
14 / NEXT STEPS
```

Both should be supported without changing the underlying editor.

---

# 5. Anatomy of a Section

Every section should be a self-contained editorial unit.

```text
┌──────────────────────────────────────────────┐
│ 03 / METHODOLOGY                             │
│                                              │
│ Section heading                              │
│ [ THE METHOD                               ] │
│                                              │
│ [ EDIT ] [ SOURCE ] [ PREVIEW ]              │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ B I H1 H2 H3 • 1. LINK IMAGE CODE ∑    │ │
│ ├──────────────────────────────────────────┤ │
│ │                                          │ │
│ │ Write the section content...             │ │
│ │                                          │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│                    ⋮                         │
└──────────────────────────────────────────────┘
```

A section contains:

1. Section label
2. Section heading
3. Editor mode controls
4. WYSIWYG editor
5. Raw Markdown/source editor
6. Rendered preview
7. Section actions
8. Collapse/expand control

---

# 6. Three Modes Must Exist in EVERY Section

This is a hard requirement.

Every section must provide:

```text
[ EDIT ] [ SOURCE ] [ PREVIEW ]
```

## 6.1 EDIT

The WYSIWYG editing surface.

The author should be able to write naturally without manually thinking about Markdown syntax.

Supported capabilities should remain consistent with the existing editor.

At minimum:

```text
B
I
H1
H2
H3
Bulleted list
Ordered list
Link
Image
Code
Quote
Table where supported
Horizontal rule where supported
∑ LaTeX Math
```

---

## 6.2 SOURCE

Raw Markdown editing.

Example:

```markdown
## The Method

I compared three approaches.

- Logistic regression
- Random forest
- XGBoost

The final model achieved **87% accuracy**.
```

The SOURCE mode must edit the same underlying section content as EDIT mode.

---

## 6.3 PREVIEW

Render the section using the same content rendering pipeline and visual rules used by the public site.

Preview must show:

- typography;
- headings;
- lists;
- images;
- links;
- code;
- tables;
- equations;
- callouts where supported;
- spacing;
- relevant portfolio styling.

The preview must not be a simplified fake rendering.

It should approximate the actual production output.

---

# 7. EDIT ↔ SOURCE ↔ PREVIEW Integrity

Switching between modes must not silently destroy content.

Example:

```text
EDIT
 ↓
SOURCE
 ↓
PREVIEW
 ↓
EDIT
```

must preserve supported content.

Unsupported Markdown must not be silently deleted.

If a construct cannot safely be represented by the WYSIWYG layer:

- preserve it in SOURCE;
- warn the author if necessary;
- never silently erase it.

Markdown remains canonical.

---

# 8. Section Content Can Be Rich

A section is not restricted to plain paragraphs.

It may contain combinations of:

```text
Paragraph
Heading
Bold / Italic
Lists
Links
Images
Tables
Code
Blockquotes
Horizontal rules
LaTeX
Callouts
```

For example:

```text
04 / EXPLORATORY ANALYSIS

paragraph
    ↓
chart/image
    ↓
interpretation
    ↓
table
    ↓
LaTeX equation
    ↓
conclusion
```

Another section may contain:

```text
05 / MODEL

explanation
    ↓
Python code
    ↓
equation
    ↓
model comparison table
    ↓
result interpretation
```

The section should not impose a rigid content pattern.

---

# 9. Add Section

At the end of the section list:

```text
────────────────────────────────────────────

              + ADD SECTION

────────────────────────────────────────────
```

When clicked:

```text
NEW SECTION

Label
[ 05 / MODEL EVALUATION              ]

Heading
[ Comparing the Models               ]

[ CREATE SECTION ]
```

After creation, open the new section in EDIT mode.

The author should be able to start writing immediately.

---

# 10. Section Ordering

Unlimited sections require ordering controls.

Every section should support:

```text
Move up
Move down
```

Prefer drag-and-drop when it can be implemented cleanly.

Example:

```text
01 / THE PROBLEM              ⋮⋮
02 / THE DATA                 ⋮⋮
03 / THE METHOD               ⋮⋮
04 / THE RESULTS              ⋮⋮
```

If section 04 is moved to position 02:

```text
01 / THE PROBLEM
02 / THE RESULTS
03 / THE DATA
04 / THE METHOD
```

The system should update section numbering automatically if numbering is derived from order.

The author should not have to manually renumber sections.

---

# 11. Section Duplication

Each section should support:

```text
⋮
├── Move up
├── Move down
├── Duplicate
├── Collapse
└── Delete
```

Duplication is useful when several sections share a similar structure.

Example:

```text
MODEL 1
MODEL 2
MODEL 3
```

A section can be duplicated and then edited.

---

# 12. Section Collapse

Unlimited sections must not create an endlessly overwhelming page.

Therefore every section should be collapsible.

Example:

```text
01 / THE PROBLEM                         ▼
──────────────────────────────────────────
[ editor ]

02 / THE DATA                            ▶

03 / DATA CLEANING                       ▶

04 / EXPLORATION                         ▶

05 / MODEL                               ▶

06 / RESULTS                             ▶
```

Only the active section needs to remain expanded.

The author can open another section without losing content.

---

# 13. Metadata vs Content

The editor should clearly separate:

## Metadata

Examples:

- Title
- Slug
- Date
- Category
- Technologies
- Featured
- Publishing state

## Content

The unlimited editorial sections.

## Supporting configuration

Examples:

- Cover image
- Artwork
- Artwork style
- Artwork caption
- GitHub URL
- Live URL
- SEO metadata

The author should not experience these as one giant continuous form.

---

# 14. Recommended Page Structure

The project editor should approximately follow:

```text
┌──────────────────────────────────────────────────────────────┐
│ ABANTIKA       PROJECTS / EDIT       DRAFT   SAVE   PUBLISH │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ FINANCIAL ANOMALY                                            │
│ Understanding the companies listed in NIFTY 500              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ METADATA                                                     │
│                                                              │
│ Title          Slug                                          │
│ Date           Category                                      │
│ Description    Technologies                                  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ CONTENT                                                      │
│                                                              │
│ 01 / THE PROBLEM                                            │
│ [ EDIT ] [ SOURCE ] [ PREVIEW ]                             │
│ [ WYSIWYG ]                                                  │
│                                                              │
│ 02 / THE EVIDENCE                                            │
│ [ EDIT ] [ SOURCE ] [ PREVIEW ]                             │
│ [ WYSIWYG ]                                                  │
│                                                              │
│ 03 / THE METHOD                                              │
│ [ EDIT ] [ SOURCE ] [ PREVIEW ]                             │
│ [ WYSIWYG ]                                                  │
│                                                              │
│ + ADD SECTION                                                │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ MEDIA                                                        │
│ LINKS                                                        │
│ SEO                                                          │
│ PUBLISHING                                                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

# 15. Recommended Desktop UX

For large screens, consider a two-column editor after the metadata area:

```text
┌─────────────────────────────────────────────┬───────────────┐
│                                             │ SETTINGS      │
│ CONTENT                                     │               │
│                                             │ Metadata      │
│ 01 / PROBLEM                                │ Media         │
│ [ editor ]                                  │ Links         │
│                                             │ SEO           │
│ 02 / DATA                                   │ Publishing    │
│ [ editor ]                                  │               │
│                                             │               │
│ 03 / METHOD                                 │               │
│ [ editor ]                                  │               │
│                                             │               │
│ + ADD SECTION                               │               │
└─────────────────────────────────────────────┴───────────────┘
```

A sticky settings panel is preferred if it improves usability without making the editor cramped.

---

# 16. Mobile UX

On smaller screens, do not preserve a cramped two-column layout.

Use:

```text
CONTENT
MEDIA
LINKS
SEO
PUBLISHING
```

as collapsible panels/accordions.

The section editor should occupy the available width.

---

# 17. Toolbar Design

The toolbar should remain compact.

Recommended:

```text
B  I  H1  H2  H3  •  1.  LINK  IMAGE  CODE  QUOTE  ∑
```

The existing LaTeX functionality should be represented by one compact:

```text
∑
```

button.

Do not place separate `LATEX MATH` buttons beside every field.

Math is an editor capability, not a separate field type.

---

# 18. Remove Redundant Writing Fields

Avoid maintaining separate fields for information that belongs naturally inside the document.

For example, reconsider the need for:

```text
Description
Summary
Headline
Extra Markdown / Case Study Body
```

all as separate large writing areas.

Preferred model:

```text
Title
Short description / summary
        ↓
Unlimited structured content sections
```

If the public template needs a special hero headline, keep it as a clearly named presentation/metadata field rather than an ambiguous writing field.

---

# 19. Derived Fields

Do not ask the author to manually maintain information that the system can reliably derive.

Examples:

### Year

If date is:

```text
19-09-2026
```

the year can generally be derived as:

```text
2026
```

### Section number

If sections are ordered:

```text
01
02
03
04
```

the numbering can be generated automatically.

Do not create unnecessary maintenance work.

---

# 20. Save / Preview / Publish

Publishing controls must remain highly visible.

Recommended sticky header:

```text
← PROJECTS

DRAFT

[ SAVE ] [ PREVIEW ] [ PUBLISH ]
```

Optional bottom controls may remain as a convenience.

Rules:

- Save and Publish remain separate actions.
- Save must not automatically publish.
- Publish requires explicit confirmation.
- Failed publishing must preserve the current draft.
- Preview must clearly indicate draft/preview state.

---

# 21. Canonical Storage Model

The new UI must not introduce a database merely to manage sections.

GitHub remains the canonical source of truth.

Markdown/YAML remains the canonical content representation.

The section system should serialize into the existing content model.

Conceptually:

```yaml
---
title: Financial Anomaly
slug: financial-anomaly
category: Finance Analysis
---
```

followed by ordered Markdown sections:

```markdown
## 01 / The Problem

### The Question

The companies listed in NIFTY 500...

---

## 02 / The Evidence

### The Data

...

---

## 03 / The Method

### The Methodology

...

---

## 04 / The Outcome

### The Result

...
```

The exact serialization can follow the existing V4 parser/content model.

Do not create an opaque proprietary format that makes GitHub content difficult to inspect or edit.

---

# 22. Backward Compatibility

Existing projects using the current fixed-section structure must continue to work.

Migration should:

1. Read existing project content.
2. Map current sections into the new section array/model.
3. Preserve content.
4. Preserve frontmatter.
5. Preserve Wikilinks.
6. Preserve images/media references.
7. Preserve LaTeX.
8. Preserve supported Markdown.
9. Avoid changing public URLs.
10. Avoid changing published content unless explicitly migrated.

No content should be lost during migration.

---

# 23. Public Rendering

The new editor structure must not force a visual redesign of the public project page.

The public site can continue to render sections using the existing editorial Bauhaus design.

The admin structure should simply make it easier to author those sections.

Example:

```text
ADMIN
01 / PROBLEM
02 / DATA
03 / METHOD
04 / RESULTS
05 / LIMITATIONS

        ↓

PUBLIC

01 / PROBLEM
02 / DATA
03 / METHOD
04 / RESULTS
05 / LIMITATIONS
```

The public site remains the polished reading experience.

The admin remains the flexible writing experience.

---

# 24. Apply the Same Model to Blog

A blog post could contain:

```text
01 / INTRODUCTION
02 / CONTEXT
03 / THE DATA
04 / ANALYSIS
05 / RESULTS
06 / DISCUSSION
07 / CONCLUSION
```

Or:

```text
01 / INTRODUCTION
02 / CONCLUSION
```

Every section has:

```text
EDIT
SOURCE
PREVIEW
```

---

# 25. Apply the Same Model to Journal

Journal entries should be even faster to create.

Example:

```text
01 / WHAT I DID
02 / WHAT I LEARNED
03 / NEXT
```

But the author can add:

```text
04 / CODE
05 / QUESTION
06 / FOLLOW-UP
```

if needed.

No forced template limit.

---

# 26. Apply the Same Model to Notes

Notes can be highly flexible.

Example:

```text
01 / QUESTION
02 / OBSERVATION
03 / EVIDENCE
04 / HYPOTHESIS
05 / REFERENCES
```

Notes should remain lightweight and easy to create.

---

# 27. Section UX Principles

The implementation should follow these principles:

### 1. Writing first

The editor is primarily for writing, not metadata administration.

### 2. Progressive disclosure

Do not show every configuration option at once.

### 3. Unlimited structure

Never impose an arbitrary section count.

### 4. Small writing tasks

Each section should feel manageable.

### 5. Mode freedom

EDIT, SOURCE and PREVIEW must always be available.

### 6. No content loss

Switching modes must preserve supported content.

### 7. Reversible actions

Deletion should require confirmation or support undo where practical.

### 8. Fast creation

Adding a section should take seconds.

### 9. Familiarity

Projects, blogs, journals and notes should share the same authoring mental model.

### 10. Git-friendly content

The resulting content remains understandable as Markdown.

---

# 28. Implementation Priority

## P0 — Core restructuring

- [ ] Replace fixed project section count with dynamic section collection.
- [ ] Create reusable Section Editor component.
- [ ] Add unlimited sections.
- [ ] Add section label.
- [ ] Add section heading.
- [ ] Add EDIT/SOURCE/PREVIEW.
- [ ] Move WYSIWYG into each section.
- [ ] Remove the old standalone WYSIWYG at the bottom.
- [ ] Preserve existing Markdown serialization.

## P1 — Section interaction

- [ ] Collapse/expand.
- [ ] Move up/down.
- [ ] Drag-and-drop ordering if practical.
- [ ] Duplicate section.
- [ ] Delete section with confirmation.
- [ ] Automatic section numbering.
- [ ] Add Section interaction.

## P2 — Editor quality

- [ ] Compact toolbar.
- [ ] `∑` Math Builder.
- [ ] Image insertion.
- [ ] Code blocks.
- [ ] Tables.
- [ ] Links.
- [ ] Quotes.
- [ ] Preview using production rendering.
- [ ] Markdown round-trip validation.

## P3 — Workspace polish

- [ ] Sticky save/preview/publish controls.
- [ ] Metadata/content separation.
- [ ] Collapsible settings.
- [ ] Responsive/mobile layout.
- [ ] Autosave/draft recovery if compatible with existing architecture.
- [ ] Clear unsaved-change indicator.

## P4 — Content-type rollout

- [ ] Projects
- [ ] Blog
- [ ] Journal
- [ ] Notes
- [ ] Pages where applicable

---

# 29. Acceptance Tests

A v4.0.2 implementation is complete only when all of these work.

## Section creation

- [ ] Create one section.
- [ ] Create ten sections.
- [ ] Create twenty+ sections without UI failure.
- [ ] No artificial section limit exists.

## Editing

For every section:

- [ ] EDIT works.
- [ ] SOURCE works.
- [ ] PREVIEW works.
- [ ] Switching modes preserves content.
- [ ] Markdown is preserved.
- [ ] LaTeX is preserved.
- [ ] Images are preserved.
- [ ] Links are preserved.
- [ ] Code is preserved.

## Organization

- [ ] Collapse section.
- [ ] Expand section.
- [ ] Move section.
- [ ] Duplicate section.
- [ ] Delete section.
- [ ] Add section.
- [ ] Section numbering updates correctly.

## Persistence

- [ ] Save creates correct Markdown.
- [ ] GitHub synchronization preserves section order.
- [ ] Reloading the editor restores all sections.
- [ ] Published page renders all sections correctly.

## Publishing

- [ ] Draft remains unpublished.
- [ ] Preview does not publish.
- [ ] Publish requires explicit action.
- [ ] Failed publish does not destroy draft.
- [ ] Public page matches preview.

## Migration

- [ ] Existing projects remain readable.
- [ ] Existing content is preserved.
- [ ] Existing URLs remain unchanged.
- [ ] Existing images remain valid.
- [ ] Existing Wikilinks remain valid.

---

# 30. Definition of Done

The product redesign is complete when the author can do this:

```text
Open Project
     ↓
Read/edit metadata
     ↓
Open Section 01
     ↓
Write in EDIT
     ↓
Check SOURCE
     ↓
Check PREVIEW
     ↓
Add Section 02
     ↓
Write
     ↓
Add Section 03
     ↓
Move / duplicate / collapse sections
     ↓
Add media / math / code
     ↓
Preview complete project
     ↓
Save Draft
     ↓
Publish
```

without encountering a fixed section limit or a giant intimidating form.

---

# 31. Final Product Vision

The finished editor should communicate:

> **Write your work. Organize it however you want. See exactly what it will look like. Publish when ready.**

The author should not need to think about:

- database records;
- Markdown internals unless desired;
- fixed section counts;
- technical serialization;
- unnecessary repeated fields.

They should be able to think about:

- the problem;
- the evidence;
- the method;
- the result;
- the story;
- the insight.

The admin becomes a **personal publishing workspace**, while GitHub remains the canonical source of truth and the public Vercel site remains the final reading experience.

---

# 32. V4.0.2 Target Architecture

```text
                         ADMIN WORKSPACE
                               │
               ┌───────────────┴───────────────┐
               │                               │
            METADATA                         CONTENT
               │                               │
               │                    ┌──────────┴──────────┐
               │                    │                     │
               │                 SECTION 01           SECTION 02
               │                    │                     │
               │              ┌─────┼─────┐         ┌─────┼─────┐
               │              │     │     │         │     │     │
               │            EDIT SOURCE PREVIEW     EDIT SOURCE PREVIEW
               │
               │                    ...
               │
               │                 SECTION N
               │
               └──────────────────────┬──────────────────────┘
                                      │
                                Markdown/YAML
                                      │
                                      ▼
                                    GitHub
                                      │
                                      ▼
                                    Vercel
                                      │
                                      ▼
                              PUBLIC PORTFOLIO
```

This architecture keeps the existing V4 platform intact while making the authoring experience substantially more flexible, less intimidating, and better aligned with the project's editorial purpose.
