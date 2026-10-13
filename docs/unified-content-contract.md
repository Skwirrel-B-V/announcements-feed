# Shared content contract for Skwirrel announcements

## Existing release notes compatibility

Skwirrel 2.0 currently reads version-specific files in `dist/app/release-notes/<version>.json`. The format has `version`, `status` (`upcoming` or `released`), optional `released_on`, `icon`, and `locales` with `en-GB`, `nl-NL`, `de-DE`, `fr-FR`. Each locale has `title`, `intro`, `sections`. Sections support `action`, `new`, `fixed`, `integrators`, with items, groups, and tables.

The existing feed instead uses `en`, `nl`, `de`, `fr` and a single Markdown `body`. These formats are **not** identical. Do not silently treat one as the other.

## Proposed unified v2 format

The key words MUST, MUST NOT, SHOULD and MAY are normative. Each rule names who it binds:

- **Producer** rules apply to the feed content. The v2 validator in this repo enforces them on every PR.
- **Reader** rules apply to the Skwirrel app that consumes the feed. The validator cannot see them; the reader's own tests cover them.
- **Reviewer** rules need history or judgement the validator does not have. The PR reviewer checks them.

A rule without a label is a producer rule: it describes valid content, and the validator enforces it.

*Release items* means items of type `release` or `upcoming`. *Other announcements* means items of type `2ba`, `etim` or `general`.

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
| `schemaVersion` | yes | The integer `2`. Reader: MUST ignore a feed with any other value and keep its last-known-good data. |
| `updatedAt` | yes | ISO 8601 UTC. Producer: MUST be later than `updatedAt` on `main` whenever the feed changes. |
| `announcements` | yes | Array of announcement items. May be empty. IDs MUST be unique within the array. |

