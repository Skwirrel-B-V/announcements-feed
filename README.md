# Skwirrel announcement feed

> **This repository is public.** Everything committed here is readable by anyone and published to customers when merged to `main`. See [CLAUDE.md](CLAUDE.md) for the rules.

Live feeds:

- Release notes (v2, Skwirrel 2.4.0 and later): <https://skwirrel-b-v.github.io/announcements-feed/feed-v2.json>
- v1 feed: <https://skwirrel-b-v.github.io/announcements-feed/feed.json>

Central, version-controlled customer announcements for Skwirrel. `feed-v2.json` is the single source of truth for the release notes in the app: the flyout and the release notes page. A merged change reaches customers without a new Skwirrel release. Its format is [docs/unified-content-contract.md](docs/unified-content-contract.md); check it with `node scripts/validate-v2.mjs --base origin/main`.

## Publishing

Release notes go in `feed-v2.json`, other v1 announcements in `feed.json`, always through a pull request. The steps, including the `revision` rules for `feed-v2.json`, are under "Publishing release notes" in [CLAUDE.md](CLAUDE.md). The validation workflow checks both files before publication. GitHub Pages publishes the root directory from `main` after Pages is enabled in repository Settings > Pages (Deploy from a branch, `main`, `/ (root)`).

## v1 announcement format (feed.json)

Each item requires `id`, `type`, `publishedAt`, `title`, and `body`. `title` and `body` are maps with `en`, `nl`, `de`, `fr` translations. Types: `release`, `upcoming`, `2ba`, `etim`, `general`. Optional `url`, `version`, `expiresAt`, `priority` (`normal` or `important`). `body` supports Markdown rendered safely by clients. Dates use ISO 8601 UTC. The feed is intentionally empty until approved announcements are added.

The application should cache responses, handle network failures, and treat external Markdown as untrusted. Tenant-specific announcements are out of scope for v1.
