# CLAUDE.md — Skwirrel announcements feed

Guidance for AI coding agents working in this repo. (Identical to `AGENTS.md`,
keep the two in sync.)

## What this is

The **public** source for the announcements shown in the top right corner of the
Skwirrel app. `feed.json` in the repo root is served by GitHub Pages, built from
the `main` branch (root `/`):

`https://skwirrel-b-v.github.io/announcements-feed/feed.json`

The app fetches that URL, caches it, and renders the announcements. Merging to
`main` publishes to customers. There is no staging step.

## This repo is PUBLIC

Everything committed here, including history, branches, PR text and commit
messages, is readable by anyone on the internet.

- Only approved, customer-safe announcement text belongs here.
- Never commit secrets, tokens, `.env` files, internal URLs or hostnames.
- Never name customers or tenants, and never add tenant-specific content
  (tenant-specific announcements are out of scope for v1).
- No unreleased roadmap detail unless it is meant to be announced.
- If unsure whether something may be public, ask first. A published feed can be
  cached by apps and by Pages, so deleting later does not fully undo it.

## Layout

```
feed.json                  # THE feed. Served live from main.
examples/announcement.json # Example item. Not published content.
scripts/validate.mjs       # Schema check (node, no dependencies)
.github/workflows/         # validate.yml runs the check on PRs and main
```

## Publishing an announcement

1. Branch off `main`. Never edit `main` directly.
2. Add the item to `announcements` in `feed.json` and bump `updatedAt`.
3. Run `node scripts/validate.mjs`. It must pass.
4. Open a pull request. A human approves it. Merging publishes it.

## Format (schemaVersion 1)

Each item requires `id` (unique, stable, never reused), `type`, `publishedAt`,
`title` and `body`.

- `type`: `release`, `upcoming`, `2ba`, `etim`, `general`
- `title` and `body`: maps with all four languages `en`, `nl`, `de`, `fr`
- Optional: `url` (HTTPS only), `version`, `expiresAt`, `priority`
  (`normal` or `important`)
- Dates: ISO 8601 UTC, e.g. `2026-10-12T12:00:00Z`
- `body` is Markdown. Clients must treat it as untrusted and render it safely,
  so keep it simple: no raw HTML, no scripts, no tracking links. `validate.mjs`
  rejects HTML tags and non-HTTPS Markdown links; the rest is on the reviewer.

## Rules

- **Never break the contract.** Apps in the field read `schemaVersion: 1`.
  Only add optional fields. A breaking change needs a new `schemaVersion` and a
  plan for the old one.
- **Valid JSON at all times on `main`.** A broken `feed.json` breaks the
  announcements for every customer. CI must be green before merge.
- **Never reuse or change an `id`.** Clients may remember which items a user
  has already seen.
- **Fill all four languages** with real translations, not copies of English.
  Have a native speaker review `nl`, `de` and `fr` where possible.
- To retire an item, set `expiresAt` or remove it in a PR. Don't rewrite history.
- An empty `announcements` array is valid and means nothing to show.
- Keep dependencies at zero. `validate.mjs` runs on plain Node.
- Keep `AGENTS.md` identical to `CLAUDE.md`. CI fails when they differ.

## Where this fits

This repo is cloned into the Skwirrel workspace as
`repositories/announcements-feed` (see the workspace `repos.manifest`). The
in-app consumer lives in `skwirrel-core` (remote `skwirrel-2.0`). A change to
the format must be coordinated with that repo.
