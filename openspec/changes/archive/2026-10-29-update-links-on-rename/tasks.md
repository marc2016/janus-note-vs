# Tasks

## 1. Link occurrence scanning

- [x] 1.1 Add `findLinkOccurrences(text)` to `src/services/noteLinkService.ts` that returns every wiki-link and Markdown link (no images) with the offset range of its target part and the parsed target, alias/label and suffix; verify with unit tests for `[[a]]`, `[[a|b]]`, `[[a#L3]]`, `[[a:3]]`, `[t](a.md#x)`, `[t](./a.md)` and repeated links
- [x] 1.2 Skip fenced code blocks (backticks and tildes) and inline code spans in `findLinkOccurrences`; verify with a unit test where the same link appears in a paragraph, a fenced block and inline code and only the paragraph occurrence is returned

## 2. Rewrite planning

- [x] 2.1 Create a link rewrite module (e.g. `src/services/linkRewriteService.ts`) with a pure function that builds the new target for one occurrence from the original target, the base it resolved against, the old/new target path and the old/new source path; verify with unit tests covering every row and "kept" item of design decision 3
- [x] 2.2 Implement plan building for a note rename: scan all notes from all roots, resolve each occurrence with an in-memory resolver that mirrors `resolveOutgoingLink`'s candidate order over the scanned note list, keep only those that resolve to the renamed note, and drop identical rewrites; verify with tests for the wiki, relative Markdown, same-name-unrelated-note and already-broken scenarios from the spec
- [x] 2.3 Extend plan building to folder renames (targets inside the folder, sources inside the folder mapped to their new paths); verify with tests for the folder-rename and basename-unchanged scenarios
- [x] 2.4 Add the verification step that re-resolves each new target against the post-rename note list and falls back to a notes-root-relative path, or skips the occurrence; verify with a test for the ambiguous-basename scenario

## 3. Rename command integration

- [x] 3.1 In `renameItemCommand`, build the plan after the name prompt and the existence check and before `fs.rename`; when the prompt is cancelled or the rename throws, apply nothing; verify with tests in `tests/notesFileCommands.test.ts` for cancel and failed rename
- [x] 3.2 Apply the plan after the rename (and companion renames): re-read each affected source from its open document or from disk, re-scan, build one `WorkspaceEdit`, apply it, and save only documents that were not dirty before; verify with tests that an unopened note is updated on disk and a dirty open document keeps its unsaved text
- [x] 3.3 Handle links inside the renamed note itself and inside notes of a renamed folder by applying their edits to the new URIs; verify with the self-link scenario test
- [x] 3.4 Show the result message (`N Links in M Notizen aktualisiert`, plus a note about skipped links or failed notes when applicable) only when something was rewritten or failed; verify with tests for the message text and for no message when nothing changed

## 4. Wrap-up

- [x] 4.1 Extend `tests/__mocks__/vscode.ts` only as far as needed (`WorkspaceEdit.replace`, `applyEdit`, `TextDocument.isDirty`, `save`) and verify `npm test` passes
- [x] 4.2 Manually rename a note and a folder in a sample collection with links from the root, a subfolder and an included folder, then check the footer, backlinks and graph show no new missing links; verify `npm run compile` succeeds
