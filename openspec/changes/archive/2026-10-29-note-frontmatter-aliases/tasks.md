# Tasks

## 1. Parser and metadata cache

- [x] 1.1 Create `src/services/noteMetadataService.ts` with `parseFrontmatter(text)` returning `title`, `aliases`, `tags` and `bodyStart`; verify with unit tests for every scenario of "Frontmatter Block Recognition" and "Title, Aliases, and Tags Keys" (BOM, `...` close, unclosed, horizontal rule later, inline/block lists, quotes, singular keys, tag string splitting and `#` removal, comments, unknown keys)
- [x] 1.2 Add `getNotesMetadata(uris)` with an mtime-keyed cache and `buildAliasIndex(entries)` (first note per lower-cased alias in scan order); verify with tests that an unchanged note is not re-read, a changed one is, and a duplicate alias maps to the first note

## 2. Link resolution

- [x] 2.1 Add the optional alias-index parameter to `resolveOutgoingLink` and resolve wiki-links (only) via it after the file-name match; verify with tests for the alias, file-name-wins, line-suffix and Markdown-ignores-alias scenarios in `tests/noteLinkService.test.ts`
- [x] 2.2 Pass the alias index in `getNoteLinksData` and in the link click handler of `markdownEditorProvider.ts`; verify with a test that the footer data marks `[[API]]` as existing and with a test that clicking it opens the aliased note
- [x] 2.3 Extend `doesLinkMatchTarget` and `findBacklinks` with the target's aliases (excluding links that resolve elsewhere by path or name); verify with the backlinks-via-alias scenario test including the origin line
- [x] 2.4 Verify with a test in `tests/notesFileCommands.test.ts` that renaming an aliased note leaves `[[API]]` unchanged and it still resolves afterwards (no change to `linkRewriteService.ts` expected)

## 3. Graph, search and autocomplete

- [x] 3.1 In `buildNoteGraph`, parse frontmatter from the text it already reads, use the title as node label, add `aliases` to the node, build the alias index and pass it to resolution; verify with tests for the label and edge-via-alias scenarios in `tests/noteGraphService.test.ts`
- [x] 3.2 Make `filterGraph` match aliases; verify with the searching-by-alias test in `tests/noteGraphFilter.test.ts`
- [x] 3.3 In `JanusSearchService.searchWorkspace`, use the frontmatter title as result title and score aliases as title text; verify with both scenarios of "Frontmatter Title and Aliases in Search" in `tests/janusSearchService.test.ts`
- [x] 3.4 Add alias and title candidates (`matchedBy`) to `findLinkCandidatesAcrossRoots` and show the hint in `linkAutocomplete.ts`; verify with tests that an alias candidate inserts `[[API]]` and a title candidate inserts the file-based link (`tests/linkAutocomplete.test.ts`)

## 4. Wrap-up

- [x] 4.1 Run `npm test`, `npm run compile` and `npm run build` and verify all succeed
- [x] 4.2 Manually add `title` and `aliases` to a sample note, link to it via an alias, and check the footer, backlinks, graph label, search result and autocomplete show it as specified
