# Proposal

## Why

Notes can link to other notes, but not to folders. Project notes often want to point at a whole area ("details in the App-Launch folder"), and Janus already has a good destination for that: the Folder Overview with all notes, folder tasks and an AI summary. Today `[[projects/App-Launch]]` counts as a broken link, and clicking it offers to create a note `App-Launch.md`.

Note: this is different from the existing `Ordner verknüpfen` command (`janus.addLinkedFolder`), which adds external folders to the Notes view.

## What Changes

- **Folder links in notes:** `[[projects/App-Launch/]]` and `[App-Launch](projects/App-Launch/)` resolve to folders. A trailing `/` always means a folder; without it, a note with that path or name wins and a folder is used only when no note matches. Folder paths resolve relative to the note, the notes root and the workspace folder, like note paths.
- Clicking a folder link opens the Folder Overview for that folder and reveals it in the Notes view. A link to a missing folder shows a message instead of offering to create a note.
- `[[` autocomplete also suggests folders (folder icon, inserted with a trailing `/`).
- The note footer lists outgoing folder links with a folder icon; clicking opens the Folder Overview.
- Renaming or moving a folder rewrites links to that folder, like links to notes inside it.
- **Folder Overview:** a new section `Verlinkt von` lists the notes linking to the folder, with the line of the link; clicking opens the note at that line.
- **Note graph:** folders that at least one note links to appear as their own node type (distinct shape and icon), with edges from the linking notes. Clicking a folder node opens the Folder Overview; the graph search finds folders.

Non-goals: edges from a folder to the notes it contains ("Ordnerstruktur anzeigen"), links to folders outside the workspace, folder aliases.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `note-linking`: folder links (resolution, opening, autocomplete, footer, rename).
- `folder-overview`: notes linking to the folder.
- `note-graph`: folder nodes for linked folders.

## Impact

- `src/services/noteLinkService.ts`: folder resolution in `resolveOutgoingLink` (`kind: 'folder'` on `NoteLinkItem`), `findFolderBacklinks`.
- `src/editors/markdownEditorProvider.ts`: `openLink` opens the Folder Overview for folders.
- `src/companion/noteLinking.ts`, `src/webviews/markdown/extensions/linkAutocomplete.ts`: folder candidates.
- `src/webviews/markdown/components/NotesLinksFooter.tsx`: folder icon.
- `src/services/linkRewriteService.ts`: folder targets on folder rename.
- `src/editors/folderOverviewViewProvider.ts` and its webview: `Verlinkt von`.
- `src/services/noteGraphService.ts` and the graph webview: folder nodes.
- No new settings or dependencies.
