# Proposal

## Why

In the Janus Note Markdown Editor, when a user places the cursor inside an unformatted word (without an active text selection) and clicks Bold, Italic, Strikethrough, or Code, the editor currently inserts empty marker pairs (`****`) directly at the cursor position (e.g. `hel**|**lo`). Users expect standard rich-text and word-processor behavior: triggering inline formatting with a collapsed cursor within a word should automatically target and format the entire surrounding word (e.g. `**hello**`).

## What Changes

- Update inline mark formatting logic (`toggleInlineMark`) so that if the cursor selection is collapsed (`from === to`):
  - Detect word boundaries at the cursor position (`state.wordAt(pos)` or equivalent word boundary match).
  - If the cursor is positioned within or immediately adjacent to a word, target that word's boundaries and wrap it with the chosen inline formatting marker (`**`, `*`, `~~`, or `` ` ``).
  - If the cursor is already inside a formatted node of the same type, continue stripping/toggling off the formatting.
  - If the cursor is not in a word (e.g. at whitespace or on a blank line), retain fallback behavior of inserting an empty marker pair (`****`) with cursor placed between markers.
- Add standard formatting keyboard shortcuts (`Mod-b` for bold, `Mod-i` for italic, `Mod-e` or `Mod-Shift-c` for inline code) in the CodeMirror editor keymap, delegating to the unified inline mark handler.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `markdown-editor`: Update inline formatting requirements to specify automatic word-boundary expansion when triggering inline styles at a collapsed cursor within a word.

## Impact

- **Webview UI**: `src/webviews/markdown/components/MarkdownToolbar.tsx`, `src/webviews/markdown/MarkdownEditorApp.tsx`.
- **Tests**: Add unit tests in `tests/markdownEditor.test.ts` verifying word-boundary formatting and keyboard shortcuts.
- **Dependencies & APIs**: No external dependency changes; utilizes existing CodeMirror 6 state utilities.
