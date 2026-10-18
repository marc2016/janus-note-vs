# Design

## Context

See `proposal.md` for motivation. Janus Note initializes `<notesRoot>/inbox.md` as the primary capture scratchpad and already provides `AiModelService` for multi-provider prompt completion (`vscode-lm` / GitHub Copilot, Ollama, OpenAI, Anthropic, Gemini, Custom) and `NotesLinksFooter` at the bottom of the Markdown editor. We now need a service and UI integration to split and sort `inbox.md` entries into the folder/note tree while guaranteeing that existing notes are strictly append-only.

## Goals / Non-Goals

**Goals:**
- Provide `AiInboxSorterService` that reads `<notesRoot>/inbox.md`, discovers existing folders and `.md` notes in `notesRoot`, and prompts `AiModelService` to split `inbox.md` into thematic sections with target note paths.
- Enforce a hard, code-level append-only rule for any existing note file on disk so no existing content can ever be overwritten or deleted by the AI.
- Support both interactive preview confirmation (`janus.ai.inboxSortConfirm = true`, default) with multi-select QuickPick and direct execution (`janus.ai.inboxSortConfirm = false`), including an inline option in the QuickPick to switch the default mode.
- Preserve unselected sections in `inbox.md` when the user only approves a subset of proposals in Preview mode.
- Place the `Inbox einsortieren` button directly alongside `[KI: <Model> ▾]` and `[Aufgaben generieren]` in `NotesLinksFooter` with non-blocking toast notifications.

**Non-Goals:**
- Rewriting, summarizing, or deleting existing text inside target notes (strictly forbidden).
- Moving or deleting whole note files outside `inbox.md`.

## Decisions

1. **Structured JSON Response Schema with Zod Validation (`AiInboxSorterService`)**
   - **Choice**: Instruct the AI model to return JSON matching:
     ```json
     {
       "items": [
         {
           "title": "Short summary for QuickPick",
           "content": "Exact markdown content to sort",
           "sourceText": "Original text snippet from inbox.md",
           "action": "append" | "create",
           "targetRelativePath": "Folder/Note.md"
         }
       ]
     }
     ```
     Validate and sanitize responses with `zod` (`parseAiInboxSortItems`), stripping code fences and rejecting path traversal (`..`).
   - **Rationale**: Mirrors the proven pattern in `AiTaskGeneratorService` (`parseAiExtractedTasks`) and ensures deterministic file paths inside `notesRoot`.

2. **Code-Level Append-Only Guarantee for Existing Notes**
   - **Choice**: Before writing any sorted item to `<notesRoot>/<targetRelativePath>`, check `vscode.workspace.fs.stat(targetUri)`.
     - If `targetUri` exists (regardless of whether the AI returned `"action": "append"` or `"action": "create"`), read its current bytes, ensure a trailing `\n\n` separator, and append `item.content`.
     - If `targetUri` does not exist, create parent directories via `vscode.workspace.fs.createDirectory` and write `# <NoteTitle>\n\n<item.content>\n`.
   - **Rationale**: Never trusting the LLM's `"create"` vs `"append"` distinction alone prevents accidental file truncation or overwrite if the LLM hallucinates `"create"` for an existing path.

3. **Selective `inbox.md` Cleanup**
   - **Choice**:
     - If all proposed items are selected and sorted (in direct mode or when all items remain checked in preview mode), replace `inbox.md` with `# Inbox\n\n`.
     - If the user unchecks one or more items in preview mode, reconstruct `inbox.md` from `# Inbox\n\n` followed by the `sourceText` (or `content`) of the unchecked items, or remove only the approved `sourceText` blocks from `inbox.md`.
     - If `inbox.md` is currently open as a `vscode.TextDocument`, apply the update via `vscode.WorkspaceEdit` (and save or update buffer) so open editors immediately reflect the cleaned-up inbox without conflict.

4. **Preview QuickPick with Mode Toggle (`janus.ai.inboxSortConfirm`)**
   - **Choice**: Store boolean setting `janus.ai.inboxSortConfirm` (default `true`). When `true`, show `vscode.window.showQuickPick` with `canPickMany: true` where all proposed items have `picked: true`, plus a QuickPick toggle item (or title action) allowing the user to switch between Preview and Direct mode.

5. **Non-Blocking Webview Message Handling in `MarkdownEditorProvider`**
   - **Choice**: On `sortAiInbox`, set `aiInboxSorting: true`, await `aiInboxSorterService.sortInbox(...)` (including QuickPick if preview mode is active), immediately post `aiInboxSorting: false` and refresh links/sidebar BEFORE calling `vscode.window.showInformationMessage(...)`.
   - **Rationale**: Prevents the button spinner from staying active while the user reads or ignores the completion notification toast.

## Risks / Trade-offs

- **[Risk] Path traversal or invalid characters in AI-suggested `targetRelativePath`** → **Mitigation**: Normalize relative paths, strip leading slashes, reject `..` segments, and ensure `.md` extension before resolving inside `notesRoot`.
- **[Risk] Open `inbox.md` editor has unsaved buffer changes when sorting is triggered from footer** → **Mitigation**: When `sortAiInbox` is triggered from ` inbox.md` in `MarkdownEditorProvider`, pass `document.getText()` directly and update `inbox.md` via `WorkspaceEdit` on the open document.

