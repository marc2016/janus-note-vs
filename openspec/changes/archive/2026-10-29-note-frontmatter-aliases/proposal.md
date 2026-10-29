# Proposal

## Why

A note's file name is its only identity in Janus today: links must use it, the graph and search show it, and a note cannot be reached under a second name. Users who write `[[API]]` but named the note `rest-schnittstelle.md`, or who want a readable title for `2026-10-29-sync.md`, have no option except renaming the file. YAML frontmatter (`title`, `aliases`, `tags`) is the common way other Markdown note tools solve this, so notes moved into Janus often already have it. Janus only reads `date:` from it (calendar) and ignores the rest.

## What Changes

- Janus reads a YAML frontmatter block at the very start of a note (`---` … `---`) and recognizes three keys: `title`, `aliases` (also `alias`), and `tags` (also `tag`). Values can be plain or quoted strings, inline lists (`[a, b]`) or block lists (`- a`). Other keys are ignored. A malformed block is ignored without an error.
- **Aliases resolve wiki-links:** `[[API]]` resolves to a note whose frontmatter lists `API` as an alias, when no note is found by path or file name first. This applies everywhere links resolve: footer, backlinks, graph, link clicks, and the rename link updater.
- **Link autocomplete** also finds notes by title and alias and inserts `[[<alias>]]` when an alias was matched.
- **Title** from frontmatter is used as the node label in the graph and as the result title in search, instead of the file name or first heading.
- `tags` are parsed and exposed for `note-tags`, which defines how they are shown and filtered. This change only makes them available.
- The `#` characters inside a frontmatter block are not treated as inline tags or links by later features.

Non-goals (possible follow-ups): editing frontmatter through a form in the editor, hiding or styling the frontmatter block in the live preview, showing the frontmatter title in the sidebar tree, using aliases in Markdown links (`[x](API.md)`), and moving the calendar's `date:` parsing onto the new parser.

## Capabilities

### New Capabilities

- `note-frontmatter`: recognizing a note's frontmatter block and reading `title`, `aliases` and `tags` from it.

### Modified Capabilities

- `note-linking`: wiki-links resolve via aliases as the last resolution step, backlinks include alias links, and autocomplete matches titles and aliases.
- `note-graph`: node labels use the frontmatter title.
- `ai-note-search`: result titles use the frontmatter title, and titles and aliases are scored like titles.

## Impact

- New `src/services/noteMetadataService.ts` (frontmatter parser plus a per-note metadata cache keyed by modification time).
- `src/services/noteLinkService.ts`: `resolveOutgoingLink`, `doesLinkMatchTarget`, `findBacklinks`, `getNoteLinksData` take aliases into account.
- `src/services/noteGraphService.ts`, `src/services/janusSearchService.ts`, `src/companion/noteLinking.ts` (link candidates), and the link click handler in `src/editors/markdownEditorProvider.ts`.
- `src/services/linkRewriteService.ts` stays alias-unaware: alias links never point at a file name, so renames do not affect them.
- No new dependencies, no new settings.
