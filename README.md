# Skwirrel announcement feed

Central, version-controlled customer announcements for Skwirrel. The public `feed.json` is the single source of truth for release updates, upcoming changes, 2BA, ETIM and general notices.

## Publishing

Edit `feed.json` in a pull request. The validation workflow checks the schema before publication. GitHub Pages publishes the root directory from `main` after Pages is enabled in repository Settings > Pages (Deploy from a branch, `main`, `/ (root)`).

## Announcement format

Each item requires `id`, `type`, `publishedAt`, `title`, and `body`. `title` and `body` are maps with `en`, `nl`, `de`, `fr` translations. Types: `release`, `upcoming`, `2ba`, `etim`, `general`. Optional `url`, `version`, `expiresAt`, `priority` (`normal` or `important`). `body` supports Markdown rendered safely by clients. Dates use ISO 8601 UTC. The feed is intentionally empty until approved announcements are added.

The application should cache responses, handle network failures, and treat external Markdown as untrusted. Tenant-specific announcements are out of scope for v1.
