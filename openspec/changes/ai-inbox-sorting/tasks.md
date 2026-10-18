# Tasks

## 1. AI Inbox Sorter Service (`AiInboxSorterService`)

- [x] 1.1 Create `src/services/aiInboxSorterService.ts` with `parseAiInboxSortItems`, `sanitizeRelativeNotePath`, and `AiInboxSorterService.sortInbox(...)` that reads `<notesRoot>/inbox.md`, collects existing folders and Markdown notes in `notesRoot`, and prompts `AiModelService` for thematic sections and target actions (`append` | `create`), verifying via unit tests in `tests/aiInboxSorting.test.ts`.
- [x] 1.2 Enforce code-level append-only protection in `AiInboxSorterService` so that any target note that already exists on disk is strictly appended to (`\n\n` + section content) even if the AI returned `"action": "create"`, and new notes/folders are created cleanly, verifying via unit tests in `tests/aiInboxSorting.test.ts`.
- [x] 1.3 Implement toggleable Preview vs. Direct execution (`janus.ai.inboxSortConfirm` default `true`) using a multi-select VS Code QuickPick with pre-selected items (`picked: true`), an inline option to toggle the confirmation setting, and selective cleanup of `inbox.md` (preserving any unchecked sections in `inbox.md` and resetting to `# Inbox\n\n` when all sections are sorted), verifying via unit tests in `tests/aiInboxSorting.test.ts`.

## 2. Markdown Editor Footer Bar & Extension Integration

- [x] 2.1 Add `janus.ai.inboxSortConfirm` setting (default `true`) and `janus.sortInbox` command (`Janus: Inbox mit KI einsortieren`) to `package.json` and wire `AiInboxSorterService` in `src/extension.ts`, verifying with `npm run compile`.
- [x] 2.2 Add the `Inbox einsortieren` button (`onSortInbox`, `isSortingInbox`) to `src/webviews/markdown/components/NotesLinksFooter.tsx` alongside `[KI: <Model> ▾]` and `[Aufgaben generieren]`, wire `sortAiInbox` / `aiInboxSorting` messages in `src/webviews/markdown/MarkdownEditorApp.tsx` and `src/editors/markdownEditorProvider.ts` with non-blocking toast notifications, and verify with `npm run build`.

## 3. Verification & Test Suite

- [x] 3.1 Add comprehensive unit and integration tests in `tests/aiInboxSorting.test.ts` covering JSON parsing, path sanitization, strict append-only behavior on existing files, new folder/note creation, preview partial selection preserving unselected inbox content, direct mode execution, and `MarkdownEditorProvider` `sortAiInbox` webview message handling, and verify `npm test` and `npm run build` pass with zero errors.
