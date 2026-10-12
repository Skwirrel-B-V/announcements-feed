# Shared content contract for Skwirrel announcements

## Existing release notes compatibility

Skwirrel 2.0 currently reads version-specific files in `dist/app/release-notes/<version>.json`. The format has `version`, `status` (`upcoming` or `released`), optional `released_on`, `icon`, and `locales` with `en-GB`, `nl-NL`, `de-DE`, `fr-FR`. Each locale has `title`, `intro`, `sections`. Sections support `action`, `new`, `fixed`, `integrators`, with items, groups, and tables.

The existing feed instead uses `en`, `nl`, `de`, `fr` and a single Markdown `body`. These formats are **not** identical. Do not silently treat one as the other.

## Proposed unified v2 format

Preserve release-note structure verbatim in a `releaseNotes` object for items of type `release` or `upcoming`. Other announcements use the same locale keys, with `title`, `intro`, and `sections` (normally one `general` section). Every announcement also has `id`, `type`, `publishedAt`, optional `expiresAt`, `priority`, `url`, and a stable `revision` for unread detection.

Example release item:

```json
{
  "id": "release-2.4.0",
  "type": "upcoming",
  "publishedAt": "2026-10-12T10:00:00Z",
  "revision": 1,
  "releaseNotes": {
    "version": "2.4.0",
    "status": "upcoming",
    "icon": "ph-sparkle",
    "locales": {
      "en-GB": {"title": "Coming soon", "intro": "Preview of the next release.", "sections": []},
      "nl-NL": {"title": "Binnenkort", "intro": "Vooruitblik op de volgende release.", "sections": []},
      "de-DE": {"title": "Demnächst", "intro": "Vorschau auf das nächste Release.", "sections": []},
      "fr-FR": {"title": "Bientôt", "intro": "Aperçu de la prochaine version.", "sections": []}
    }
  }
}
```

Example non-release announcement:

```json
{
  "id": "etim-notice-example",
  "type": "etim",
  "publishedAt": "2026-10-12T10:00:00Z",
  "revision": 1,
  "priority": "normal",
  "locales": {
    "en-GB": {"title": "ETIM update", "intro": "An important ETIM change.", "sections": []},
    "nl-NL": {"title": "ETIM-update", "intro": "Een belangrijke ETIM-wijziging.", "sections": []},
    "de-DE": {"title": "ETIM-Update", "intro": "Eine wichtige ETIM-Änderung.", "sections": []},
    "fr-FR": {"title": "Mise à jour ETIM", "intro": "Un changement ETIM important.", "sections": []}
  }
}
```

These are illustrative only. Do not publish examples as customer news.

## Migration and application integration

1. Keep the published `feed.json` v1 contract working until the v2 validator and reader are ready. Never break existing clients by replacing it without a coordinated release.
2. Add schema v2 validation for locale parity, release statuses and dates, section shapes, stable IDs, and duplicate IDs.
3. Publish the versioned v2 feed from GitHub Pages, e.g. `feed-v2.json`. Make the URL configurable.
4. Skwirrel backend should fetch with a short timeout and cache last-known-good data, sanitize rendered inline markup, and fall back to bundled release notes on failure.
5. Flyout: show latest announcements alongside upcoming and recent releases, with a single unread indicator based on announcement IDs and revisions. Page: retain existing release tabs and add an announcements view.
6. Keep version-specific release notes accurate for the installed tenant. Filter releases newer than the tenant version or clearly label them as upcoming. Do not imply an unreleased feature is already available.
7. Once integration is verified, migrate historical release JSON files and retire the duplicated source in a separate PR.

Tenant-specific announcements, personalized targeting and administration UI are phase two.
