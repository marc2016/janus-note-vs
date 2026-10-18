# Proposal

## Why

The `inbox.md` file serves as the central scratchpad where users capture raw thoughts, meeting notes, and ideas throughout the day. Currently, organizing these captured sections into appropriate thematic folders and existing or new notes requires manual copy-pasting and file creation, which creates friction and leads to an overflowing `inbox.md`. Additionally, without predefined top-level root categories, AI sorting could invent arbitrary top-level folders over time. Adding an AI-powered "Inbox einsortieren" action directly in the Markdown editor footer bar — backed by three fixed internal English root categories (`meetings`, `projects`, `knowledge`) that are displayed with localized names in the UI (`Allgemeine Meetings`, `Projekte`, `Wissensbasis` in German; `General Meetings`, `Projects`, `Knowledge Base` in English) — allows users to automatically classify and distribute `inbox.md` entries into a clean, consistent workspace hierarchy while guaranteeing that existing note contents are never overwritten or deleted.

## What Changes

- **Three Default Root Categories (`meetings`, `projects`, `knowledge`) & Localized UI Display**:
  - `initNotesRootCommand` (`src/commands/notesRootCommands.ts`) automatically creates the three top-level directories `meetings`, `projects`, and `knowledge` alongside `inbox.md`.
  - Internally on disk (filesystem paths, Git, AI target paths), the root directories always use the canonical English names (`meetings`, `projects`, `knowledge`).
  - In the UI (`FolderTreeItem` in `NotesTreeDataProvider` and the Inbox sorting preview QuickPick), these three root folders are displayed using the active VS Code language (`vscode.env.language`):
    - German (`de*`): `Allgemeine Meetings`, `Projekte`, `Wissensbasis`
    - English / fallback: `General Meetings`, `Projects`, `Knowledge Base`
- **New `AiInboxSorterService` (`src/services/aiInboxSorterService.ts`)**:
  - Reads the content of `<notesRoot>/inbox.md` and collects all existing folders (including empty ones) and Markdown notes in `notesRoot`.
  - Uses `AiModelService.completePrompt(...)` to split `inbox.md` content into logical thematic sections and propose a target action (`append` | `create`) strictly within the three root categories (`meetings/...`, `projects/...`, `knowledge/...`).
  - Normalizes any localized root prefix returned by the LLM (e.g. `Projekte/...` -> `projects/...`, `Allgemeine Meetings/...` -> `meetings/...`, `Wissensbasis/...` -> `knowledge/...`) and enforces that every `targetRelativePath` starts with one of the three canonical root folders (`meetings/`, `projects/`, `knowledge/`).
  - Enforces a **strict append-only guarantee** whenever writing to an existing note file (even if the AI proposed `create` for a path that already exists on disk, it automatically falls back to `append` so no existing bytes are ever deleted or overwritten).
  - Supports two configurable execution modes via `janus.ai.inboxSortConfirm` (boolean, default `true`):
    - **Preview mode (default)**: Shows a multi-select VS Code QuickPick with all proposed sorting actions pre-selected (`[x]`), plus an inline option to toggle the confirmation setting.
    - **Direct mode**: Immediately executes all proposed sorting actions without a confirmation step.
  - Updates `inbox.md` safely after sorting:
    - If all sections were sorted, resets `inbox.md` to `# Inbox\n\n`.
    - If the user deselected specific items in Preview mode, only the executed sections are removed from `inbox.md` while unselected sections remain intact in `inbox.md`.
- **Footer Bar Button in `NotesLinksFooter` (`src/webviews/markdown/components/NotesLinksFooter.tsx`, `src/webviews/markdown/MarkdownEditorApp.tsx`, `src/editors/markdownEditorProvider.ts`)**:
  - Adds the `Inbox einsortieren` button (`onSortAiInbox`, `isSortingInbox`) in the AI action button group right next to `[KI: <Model> ▾]` and `[Aufgaben generieren]`.
  - Handles `sortAiInbox` webview message in `MarkdownEditorProvider` with non-blocking VS Code notifications so loading state (`aiInboxSorting: false`) resets immediately.
- **Command, Configuration & Sample Workspace (`package.json`, `src/extension.ts`, `sample/`)**:
  - Registers `janus.sortInbox` (`Janus: Inbox mit KI einsortieren`) in the Command Palette.
  - Adds `janus.ai.inboxSortConfirm` boolean setting (default `true`) to toggle between preview confirmation and direct sorting.
  - Structures the `sample/` workspace around `sample/meetings/`, `sample/projects/`, `sample/knowledge/`, and a pre-filled `sample/inbox.md`.

## Capabilities

### New Capabilities
- `ai-inbox-sorting`: AI-assisted thematic splitting and sorting of `inbox.md` entries into the three canonical root categories (`meetings`, `projects`, `knowledge`), with strict append-only protection for existing files, configurable preview vs. direct execution, and selective cleanup of `inbox.md`.

### Modified Capabilities
- `markdown-editor`: Extends the bottom footer bar (`NotesLinksFooter`) AI action group with an `Inbox einsortieren` button and loading state indicator alongside the AI model selector and task generation button.
- `notes-sidebar`: Bootstraps the three canonical root directories (`meetings`, `projects`, `knowledge`) during `janus.initNotesRoot` and displays localized folder labels (`Allgemeine Meetings`/`General Meetings`, `Projekte`/`Projects`, `Wissensbasis`/`Knowledge Base`) in the Notes TreeView based on `vscode.env.language`.

## Impact

- **Services & Commands**: `src/services/aiInboxSorterService.ts`, `src/commands/notesRootCommands.ts`, `src/ui/notesTreeDataProvider.ts`.
- **Editor & Webview UI**: `src/editors/markdownEditorProvider.ts`, `src/webviews/markdown/MarkdownEditorApp.tsx`, `src/webviews/markdown/components/NotesLinksFooter.tsx`.
- **Extension Host, Configuration & Sample Workspace**: `src/extension.ts`, `package.json`, `sample/`.
- **Tests**: `tests/aiInboxSorting.test.ts`, `tests/notesRootCommands.test.ts`, `tests/notesTreeDataProvider.test.ts`.
