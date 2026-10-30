# Design

## Context

- `note-frontmatter-aliases` provides `parseFrontmatter` (with `tags` and `bodyStart`) and the mtime-keyed metadata cache in `noteMetadataService.ts`. This change builds on both.
- `noteLinkService.ts` contains `findLinkOccurrences` and the private code-range detection (fenced blocks, inline code). The file imports `vscode`, so the Markdown editor webview cannot import it.
- `tokenizeSearchQuery` strips `#`, so a tag filter has to be split off the query before tokenizing.
- The sidebar's pinned entries (`Alle Aufgaben`, `Kalender`, `Notiz-Netzwerk`) are built in `NotesTreeDataProvider.getChildren` for the root.
- The graph webview keeps its filter in `getState()` and filters in `graphFilter.ts`.

## Goals / Non-Goals

**Goals:**
- One tag definition, used by the extension host (index, graph, sidebar, search) and the editor webview (highlighting), so they never disagree.

**Non-Goals:**
- Live updates of the sidebar on every keystroke. The tree updates on its existing refreshes.

## Decisions

### 1. A pure scanner module shared by host and webview

Move the code-range detection, `findLinkOccurrences` and the pure helper it depends on (`parseLinkTargetAndLine`, plus the external-protocol regex) into a new file `src/services/markdownScan.ts` with no `vscode` import. `noteLinkService.ts` re-exports both from there, so callers and tests don't change. The same module gets `findInlineTags(text, { bodyStart })`, returning `{ tag, start, end }[]`:

```
text --> code ranges (fences, inline code)
     --> link ranges (wiki, Markdown, images)   --> excluded
     --> [0, bodyStart) frontmatter             --> excluded
     --> /(^|\s)#([\p{L}\p{N}_/-]+)/gu
           strip trailing / and -, require \p{L}
```

The webview's live preview imports the module through esbuild, so highlighting uses exactly the same rules as the index.

*Alternative considered:* CodeMirror's syntax tree for code and link detection in the editor. That would be a second definition, which can disagree with the index in edge cases (for example how unclosed fences are handled).

### 2. Tag index on top of the metadata cache

`noteTagService.ts` exposes `getTagIndex(roots)`. It lists all notes from all roots, and per note combines the frontmatter tags with `findInlineTags` of the body. The per-note tag list is stored in the same mtime-keyed cache entry as the frontmatter (the metadata cache gets an `inlineTags` field), so unchanged notes are not re-read. The index:

- `tags: Map<lowerTag, { display, notes: Uri[] }>`, where `display` is the most frequent spelling (alphabetically first on a tie)
- `notesWithTag(tag)`: notes whose lower-cased tags contain `tag` or start with `tag/`

### 3. Graph: tags on nodes, filter in the webview

`buildNoteGraph` already reads every note. It adds `tags: string[]` (lower-cased, with parents expanded, so `projekt/alpha` gives `projekt` and `projekt/alpha`) to each note node and sends the sorted list of display names with the graph data. `GraphFilterOptions` gets `tag: string | null`, persisted with the other filter state. `filterGraph` drops ghosts and nodes without the tag before the search and orphan logic run. The selector is a native `<select>` styled like the existing search field.

### 4. Sidebar: three new tree item classes

`TagsRootTreeItem` (collapsed, `description` = tag count), `TagTreeItem` (`description` = note count), and the existing `NoteTreeItem` for the notes (so the context menu and the open command behave as everywhere else). `getChildren` for the root calls `getTagIndex` and adds the root item after `NoteGraphTreeItem` only if there are tags.

### 5. Search: split tag filters before tokenizing

`searchWorkspace` extracts `#word` tokens with the same tag character class first, lower-cases them, and tokenizes the rest as today. Notes are pre-filtered by `notesWithTag` for every tag filter. If no keyword tokens remain, all filtered notes are returned, sorted by title, bounded by `maxNotes`. In the scoring loop, each keyword token equal to one of the note's tags adds 6 (the heading weight). The chat's `/search` calls the same method, so it needs no change.

### 6. Editor highlighting

A `ViewPlugin` in `livePreview.ts` runs `findInlineTags` on the full document when the document changes (notes are small, and the result is cached per document version), and adds `Decoration.mark({ class: 'cm-janus-tag' })` for the ranges in the visible viewport. `globals.css` styles `.cm-janus-tag` with VS Code theme variables (`--vscode-textLink-foreground` on a translucent background), so it works in light and dark themes.

## Risks / Trade-offs

- [Moving the scanner could subtly change `findLinkOccurrences`] → It is a pure move with a re-export. The existing `linkOccurrences.test.ts` and `linkRewriteService.test.ts` must pass unchanged.
- [False positives such as `#ff0000` in plain text] → It contains letters, so it counts as a tag. That is accepted and consistent with other note tools. Code spans are the documented way to avoid it.
- [Sidebar tag index costs a scan on every tree refresh] → The mtime cache means only changed notes are read. The root `getChildren` already counts tasks and calendar entries across the collection on every refresh.
- [Depends on `note-frontmatter-aliases`] → Implement after it. Without it, only inline tags would work.
