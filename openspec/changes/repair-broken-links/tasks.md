# Tasks

## 1. Prerequisites and shared logic

- [ ] 1.1 Confirm `findLinkOccurrences`, the target rewrite helper and the WorkspaceEdit apply step from `update-links-on-rename` are available; verify their tests pass with `npm test`
- [ ] 1.2 Extract the "is this unresolved link a ghost" predicate and the ghost key from `buildNoteGraph` into a shared function and use it there; verify `tests/noteGraphService.test.ts` still passes unchanged

## 2. Broken link service

- [ ] 2.1 Implement `findBrokenLinks(roots, primaryRoot)` returning missing targets with display name and references (source, line, occurrence), skipping code, external, anchor-only and non-Markdown targets; verify with unit tests for the discovery and ignored-links scenarios
- [ ] 2.2 Group references by ghost key, pick the most frequent spelling as display name, and sort targets by reference count; verify with a unit test for the grouping scenario (3 references from 2 notes)

## 3. Repair actions

- [ ] 3.1 Implement "Notiz anlegen": path targets go to `<notesRoot>/<target>.md`, name-only targets go to a picked folder (first linking note's folder preselected), content `# <name>`, then open in the Janus Markdown Editor; verify with tests for both scenarios and that all references resolve afterwards
- [ ] 3.2 Implement the similarity-ordered note picker (exact, prefix, substring, edit distance); verify with a unit test that `kickoff` ranks first for `kickof`
- [ ] 3.3 Implement "Auf bestehende Notiz umleiten" using the rewrite helper and verification step; verify with a test for the retargeting scenario (wiki-link and Markdown link with label and `#agenda`)
- [ ] 3.4 Implement "Link entfernen" (alias, then target text, for wiki-links; label for Markdown links); verify with a test for the removing scenario
- [ ] 3.5 Implement "Verweis öffnen" via `setPendingLineReveal` / `revealLine` and `vscode.openWith`; verify with a test that the editor is opened for the right URI and line and no file is written
- [ ] 3.6 Apply 3.3 and 3.4 through the shared WorkspaceEdit apply step; verify with a test that a dirty open document keeps its unsaved text

## 4. Command and UI

- [ ] 4.1 Register `janus.repairBrokenLinks` in `src/extension.ts` and contribute it in `package.json` with title `Janus: Defekte Links reparieren` and a `view/title` entry for `janus.notesView` in the overflow group; verify the command appears in the palette and the Notes view `...` menu
- [ ] 4.2 Wire the QuickPick loop (targets, action, sub-pickers, rescan and show again, info message when none are left, Esc ends); verify with tests for the no-broken-links and continuing-with-remaining scenarios
- [ ] 4.3 Run `npm test` and `npm run compile` and verify both succeed; manually repair one broken link with each action in a sample collection and check the graph's ghost nodes disappear accordingly
