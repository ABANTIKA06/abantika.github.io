# Abantika Portfolio — Implementation Notes

The authoritative brief is maintained in `ABANTIKA_CODEX_PROJECT_SPEC.md`.

## Current phase

Phase 1: establish a responsive, static public homepage using an Eleventy build.

## Non-negotiable visual rules

- Editorial / Bauhaus / Swiss-modernist visual grammar.
- Off-white, black, grey, and sparing red palette.
- Oversized typography, technical metadata, numbered sections, strong grid rules.
- Open editorial layouts rather than generic rounded cards or dashboard patterns.
- Placeholder content must never imply an unverified personal achievement or metric.

## Architecture direction

Eleventy, Markdown-driven content, and static GitHub Pages output. Content and the public site are built before any private publishing/authentication layer. No client-side secrets, databases, Firebase, Supabase, LinkedIn API, or automatic LinkedIn publishing.

