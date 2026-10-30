# Design

## Context

- `resolveOutgoingLink` (`noteLinkService.ts`) appends `.md` to extension-less targets (`ensureNoteExtension`) and tries: relative to the note, notes root, workspace folder, basename across notes, then frontmatter alias. Unresolved targets fall back to a non-existing note URI next to the source; `openLink` in `MarkdownEditorProvider` then offers to create the note.
- `NoteLinkItem` has no notion of kind; the footer and backlinks treat every target as a note.
- `findLinkCandidatesAcrossRoots` (`noteLinking.ts`) builds autocomplete candidates with `fileType: 'note' | 'task' | 'chart' | 'image' | 'pdf' | 'file'`.
- `linkRewriteService` plans rewrites for links whose target note is renamed or lies inside a renamed folder; it resolves targets in memory with the same order as `resolveOutgoingLink`.
- `janus.openFolderOverview` accepts a `vscode.Uri`; `FolderOverviewViewProvider` renders a single folder or a multi-selection. `noteGraphService` builds nodes from notes and edges from resolved links, with ghost nodes for unresolved targets.

## Goals / Non-Goals

**Goals:**
- One place decides whether a link target is a note or a folder; every feature (click, footer, backlinks, graph, rename) uses it.

**Non-Goals:**
- Folder links outside the workspace or notes roots.

## Decisions

### 1. Resolution: notes first, then folders

`resolveOutgoingLink` gets a folder step:
- Target ends with `/` → skip all note candidates; try the folder relative to the note, the notes root, the workspace folder (`stat` → `Directory`). Result: `{ kind: 'folder', exists, uri, relativePath (with trailing /), title: folder name }`. If none exists → `kind: 'folder', exists: false`.
- Otherwise → existing note candidates unchanged (path, basename, alias). Only if none matches, try the same three folder locations without `.md`; a hit returns `kind: 'folder'`. Otherwise the existing note fallback.

`NoteLinkItem.kind?: 'note' | 'folder'` (absent = note), so existing consumers keep working.

*Alternative considered:* a separate folder-link syntax (e.g. `[[folder:...]]`). Not portable to other Markdown tools; the trailing slash is a common convention.

### 2. Opening

`openLink` checks `resolved.kind === 'folder'`: existing → `janus.openFolderOverview` with the folder URI, then `janus.revealInNotesTree` (or the existing reveal used by `scheduleSyncSidebarSelection`) for the folder; missing → `Der Ordner "<path>" existiert nicht.` and return. The note-creation prompt is skipped for folder targets.

### 3. Autocomplete

`findLinkCandidatesAcrossRoots` additionally collects directories of the primary notes root (same ignore rules as notes: dot folders, `node_modules`, `assets`), as `fileType: 'folder'`, `insertText: '<relPath>/'`, `label: <folder name>/`. `linkAutocomplete` shows a folder icon and the path as detail. Folders are ranked after notes with the same score.

### 4. Footer

`getNoteLinksData` passes `kind` through; `NotesLinksFooter` shows `mdiFolderOutline` for folder items and posts `openLink` with the folder target as today (the host opens the overview).

### 5. Folder backlinks

`findFolderBacklinks(folderUri, roots)` scans notes with `findLinkOccurrences` (line numbers included) and keeps links whose resolution is `kind: 'folder'` with that URI. `FolderOverviewViewProvider` calls it for single-folder views and sends `folderBacklinks: [{ title, uri, line }]`; the webview renders `Verlinkt von` and posts `openNote` with the line.

### 6. Rename

In `linkRewriteService`, a link whose in-memory resolution is a folder (trailing `/`, or a known folder without a matching note) is rewritten when the renamed folder equals the target or contains it: the target path's prefix is replaced and the trailing `/` style is kept. The in-memory resolver gets the list of folders (collected once per plan from the roots).

### 7. Graph

`noteGraphService` resolves links with `kind`; folder targets that exist become nodes `{ id: 'folder:<relPath>', kind: 'folder', title: <name>, relativePath: '<relPath>/', group: <top folder> }`, with edges from the linking notes. Missing folder targets are dropped (not ghost nodes). The graph webview draws folder nodes as rounded squares with a folder glyph; clicking posts `openFolder`, which the panel provider maps to `janus.openFolderOverview`. `graphFilter` matches folder titles and paths. Degree counts include folder edges.

## Risks / Trade-offs

- [A note and a folder share a name] → Without trailing `/` the note wins, as today; users write the slash to reach the folder. Autocomplete always inserts the slash.
- [Extra `stat` calls during resolution] → Only after all note candidates failed, or for slash targets.
- [Folder rename plan cost] → Folder list is collected once per rename plan.
