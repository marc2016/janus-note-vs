# Design

## Context

See `proposal.md` for motivation. Janus Note initializes `<notesRoot>/inbox.md` as the primary capture scratchpad and already provides `AiModelService` for multi-provider prompt completion (`vscode-lm` / GitHub Copilot, Ollama, OpenAI, Anthropic, Gemini, Custom) and `NotesLinksFooter` at the bottom of the Markdown editor. We need:
1. Three canonical English root categories (`meetings`, `projects`, `knowledge`) created on initialization and displayed with localized labels (`Allgemeine Meetings` / `General Meetings`, `Projekte` / `Projects`, `Wissensbasis` / `Knowledge Base`) according to `vscode.env.language`.
2. `AiInboxSorterService` and UI integration to split and sort `inbox.md` entries exclusively into these three root categories while guaranteeing that existing notes are strictly append-only.

## Goals / Non-Goals

**Goals:**
- Bootstrap `<notesRoot>/meetings`, `<notesRoot>/projects`, and `<notesRoot>/knowledge` in `initNotesRootCommand` alongside `<notesRoot>/inbox.md`.
- Render localized labels for the three root folders in `FolderTreeItem` and QuickPick previews based on `vscode.env.language` while keeping internal filesystem paths in English (`meetings`, `projects`, `knowledge`).
- Provide `AiInboxSorterService` that reads `<notesRoot>/inbox.md`, discovers all existing folders (including empty ones) and `.md` notes in `notesRoot`, and prompts `AiModelService` to split `inbox.md` into thematic sections within `meetings/`, `projects/`, or `knowledge/`.
- Enforce a hard, code-level append-only rule for any existing note file on disk so no existing content can ever be overwritten or deleted by the AI.
- Support both interactive preview confirmation (`janus.ai.inboxSortConfirm = true`, default) with multi-select QuickPick and direct execution (`janus.ai.inboxSortConfirm = false`), including an inline option in the QuickPick to switch the default mode.
- Preserve unselected sections in `inbox.md` when the user only approves a subset of proposals in Preview mode.
- Place the `Inbox einsortieren` button directly alongside `[KI: <Model> ▾]` and `[Aufgaben generieren]` in `NotesLinksFooter` with non-blocking toast notifications.

**Non-Goals:**
- Rewriting, summarizing, or deleting existing text inside target notes (strictly forbidden).
- Creating arbitrary new top-level folders at `notesRoot` outside `meetings`, `projects`, and `knowledge`.

## Decisions

1. **Canonical Internal Folder Names with Localized Display (`DEFAULT_ROOT_FOLDERS`)**
   - **Choice**: Define `DEFAULT_ROOT_FOLDERS = ['meetings', 'projects', 'knowledge'] as const` and a localization helper `getLocalizedRootFolderLabel(folderName: string, language?: string): string`:
     - `meetings`: `de*` -> `'Allgemeine Meetings'`, default -> `'General Meetings'`
     - `projects`: `de*` -> `'Projekte'`, default -> `'Projects'`
     - `knowledge`: `de*` -> `'Wissensbasis'`, default -> `'Knowledge Base'`
   - **Rationale**: Keeps paths clean, ASCII-safe, and portable in Git and LLM prompts while giving users native-language folder names in the VS Code UI.

2. **Mandatory Root Category Normalization in `sanitizeRelativeNotePath`**
   - **Choice**: Map any localized or synonymous first path segment (`allgemeine meetings`, `general meetings`, `meetings` -> `meetings`; `projekte`, `projects` -> `projects`; `wissensbasis`, `knowledge base`, `knowledge` -> `knowledge`). If a path has only a filename or a non-canonical top-level folder, place it under `knowledge/<path>` (or `projects/<path>` / `meetings/<path>`) so no rogue root folders are ever created.

3. **Structured JSON Response Schema with Zod Validation (`AiInboxSorterService`)**
   - **Choice**: Instruct the AI model to return JSON matching:
     ```json
     {
       "items": [
         {
           "title": "Short summary for QuickPick",
           "content": "Exact markdown content to sort",
           "sourceText": "Original text snippet from inbox.md",
           "action": "append" | "create",
           "targetRelativePath": "projects/App-Launch/app-launch.md"
         }
       ]
     }
     ```
     Validate and sanitize responses with `zod` (`parseAiInboxSortItems`), stripping code fences and rejecting path traversal (`..`).

4. **Code-Level Append-Only Guarantee for Existing Notes**
   - **Choice**: Before writing any sorted item to `<notesRoot>/<targetRelativePath>`, check `vscode.workspace.fs.stat(targetUri)`.
     - If `targetUri` exists (regardless of whether the AI returned `"action": "append"` or `"action": "create"`), read its current bytes, ensure a trailing `\n\n` separator, and append `item.content`.
     - If `targetUri` does not exist, create parent directories via `vscode.workspace.fs.createDirectory` and write `# <NoteTitle>\n\n<item.content>\n`.

5. **Selective `inbox.md` Cleanup & Non-Blocking Webview Notifications**
   - **Choice**: Remove only confirmed sections from `inbox.md` (or reset to `# Inbox\n\n` when all sections are sorted), and reset `aiInboxSorting: false` in `MarkdownEditorProvider` before showing `vscode.window.showInformationMessage(...)`.

## Risks / Trade-offs

- **[Risk] LLM returns German folder names (`Projekte/...`, `Allgemeine Meetings/...`, `Wissensbasis/...`) when note content is in German** → **Mitigation**: `sanitizeRelativeNotePath` automatically translates localized top-level folder names to their canonical internal English equivalents (`projects/...`, `meetings/...`, `knowledge/...`).
- **[Risk] Empty default folders (`meetings`, `projects`, `knowledge`) might not be discovered if only scanning `.md` files** → **Mitigation**: Scan subdirectories in `notesRoot` directly in addition to `findMarkdownNotesInRoot` and always include `meetings/`, `projects/`, `knowledge/` in the prompt context.
