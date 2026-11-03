# CLAUDE.md — Skwirrel announcements feed

Guidance for AI coding agents working in this repo. (Identical to `AGENTS.md`,
keep the two in sync.)

## What this is

The **public** source for the announcements shown in the top right corner of the
Skwirrel app, including **every release note**. Two files in the repo root are
served by GitHub Pages, built from the `main` branch (root `/`):

- `feed-v2.json`: the release notes, read by Skwirrel 2.4.0 and later.
  `https://skwirrel-b-v.github.io/announcements-feed/feed-v2.json`
- `feed.json`: the v1 feed, kept for apps in the field. Do not remove it.
  `https://skwirrel-b-v.github.io/announcements-feed/feed.json`

The app fetches the feed, caches it, and renders the announcements. Merging to
`main` publishes to customers, without a Skwirrel release. There is no staging
step. The format of `feed-v2.json` is
[docs/unified-content-contract.md](docs/unified-content-contract.md).

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
feed-v2.json               # Release notes (schemaVersion 2). Served live from main.
feed.json                  # v1 feed (schemaVersion 1). Served live from main.
docs/                      # unified-content-contract.md: the v2 format
examples/announcement.json # Example v1 item. Not published content.
scripts/validate.mjs       # v1 schema check (node, no dependencies)
scripts/validate-v2.mjs    # v2 check, also for bundled release-note files
.github/workflows/         # validate.yml runs both checks on PRs and main
```

## Publishing release notes (feed-v2.json)

1. Branch off `main`. Never edit `main` directly.
2. Add or change the `release-<version>` item in `feed-v2.json`, newest first.
   Bump `updatedAt`. A new item starts at `revision: 1`; any change a reader
   sees bumps `revision` by 1.
3. When a release ships: `type` → `release`, `releaseNotes.status` →
   `released`, add `released_on`, bump `revision`, all in one commit.
4. Run `node scripts/validate-v2.mjs --base origin/main`. It must pass.
5. Open a pull request. A human approves it. Merging publishes it.

Skwirrel shows releases `x.y.0` in the flyout and every release, patch
releases included, on the release notes page.

## Publishing an announcement (feed.json, v1)

1. Branch off `main`. Never edit `main` directly.
2. Add the item to `announcements` in `feed.json` and bump `updatedAt`.
3. Run `node scripts/validate.mjs`. It must pass.
4. Open a pull request. A human approves it. Merging publishes it.

## Format of feed.json (schemaVersion 1)

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
- Keep dependencies at zero. Both validators run on plain Node.
- Keep `AGENTS.md` identical to `CLAUDE.md`. CI fails when they differ.

## Where this fits

This repo is cloned into the Skwirrel workspace as
`repositories/announcements-feed` (see the workspace `repos.manifest`). The
in-app consumer lives in `skwirrel-core` (remote `skwirrel-2.0`,
`App\Models\ReleaseNotes\AnnouncementFeed`). A change to the format must be
coordinated with that repo.
