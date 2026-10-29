# Design

## Context

- No YAML library is a dependency. The only frontmatter reader is a regex in `calendarService.ts` that extracts `date:`.
- Link resolution is `resolveOutgoingLink` (path from source folder, notes root, workspace folder, then file-name match). `doesLinkMatchTarget` answers the reverse question for backlinks. `buildNoteGraph` and `findBacklinks` already read every note's text, while `getNoteLinksData` (footer) gets only URIs for outgoing resolution.
- `linkRewriteService.ts` (rename link updates) mirrors the resolver's order in memory over the scanned note list.
- Link autocomplete candidates come from `findLinkCandidatesAcrossRoots` (file listing only, no content), and CodeMirror filters them by `label` in `linkAutocomplete.ts`.

## Goals / Non-Goals

**Goals:**
- One parser and one cached metadata source that every feature uses.
- Alias resolution is a strict extension: every link that resolves today resolves to the same note afterwards.

**Non-Goals:**
- Full YAML support (anchors, multi-line strings, nested maps).

## Decisions

### 1. Small hand-written parser instead of a YAML library

`parseFrontmatter(text): { title?: string; aliases: string[]; tags: string[]; bodyStart: number }` handles exactly what the spec lists: the `---` / `---|...` fence, `key: value` lines, quoted strings, inline lists, and `- item` block lists below a key. Lines starting with `#` (YAML comments) and unknown keys are skipped. `bodyStart` is the offset after the closing fence, so `note-tags` can skip the block when scanning inline tags.

*Alternative considered:* the `yaml` package. It is correct for every edge case, but it adds about 100 kB to the extension bundle and needs error handling for strict parse failures. Three keys don't justify that. If more keys are needed later, the parser can be swapped behind the same function.

### 2. Metadata cache keyed by modification time

`noteMetadataService.ts` keeps `Map<fsPath, { mtime, metadata }>`. `getNotesMetadata(uris)` stats each note, re-reads and re-parses only notes whose `mtime` changed, and drops entries for notes that no longer exist. Callers that already have a note's text (graph build, backlink scan) call `parseFrontmatter` directly instead.

From the metadata it builds an `AliasIndex`: `Map<lowerAlias, Uri>` in scan order, first note wins.

*Alternative considered:* invalidating from file watchers. That needs wiring in `extension.ts` and still misses edits made outside VS Code while it was closed. The stat-based check is self-contained, and `findBacklinks` already reads every note on each footer refresh, so the extra stats are small in comparison.

### 3. Alias step as the last resolver candidate

`resolveOutgoingLink(link, source, root, workspaceNotes, aliasIndex?)` gets an optional fifth parameter. Only for `link.type === 'wiki'`, after the file-name match fails, it looks up the cleaned target (without suffix) in the alias index. Callers that pass no index behave exactly as today.

`doesLinkMatchTarget(link, source, target, roots, targetAliases?)` gets the target's aliases. A wiki-link matches if its cleaned target equals one of them case-insensitively *and* it does not resolve to another note by path or name. `findBacklinks` reads the target note's aliases from its text once, and for the "does not resolve elsewhere" check reuses the note list it has already scanned.

Updated callers: `getNoteLinksData` (footer), `buildNoteGraph` (parses each note's frontmatter while reading it, so no extra reads), and the link click handler in `markdownEditorProvider.ts`.

The rename planner in `linkRewriteService.ts` is deliberately **not** changed. An alias link does not resolve to the renamed note by path or name, so the planner never touches it, and the alias still resolves after the rename, which is the spec's "Renaming a note keeps alias links" scenario. A rewritten name-based link always wins over aliases because the alias step comes last.

### 4. Autocomplete: one extra entry per alias and title

`LinkCandidate` gets optional `matchedBy?: 'alias' | 'title'`. `findLinkCandidatesAcrossRoots` adds, for each note with metadata, one candidate per alias (`label: alias`, `insertText: alias`, `relPath` of the note) and one for a title that differs from the file name (`label: title`, `insertText` same as the file entry). CodeMirror's existing label filter then matches them without changes to the filtering. The webview shows `matchedBy` as a small hint next to the path.

*Alternative considered:* a custom filter function on one entry per note. More code in the webview and loses CodeMirror's ranking.

### 5. Titles in graph and search

- `GraphNode` gets `aliases?: string[]`, and `title` uses the frontmatter title. `filterGraph` also matches aliases.
- `JanusSearchService.searchWorkspace` uses `title ?? h1 ?? fileName`, and appends the aliases to the text it scores as title. The frontmatter block is excluded from the body text it scores, so an alias or title is not counted a second time as a body match.

## Risks / Trade-offs

- [Our parser accepts something real YAML would reject, or the reverse] → Only the three keys matter, and the tests cover the common forms from Obsidian and other editors. Anything else is ignored rather than wrong.
- [Two notes claim the same alias] → First in scan order wins, the same rule as duplicate file names today. No warning for now. `repair-broken-links` could list duplicates later.
- [An alias equals another note's file name] → The file name wins (the alias step is last), so existing links never change meaning.
- [Cost of the alias index on every footer refresh] → mtime cache, so only changed notes are re-read. The cost is comparable to the backlink scan that already happens.
