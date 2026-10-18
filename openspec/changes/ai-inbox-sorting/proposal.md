# Proposal

## Why

The `inbox.md` file serves as the central scratchpad where users capture raw thoughts, meeting notes, and ideas throughout the day. Currently, organizing these captured sections into appropriate thematic folders and existing or new notes requires manual copy-pasting and file creation, which creates friction and leads to an overflowing `inbox.md`. Adding an AI-powered "Inbox einsortieren" action directly in the Markdown editor footer bar allows users to automatically classify and distribute `inbox.md` entries into the workspace's note hierarchy while guaranteeing that existing note contents are never overwritten or deleted.

## What Changes

- **New `AiInboxSorterService` (`src/services/aiInboxSorterService.ts`)**:
  - Reads the content of `<notesRoot>/inbox.md` and collects existing folders and Markdown notes in `notesRoot`.
  - Uses `AiModelService.completePrompt(...)` to split `inbox.md` content into logical thematic sections and propose a target action for each section:
    - `append`: Append the section to an existing Markdown note.
    - `create`: Create a new Markdown note in an existing or newly proposed folder.
  - Enforces a **strict append-only guarantee** whenever writing to an existing note file (even if the AI proposed `create` for a path that already exists on disk, it automatically falls back to `append` so no existing bytes are ever deleted or overwritten).
  - Supports two configurable execution modes via `janus.ai.inboxSortConfirm` (boolean, default `true`):
    - **Preview mode (default)**: Shows a multi-select VS Code QuickPick with all proposed sorting actions pre-selected (`[x]`), plus an inline option to toggle the confirmation setting.
    - **Direct mode**: Immediately executes all proposed sorting actions without a confirmation step.
  - Updates `inbox.md` safely after sorting:
    - If all sections were sorted, resets `inbox.md` to `# Inbox\n\n`.
    - If the user deselected specific items in Preview mode, only the executed sections are removed from `inbox.md` while unselected sections remain intact in `inbox.md`.
- **Footer Bar Button in `NotesLinksFooter` (`src/webviews/markdown/components/NotesLinksFooter.tsx`, `src/webviews/markdown/MarkdownEditorApp.tsx`, `src/editors/markdownEditorProvider.ts`)**:
  - Adds the `Inbox einsortieren` button (`onSortInbox`, `isSortingInbox`) in the `.notes-links-footer__ai-actions` button group right next to `[KI: <Model> ▾]` and `[Aufgaben generieren]`.
  - Handles `sortAiInbox` webview message in `MarkdownEditorProvider` with non-blocking VS Code notifications so loading state (`aiInboxSorting: false`) resets immediately.
- **Command & Configuration (`package.json`, `src/extension.ts`)**:
  - Registers `janus.sortInbox` (`Janus: Inbox mit KI einsortieren`) in the Command Palette.
  - Adds `janus.ai.inboxSortConfirm` boolean setting (default `true`) to toggle between preview confirmation and direct sorting.

## Capabilities

### New Capabilities
- `ai-inbox-sorting`: AI-assisted thematic splitting and sorting of `inbox.md` entries into existing or new folders and notes, with strict append-only protection for existing files, configurable preview vs. direct execution, and selective cleanup of `inbox.md`.

### Modified Capabilities
- `markdown-editor`: Extends the bottom footer bar (`NotesLinksFooter`) AI action group with an `Inbox einsortieren` button and loading state indicator alongside the AI model selector and task generation button.

## Impact

- **Services**: New `src/services/aiInboxSorterService.ts`.
- **Editor & Webview UI**: `src/editors/markdownEditorProvider.ts`, `src/webviews/markdown/MarkdownEditorApp.tsx`, `src/webviews/markdown/components/NotesLinksFooter.tsx`.
- **Extension Host & Configuration**: `src/extension.ts`, `package.json`.
- **Tests**: New unit and integration tests in `tests/aiInboxSorting.test.ts`.

