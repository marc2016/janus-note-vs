# Proposal: Inline File and Note Linking

## Why

Linking notes and referenced files (images, PDFs, task boards) is fundamental to personal knowledge management, but currently users must manually type wiki-links or use the bottom footer button which only appends links to the end of the document. Providing an in-place, inline autocompletion triggered while typing `[[`, via slash commands (`/link`, `/verlinken`, `/note`), keyboard shortcut (`Cmd+K` / `Ctrl+K`), or a toolbar button allows seamless, zero-friction linking directly at the cursor.

## What Changes

- Add an inline autocompletion provider in CodeMirror triggered when typing `[[`, presenting a searchable candidate list of Markdown notes and other files in `janus.notesRoot`.
- Add slash commands (`/link`, `/verlinken`, `/note`) to the slash command menu that insert `[[` and immediately activate the inline file linking autocomplete.
- Add `Cmd+K` / `Ctrl+K` keybinding support in the Markdown editor:
  - If text is selected, wraps the selection in `[[...]]`.
  - If cursor is collapsed, inserts `[[` and opens the inline autocompletion list.
- Add a link button (`$(link)`) to `MarkdownToolbar.tsx` that triggers inline link autocompletion at the active cursor position.
- Include both Markdown notes (with clean titles) and other file types (images, PDFs, task companions, diagrams) with distinct icons in the suggestion list.
- Insert completed items as standard wiki-links (`[[Note Name]]` or `[[path/file.ext]]`).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `note-linking`: Add requirement for inline file and note link autocomplete and insertion.

## Impact

- **Affected Code**:
  - `src/webviews/markdown/extensions/linkAutocomplete.ts` (new) or `slashCommands.ts`: CodeMirror 6 autocompletion source for `[[` triggers and candidate filtering.
  - `src/webviews/markdown/components/MarkdownToolbar.tsx`: Add link icon button.
  - `src/webviews/markdown/MarkdownEditorApp.tsx`: Keymap for `Cmd+K` / `Ctrl+K` and candidate state integration.
  - `src/editors/markdownEditorProvider.ts`: Gather candidate files (markdown notes, assets, companions) across `notesRoot` and deliver them to the editor webview.
- **Dependencies**: Uses existing CodeMirror 6 autocomplete and VS Code workspace APIs; no external npm dependencies required.

