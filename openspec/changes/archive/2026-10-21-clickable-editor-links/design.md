# Design: Clickable Inline Links in Markdown Editor

## Context

See [proposal.md](proposal.md) for motivation.

The Janus Markdown Editor (`MarkdownEditorApp.tsx`) uses CodeMirror 6 with a Live Preview extension (`livePreview.ts`) that decorates Markdown tokens (headings, lists, bold, italic, code) in-place without document re-serialization. Currently, link tokens (`[[...]]` and `[...](...)`) are highlighted with CSS text colors but lack interactive click handlers and delimiter concealing.

## Goals / Non-Goals

**Goals:**
- Provide direct-click navigation for inline wiki-links, Markdown links, and external URLs without requiring modifier keys (`Cmd`/`Ctrl`).
- Dynamically conceal link brackets (`[[` and `]]`, or `[` and `](...)`) based on the active syntax visibility mode (`auto`, `visible`, `hidden`).
- Keep raw syntax fully accessible and editable when navigating inside the link via keyboard/cursor.
- Intercept links pointing to non-existent notes and present a VS Code confirmation dialog offering to create the note immediately.

**Non-Goals:**
- In-editor link hover previews (popover tooltip iframe of the target note).
- Web-scraping or live thumbnail resolution for external URLs.

## Decisions

### 1. CodeMirror Mark Decorations for Links & Delimiters
- **Wiki-links (`[[Target]]` or `[[Target|Alias]]`)**:
  - Delimiters `[[` and `]]` are decorated with `cm-syntax-hidden` when mode is `hidden` or when mode is `auto` and cursor is outside the link range.
  - The inner text is decorated with `cm-link-text cursor-pointer hover:underline` and dataset attributes:
    `data-link-target="Target"` and `data-link-type="wiki"`.
  - When alias exists (e.g. `[[Target|My Alias]]`), the `Target|` prefix is also concealed in `auto` mode when cursor is outside, rendering only `My Alias`.
- **Markdown links (`[Label](url)`)**:
  - The opening bracket `[` and closing target `](url)` are decorated with `cm-syntax-hidden` when mode is `auto` and cursor is outside.
  - The label text is decorated with `cm-link-text cursor-pointer hover:underline`, `data-link-target="url"`, and `data-link-type="markdown"`.

### 2. Direct Click Event Handling in Webview
- Add an editor DOM click listener in `MarkdownEditorApp.tsx`:
  - When a click target has class `cm-link-text` (or contains `data-link-target`):
  - Check whether the cursor was already positioned inside the link token (edit mode). If yes, let the standard editor focus/caret placement happen.
  - If cursor was outside, intercept the event (`e.preventDefault()`, `e.stopPropagation()`) and post `{ type: 'openLink', targetUri: target, isRawTarget: true }` to the extension host.

### 3. Extension Host Resolution & Not-Found Confirmation Dialog
- In `MarkdownEditorProvider.ts`:
  - If target starts with `https://` or `http://`: call `vscode.env.openExternal(vscode.Uri.parse(target))`.
  - If target is a workspace note/file:
    - Attempt to resolve the target to a local file in `notesRoot` using `resolveOutgoingLink`.
    - If the file exists, open it in its respective editor (`janus.markdownEditor`, `janus.tasksEditor`, `janus.chartEditor`, or VS Code default for images/PDFs).
    - If the file does **not** exist:
      - Display `vscode.window.showInformationMessage("Notiz '[Name]' existiert nicht. Jetzt erstellen?", "Erstellen", "Abbrechen")`.
      - Upon clicking "Erstellen": write an initial note with `# [Name]\n\n` to `notesRoot` and open it immediately in the Janus Markdown Editor.

## Risks / Trade-offs

- **[Risk] Direct clicks conflicting with caret placement for text editing**
  - **Mitigation**: When cursor navigates into the link via keyboard arrows, delimiters become visible and editing works normally. Clicking outside the text or navigating with keyboard provides smooth editing access.
- **[Risk] Relative link path resolution across nested subdirectories**
  - **Mitigation**: Reuse `resolveOutgoingLink` from `noteLinkService.ts` which checks relative to document directory, relative to `notesRoot`, and by basename across workspace notes.

