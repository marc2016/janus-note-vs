# Tasks

## 1. Resolution and opening

- [x] 1.1 Add folder resolution to `resolveOutgoingLink` (`kind` on `NoteLinkItem`, trailing `/` forces folder, folder fallback after note candidates, missing-folder result); verify with tests for "Note wins without trailing slash", "Folder without trailing slash", a slash target relative to the note and to the root, and a missing folder
- [x] 1.2 Open the Folder Overview and reveal the folder for folder links in `openLink`, with the missing-folder message instead of note creation; verify with tests for "Opening a folder link" and "Missing folder"

## 2. Editor

- [x] 2.1 Add folder candidates to `findLinkCandidatesAcrossRoots` and show them in `linkAutocomplete` (folder icon, trailing `/`, ignore rules); verify with tests for "Autocomplete suggests folders" and that dot folders and `assets` are not suggested
- [x] 2.2 Pass `kind` through `getNoteLinksData` and show folder items with a folder icon in `NotesLinksFooter`; verify with a footer render test for "Footer shows folder links"

## 3. Rename

- [x] 3.1 Rewrite folder-targeted links in `linkRewriteService` when the folder (or a parent) is renamed or moved, keeping the trailing `/`; verify with tests for "Renaming a linked folder", a moved parent folder, and that note links are unaffected

## 4. Folder Overview

- [x] 4.1 Add `findFolderBacklinks` and the `Verlinkt von` section (host message, webview list, open at line, hidden when empty or for multi-selections); verify with tests for "Folder with backlinks", "Opening a linking note" and "Folder without backlinks"

## 5. Graph

- [x] 5.1 Add folder nodes and edges in `noteGraphService` (only existing, linked folders), render them distinctly, open the Folder Overview on click, and match them in `graphFilter`; verify with tests for "Linked folder in the graph", "Unlinked folders stay hidden", "Opening a folder from the graph" and "Searching folders"

## 6. Wrap-up

- [x] 6.1 Run `npm test`, `npm run compile` and `npm run build` and verify all succeed
- [x] 6.2 Manually check: link a folder with and without trailing `/`, use autocomplete, click the link and the footer item, open the Folder Overview's `Verlinkt von`, find the folder in the graph, rename the folder and check the link
