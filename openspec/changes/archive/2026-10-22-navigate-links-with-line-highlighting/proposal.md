# Proposal

## Why

When working with interconnected notes and codebase references, users frequently link to specific lines in source files or need to retrace where a backlink originated. Currently, Janus Note strips line/anchor fragments from targets and always opens files at line 1. Furthermore, backlink entries in the footer only refer to the document as a whole, forcing users to manually scan large notes to find the referencing text.

Supporting line-targeted navigation with persistent line highlighting (cleared upon cursor move or edit) significantly improves developer ergonomics, code referencing, and bi-directional note exploration.

## What Changes

- **Line Reference Parsing in Links**: Support line specifications in outgoing links across both colon syntax (`file.ts:42`, `[[note:42]]`) and GitHub hash anchor syntax (`file.ts#L42`, `[Label](file.ts#L42)`).
- **Line-Aware Backlink Discovery**: Enhance `findBacklinks()` to track the 1-based line number in the source note where each incoming reference occurs.
- **Backlink UI Line Indicator**: Display the origin line number on backlink pills in the note footer (e.g. `Note A :15`) and pass the line to the navigation action.
- **Code Editor Navigation with Line Selection**: When navigating to non-markdown or code files, open via `vscode.window.showTextDocument` with a line selection range to jump to and highlight the targeted line natively.
- **Janus Markdown Editor Line Highlighting**:
  - Scroll the targeted line into the center of the viewport (`scrollIntoView`).
  - Move the cursor to the beginning of the targeted line.
  - Apply an active line highlight decoration to the entire line in CodeMirror.
  - Automatically remove the highlight decoration as soon as the user moves the cursor or edits the document (Option 2).
  - Gracefully clamp out-of-range line numbers to the last line of the document.

## Capabilities

### New Capabilities
<!-- No new standalone capabilities; extending note-linking and markdown-editor -->

### Modified Capabilities
- `note-linking`: Extend outgoing link parsing and incoming backlink indexing to extract, store, and expose line numbers for references.
- `markdown-editor`: Extend link opening and CodeMirror editor view to support line-targeted navigation, line selection for text editors, and line highlighting in the Janus Markdown Editor.

## Impact

- `src/services/noteLinkService.ts`: Update `extractDocumentLinks`, `resolveOutgoingLink`, and `findBacklinks` to parse and return line numbers.
- `src/webviews/markdown/components/NotesLinksFooter.tsx`: Display origin line numbers on backlink items and pass line metadata on click.
- `src/editors/markdownEditorProvider.ts`: Parse line targets from `openLink` messages and dispatch line selection / reveal events.
- `src/webviews/markdown/MarkdownEditorApp.tsx`: Handle `revealLine` / line highlight messages, manage CodeMirror line highlight state, and clear on cursor movement or edit.

