# Shared content contract for Skwirrel announcements

## Existing release notes compatibility

Skwirrel 2.0 currently reads version-specific files in `dist/app/release-notes/<version>.json`. The format has `version`, `status` (`upcoming` or `released`), optional `released_on`, `icon`, and `locales` with `en-GB`, `nl-NL`, `de-DE`, `fr-FR`. Each locale has `title`, `intro`, `sections`. Sections support `action`, `new`, `fixed`, `integrators`, with items, groups, and tables.

The existing feed instead uses `en`, `nl`, `de`, `fr` and a single Markdown `body`. These formats are **not** identical. Do not silently treat one as the other.

## Proposed unified v2 format

The key words MUST, MUST NOT, SHOULD and MAY are normative. The v2 validator enforces every MUST.

### Feed document

`feed-v2.json` is one JSON object, never a bare array:

```json
{
  "schemaVersion": 2,
  "updatedAt": "2026-10-12T10:00:00Z",
  "announcements": []
}
```

| Field | Required | Rule |
|---|---|---|
| `schemaVersion` | yes | The integer `2`. A reader MUST ignore a feed with any other value and keep its last-known-good data. |
| `updatedAt` | yes | ISO 8601 UTC. Bumped on every change to the feed. |
| `announcements` | yes | Array of announcement items. May be empty. IDs MUST be unique within the array. |

Readers MUST ignore unknown fields. Within v2, only optional fields may be added. Anything else needs `schemaVersion: 3`.

### Announcement item

| Field | Required | Rule |
|---|---|---|
| `id` | yes | Non-empty string, unique, never reused or changed. |
| `type` | yes | `release`, `upcoming`, `2ba`, `etim` or `general`. |
| `publishedAt` | yes | ISO 8601 UTC. |
| `revision` | yes | Integer, see [Revision](#revision). |
| `releaseNotes` | for `release` and `upcoming` only | See [Release items](#release-items). MUST be absent for other types. |
| `locales` | for `2ba`, `etim` and `general` only | Map with `en-GB`, `nl-NL`, `de-DE`, `fr-FR`, each `{title, intro, sections}`. MUST be absent for release items. |
| `priority` | no | `normal` (default when absent) or `important`. |
| `url` | no | HTTPS only. |
| `expiresAt` | no | ISO 8601 UTC, later than `publishedAt`. |

So the release example below is valid without `priority` and `url`, and the non-release example is valid without `url`.

### Release items

`releaseNotes` preserves the existing Skwirrel release-note file verbatim: `version`, `status`, `released_on`, `icon`, `locales`.

`type` and `releaseNotes.status` MUST agree. The validator rejects any other pairing:

| `type` | `releaseNotes.status` | `releaseNotes.released_on` |
|---|---|---|
| `upcoming` | `upcoming` | MUST be absent |
| `release` | `released` | Required, `YYYY-MM-DD` |

When a release ships, `type`, `status` and `released_on` change in the same commit, and `revision` is bumped.

### Revision

`revision` drives the unread indicator, so producers MUST manage it as follows:

- A new item starts at `1`.
- Any change a reader can see MUST increase it by exactly 1: text in any locale (`title`, `intro`, `sections`), `type`, `releaseNotes.status`, `releaseNotes.released_on`, `releaseNotes.version`, `priority` or `url`. This includes correcting a typo, so readers see corrections.
- Changes a reader cannot see MAY keep it: `expiresAt`, `icon`, key order or whitespace.
- It MUST never decrease and MUST never be reset.

The v2 validator compares each item against the same `id` on `main`: if a visible field changed and `revision` did not increase, the check fails. Clients treat an item as unread when the pair (`id`, `revision`) has not been seen.

### Sections

Both `releaseNotes.locales.*.sections` and `locales.*.sections` are arrays of section objects. This is the shape of the existing release notes (`docs/release-notes.md` in `skwirrel-2.0`); this document is the canonical copy for the feed, and the two MUST be changed together.

Every section has `kind` and `heading` (a non-empty string in the locale's language). The other fields depend on `kind`:

| `kind` | Used in | Fields |
|---|---|---|
| `action` | release items | `items` (required) |
| `new` | release items | `groups` (required) |
| `fixed` | release items | exactly one of `items` or `groups` |
| `integrators` | release items | `text` (required), `table` (required) |
| `general` | other announcements | `text` and/or `items`, at least one |

Release items use the kinds in the order listed and at most once each. Other announcements normally have one `general` section.

Building blocks:

- **item**: a non-empty string, or `{"title": "Bold lead.", "text": "The rest."}` with both strings non-empty.
- **group**: `{"title": string, "text"?: string, "items"?: item[]}`. At least one of `text` or `items`.
- **table**: `{"columns": string[], "rows": string[][]}`. Every row has exactly as many cells as `columns`.
- `items`, `groups`, `columns` and `rows` MUST be non-empty arrays when present.

Every text field supports only inline markup: `` `code` ``, `**bold**` and `*italic*`. Readers MUST escape everything else, so HTML is shown as typed. The validator rejects HTML tags.

Locale parity: every locale MUST have the same sections in the same order, with the same `kind`s, the same number of groups, items, columns and rows as `en-GB`.

Example `new` section:

```json
{
  "kind": "new",
  "heading": "New",
  "groups": [
    {
      "title": "Example feature",
      "text": "One sentence on what customers can now do.",
      "items": ["A short item.", {"title": "A bold lead.", "text": "The rest of the item."}]
    }
  ]
}
```

### Examples

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
    "en-GB": {"title": "ETIM update", "intro": "An important ETIM change.", "sections": [{"kind": "general", "heading": "What changes", "text": "Example text."}]},
    "nl-NL": {"title": "ETIM-update", "intro": "Een belangrijke ETIM-wijziging.", "sections": [{"kind": "general", "heading": "Wat verandert er", "text": "Voorbeeldtekst."}]},
    "de-DE": {"title": "ETIM-Update", "intro": "Eine wichtige ETIM-Änderung.", "sections": [{"kind": "general", "heading": "Was sich ändert", "text": "Beispieltext."}]},
    "fr-FR": {"title": "Mise à jour ETIM", "intro": "Un changement ETIM important.", "sections": [{"kind": "general", "heading": "Ce qui change", "text": "Texte d'exemple."}]}
  }
}
```

These are illustrative only. Do not publish examples as customer news.

## Migration and application integration

1. Keep the published `feed.json` v1 contract working until the v2 validator and reader are ready. Never break existing clients by replacing it without a coordinated release.
2. Add schema v2 validation for everything marked MUST above: the feed document, required fields, `type`/status pairing, revision bumps against `main`, section shapes, locale parity, and duplicate IDs.
3. Publish the v2 feed document from GitHub Pages as `feed-v2.json`, next to the v1 `feed.json`. Make the URL configurable.
4. Skwirrel backend should fetch with a short timeout and cache last-known-good data, sanitize rendered inline markup, and fall back to bundled release notes on failure.
5. Flyout: show latest announcements alongside upcoming and recent releases, with a single unread indicator based on announcement IDs and revisions. Page: retain existing release tabs and add an announcements view.
6. Keep version-specific release notes accurate for the installed tenant. Filter releases newer than the tenant version or clearly label them as upcoming. Do not imply an unreleased feature is already available.
7. Once integration is verified, migrate historical release JSON files and retire the duplicated source in a separate PR.

Tenant-specific announcements, personalized targeting and administration UI are phase two.