Producer: the validator rejects unknown fields at every level (feed, item, `releaseNotes`, locale, section, group, item, table), so a typo such as `prority` fails in CI. Within v2, only optional fields and new section kinds (see [Sections](#sections)) may be added, and they are added to this document in the same PR that first uses them. Anything else needs `schemaVersion: 3`.

Reader: MUST ignore unknown fields, so apps already in the field keep working when an optional field is added.

### Announcement item

| Field | Required | Rule |
|---|---|---|
| `id` | yes | Non-empty string, unique within the feed. Reviewer: never reuse or change an id, also not one from a removed item. |
| `type` | yes | `release`, `upcoming`, `2ba`, `etim` or `general`. |
| `publishedAt` | yes | ISO 8601 UTC. |
| `revision` | yes | Integer, see [Revision](#revision). |
| `releaseNotes` | Required for release items | See [Release items](#release-items). MUST be absent for other announcements. |
| `locales` | Required for other announcements | See [Locales](#locales). MUST be absent for release items. |
| `priority` | no | `normal` (default when absent) or `important`. |
| `url` | no | HTTPS only. |
| `expiresAt` | no | ISO 8601 UTC, later than `publishedAt`. |

So the release example below is valid without `priority` and `url`, and the non-release example is valid without `url`.

### Locales

Both `locales` and `releaseNotes.locales` are maps from a locale key to `{title, intro, sections}`:

- The map MUST contain at least `en-GB`, `nl-NL`, `de-DE` and `fr-FR`. Extra locale keys (for a language the app adds later) MAY appear and get the same checks, including [locale parity](#sections).
- `title` MUST be a non-empty string. It is plain text, see [Text and markup](#text-and-markup).
- `intro` MUST be a string and MAY be empty.
- `sections` MUST be an array, see [Sections](#sections).

Reader: pick the user's locale; when it is missing, fall back to the first key with the same language in the order the keys appear in the JSON (`nl-BE` to `nl-NL`), then to `en-GB`. Producers who add two locales of one language put the preferred fallback first.

### Release items

`releaseNotes` preserves the existing Skwirrel release-note file verbatim: `version` and `status` (required), `released_on` (see below), `icon` (optional; readers fall back to a default icon) and `locales` (required, see [Locales](#locales)).

- `version` MUST be a string matching `^[0-9]+\.[0-9]+\.[0-9]+$` (for example `2.3.0` or `2.1.10`), unique across release items. The item's `id` MUST be `release-<version>`. The reader keys releases by version, and the fixed id lets it match a feed item to the bundled file it falls back to.
- `version` MUST NOT change, because the `id` is derived from it and an id never changes. To renumber a release, remove the old item and add a new one at revision 1.
- `status` MUST be `upcoming` or `released`, also in a bare file.
- `icon`, when present, MUST match `^ph-[a-z0-9-]+$` (a Phosphor icon class), so a typo fails in CI instead of showing no icon.

**Bundled release-note files.** The same rules apply to the release-note files bundled with Skwirrel. A bundled file is a bare `releaseNotes` object: it has no `id`, `type` or `revision`, so those rules are skipped and the `released_on` rule below is applied by `status` alone. The v2 validator offers a mode that checks a single bare file or a directory of them, and Skwirrel CI runs it on its bundled files. Every release-note file that Skwirrel ships today MUST pass that mode unchanged.

For feed items, `type` and `releaseNotes.status` MUST agree. The validator rejects any other pairing:

| `type` | `releaseNotes.status` | `releaseNotes.released_on` |
|---|---|---|
| `upcoming` | `upcoming` | SHOULD be absent. Readers ignore it. |
| `release` | `released` | Required, `YYYY-MM-DD`, and a real calendar date (`2026-02-30` is rejected) |

When a release ships, `type`, `status` and `released_on` change in the same commit, and `revision` is bumped.

### Revision

`revision` drives the unread indicator, so producers MUST manage it as follows:

- A new item starts at `1`.
- Any change to content a reader sees MUST make it greater than the value on `main`: text in any locale (`title`, `intro`, `sections`), `type`, `releaseNotes.status`, `releaseNotes.released_on`, `releaseNotes.icon`, `priority` or `url`. Compare effective values: an absent `priority` equals `"normal"`, so adding or removing an explicit `"normal"` is no change. This includes correcting a typo, so readers see corrections. Bumping by 1 per PR is the convention, however many edits the PR holds.
- `publishedAt` and `expiresAt` change when an item is shown, not what it says, so they MAY keep the revision: moving an item's start or end does not mark it unread again.
- Key order and whitespace MAY keep it.
- It MUST never decrease and MUST never be reset.

The v2 validator compares each item against the same `id` on `main`: if a content field above changed and `revision` is not greater, the check fails. An item that is new on the branch MUST start at `1`. Removing an item needs no revision. Reader: treat an item as unread when the pair (`id`, `revision`) has not been seen.

For that comparison to hold, the repo MUST be set up so that:

- The CI workflow fetches `origin/main` explicitly (the default checkout has depth 1 and no `main`). On a pull request it compares against `origin/main`; on a push to `main` it compares against the state of `main` before the push (`github.event.before`), so a rebase-merge of several commits is checked as one change.
- Branch protection on `main` requires a pull request to be up to date with `main` before it merges. Otherwise two PRs can both bump an item from 1 to 2 and both pass, and readers who already saw (`id`, 2) never see the second change as unread.

The validator PR sets up both.

### Sections

Both `releaseNotes.locales.*.sections` and `locales.*.sections` are arrays of section objects. An empty array is allowed.

**This section is the single source of truth for section shapes**, for the feed and for the release-note files bundled with Skwirrel. It describes the shape those files already have, plus the `general` kind for other announcements. The Skwirrel documentation links here instead of keeping its own copy. A change to these shapes is a change to this contract: additive within `schemaVersion: 2`, otherwise a new schema version.

Every section has `kind` and `heading` (a non-empty string in the locale's language). The other fields depend on `kind`:

| `kind` | Used in | Fields |
|---|---|---|
| `action` | release items | `items` (required) |
| `new` | release items | `groups` (required) |
| `fixed` | release items | exactly one of `items` or `groups` |
| `integrators` | release items | `text` (required), `table` (required) |
| `general` | other announcements | `text` and/or `items`, at least one |

Producer: a section's `kind` MUST be allowed for its item, per the *Used in* column, so a `general` section in a release item fails. Release items SHOULD use the kinds in the order listed, each at most once; the validator warns but does not fail. Other announcements normally have one `general` section.

Unknown kinds and fields:

- Producer: the validator rejects a `kind` not in this table, and a field not listed for its kind.
- Reader: MUST render a section with an unknown `kind` generically (its `heading`, `text`, `items`, `groups` and `table`, where present) instead of dropping it, and ignore unknown fields. That keeps adding a kind non-breaking for apps already in the field.

Building blocks:

- **item**: a non-empty string, or `{"title": "Bold lead.", "text": "The rest."}`. In the object form both keys MUST be present; either string may be empty (a lead-only or text-only item), but not both.
- **group**: `{"title": string, "text"?: string, "items"?: item[]}`. At least one of `text` or `items`.
- **table**: `{"columns": string[], "rows": string[][]}`. Every row has exactly as many cells as `columns`.
- `items`, `groups`, `columns` and `rows` MUST be non-empty arrays when present.
- Section `text` and group `text` MUST be non-empty strings when present.

Locale parity: every locale MUST have the same sections in the same order, with the same `kind`s, the same number of groups, items, columns and rows as `en-GB`. This matches the parity check Skwirrel already runs on its bundled files, plus columns.

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

### Text and markup

Text fields come in two kinds:

| Kind | Fields | Rendering |
|---|---|---|
| Plain text | locale `title`, section `heading`, group `title`, table `columns` | Shown as typed. No markup. |
| Inline markup | locale `intro`, section `text`, group `text`, item strings and item `title`/`text`, table cells | `` `code` ``, `**bold**` and `*italic*` only |

Definitions, so every implementation agrees:

- A **code span** is a match of `` `[^`]+` ``. Its content is shown literally, without bold or italic.
- An **HTML tag** is a match of `<\/?[a-zA-Z!]` outside a code span. That is the v1 pattern, with code spans exempt.
- **Bold** and **italic** are applied outside code spans, bold first, with exactly these patterns: bold `\*\*(.+?)\*\*`, then italic `(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])`. Any `*` left over is shown as typed. These are the patterns Skwirrel's reader uses today; a reader in another language MUST produce the same result.
- A **link** is a match of `](` outside a code span. v2 has no inline links, unlike the v1 `body`: an item links out through its `url` field.

Producer: the validator rejects HTML tags and links in every text field, and warns on `` ` `` or `*` in a plain-text field. Reader: MUST escape everything it does not render as markup, so HTML is shown as typed.

### Examples

Example release item:

```json
{
  "id": "release-9.9.0",
  "type": "upcoming",
  "publishedAt": "2026-10-12T10:00:00Z",
  "revision": 1,
  "releaseNotes": {
    "version": "9.9.0",
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
2. Add the v2 validator for every producer rule above, including the bare-file mode for bundled release notes, the `origin/main` fetch in CI and branch protection on `main`. Run the bare-file mode in Skwirrel CI.
3. Publish the v2 feed document from GitHub Pages as `feed-v2.json`, next to the v1 `feed.json`. Make the URL configurable.
4. Skwirrel backend should fetch with a short timeout and cache last-known-good data, sanitize rendered inline markup, and fall back to bundled release notes on failure. Reader rules:
   - Reader: a feed that is not valid JSON, has another `schemaVersion`, or has a missing or invalid `updatedAt` or `announcements`, MUST be ignored as a whole; keep last-known-good.
   - Reader: an item missing a required field, with a field of the wrong type or outside its allowed values, or with a `type`/`status` mismatch, MUST be skipped on its own; the rest of the feed is shown. Unknown fields and unknown section kinds are not errors (see above). Reviewer and revision rules are not checked by the reader.
   - Reader: MUST hide an item before its `publishedAt` and after its `expiresAt`. For release items, hiding the feed item also hides the bundled release note for that version, so `expiresAt` means the same for both.
5. Flyout: show latest announcements alongside upcoming and recent releases, with a single unread indicator based on announcement IDs and revisions. Page: retain existing release tabs and add an announcements view.
6. Keep version-specific release notes accurate for the installed tenant. Filter releases newer than the tenant version or clearly label them as upcoming. Do not imply an unreleased feature is already available.
7. Once integration is verified, migrate historical release JSON files and retire the duplicated source in a separate PR.

Tenant-specific announcements, personalized targeting and administration UI are phase two.
