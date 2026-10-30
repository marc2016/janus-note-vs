# Tasks

## 1. Shared scanner

- [x] 1.1 Move the code-range detection, `findLinkOccurrences` and `parseLinkTargetAndLine` into `src/services/markdownScan.ts` (no `vscode` import) and re-export it from `noteLinkService.ts`; verify `tests/linkOccurrences.test.ts` and `tests/linkRewriteService.test.ts` pass unchanged
- [x] 1.2 Add `findInlineTags(text, { bodyStart })` to `markdownScan.ts`; verify with unit tests for every scenario of "Inline Tag Recognition" (text tags, non-tags, code/frontmatter, umlauts and trailing punctuation)

## 2. Tag index

- [x] 2.1 Store inline tags in the metadata cache entry and add `src/services/noteTagService.ts` with `getTagIndex(roots)` (union with frontmatter tags, case-insensitive keys, most-frequent display spelling, `notesWithTag` including `tag/` children); verify with unit tests for every scenario of "Note Tag Set"

## 3. Graph

- [x] 3.1 Add expanded lower-cased `tags` to note nodes and the sorted tag list to the graph data in `buildNoteGraph`; verify with a test in `tests/noteGraphService.test.ts`
- [x] 3.2 Add `tag` to `GraphFilterOptions` and `filterGraph` (ghosts hidden while a tag is selected); verify with tests in `tests/noteGraphFilter.test.ts` for the filter, parent-tag and combined-with-search scenarios
- [x] 3.3 Add the tag selector (`Alle Tags` plus tags) to `NoteGraphApp.tsx`, persisted in the webview state; verify with `npm run build` and by selecting a tag and reopening the hidden panel

## 4. Sidebar

- [x] 4.1 Add `TagsRootTreeItem` and `TagTreeItem`, list them in `NotesTreeDataProvider.getChildren` after `NoteGraphTreeItem` only when tags exist, and list `NoteTreeItem`s under each tag; verify with tests in `tests/notesTreeDataProvider.test.ts` for the listing, no-tags and opening scenarios

## 5. Search

- [x] 5.1 Split `#tag` filters off the query in `searchWorkspace`, pre-filter notes, handle tag-only queries (ordered by title, bounded by `maxNotes`), and add the heading weight for keyword tokens that equal a tag; verify with tests in `tests/janusSearchService.test.ts` for the restricting, tag-only and keyword-matching-a-tag scenarios
- [x] 5.2 Verify with a test in `tests/chatViewProvider.test.ts` that `/search #backend` returns only tagged notes as source cards

## 6. Editor

- [x] 6.1 Add a tag-highlighting `ViewPlugin` to `livePreview.ts` using `findInlineTags` (cached per document version, decorations in the viewport) and the `.cm-janus-tag` style in `globals.css`; verify with a test in `tests/markdownEditor.test.ts` that `#backend` gets the class and `# Überschrift` and `` `#backend` `` do not

- [x] 6.2 Send the collection's tags with counts to the editor (`updateTagCandidates`) and add a `#` completion source (`tagAutocomplete.ts`) that opens right after `#` and skips headings, code and frontmatter; verify with tests in `tests/tagAutocomplete.test.ts`

## 7. Wrap-up

- [x] 7.1 Run `npm test`, `npm run compile` and `npm run build` and verify all succeed
- [x] 7.2 Manually tag a few sample notes (inline and frontmatter, one nested tag) and check the editor highlighting and `#` suggestions, the sidebar `Tags` entry, the graph tag filter and a `#tag` search in the chat
