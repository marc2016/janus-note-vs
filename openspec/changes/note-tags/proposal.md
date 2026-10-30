# Proposal

## Why

Folders give every note exactly one place, but many notes belong to several topics at once (a meeting note that is also about `#budget` and `#backend`). Janus has no way to group notes across folders except links, so users cannot answer "show me everything about X" without a full-text search that also finds every passing mention. Inline `#tags` are the common answer in Markdown note tools, and many users already write them out of habit, but Janus treats them as plain text.

## What Changes

- Janus recognizes inline tags (`#backend`, `#projekt/alpha`) in note text and the `tags` frontmatter key (from `note-frontmatter-aliases`). Tags are compared case-insensitively. A tag `projekt/alpha` also belongs to its parent `projekt`.
- `#` in headings, links, URLs, code, and the frontmatter block is not a tag. Pure numbers (`#1`) are not tags.
- **Graph:** a tag selector in the graph panel shows only notes with the selected tag (and the edges among them).
- **Sidebar:** a pinned `Tags` entry, below `Netzwerk`, lists all tags with their note counts. Each tag expands to its notes.
- **Search:** `#tag` in a search query (Janus search and the chat's `/search`) restricts results to notes with that tag. Words in the query that match a note's tag count like a heading match.
- **Editor:** tags are highlighted in the Markdown editor's live preview.

Non-goals (possible follow-ups): tag nodes in the graph, renaming or merging a tag across all notes, tag autocomplete while typing `#`, clicking a tag in the editor to filter, a hierarchical tag tree in the sidebar, and tags on `tasks.json` entries.

## Capabilities

### New Capabilities

- `note-tags`: recognizing inline and frontmatter tags and indexing which notes carry which tags.

### Modified Capabilities

- `note-graph`: new tag filter.
- `notes-sidebar`: new pinned `Tags` entry.
- `ai-note-search`: `#tag` query filter and tag scoring.
- `markdown-editor`: tag highlighting in the live preview.

## Impact

- New `src/services/noteTagService.ts` (inline tag scanner and tag index over all roots).
- Depends on `note-frontmatter-aliases` (`parseFrontmatter`, its `tags` and `bodyStart`, and the metadata cache). Implement after it.
- Reuses `findLinkOccurrences` (link ranges) and its code-range logic from `noteLinkService.ts`.
- `src/services/noteGraphService.ts` and `src/webviews/noteGraph/*` (tags on nodes, selector, filter).
- `src/ui/notesTreeDataProvider.ts` (new tree items), `src/services/janusSearchService.ts`, `src/webviews/markdown/extensions/livePreview.ts` and `globals.css`.
- No new dependencies, no new settings.
