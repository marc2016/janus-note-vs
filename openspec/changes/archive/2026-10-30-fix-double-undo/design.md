# Design

## Context

- The editor uses CodeMirror's `history()` and `historyKeymap` (`editorKeymap.ts`). Edits reach the TextDocument as full-document `WorkspaceEdit`s from `updateContent`, so VS Code keeps a second, coarser undo stack for the same document.
- VS Code webviews forward key presses to the workbench so its key bindings keep working. With focus in the Janus editor, `Cmd+Z` therefore runs CodeMirror's undo and VS Code's `undo` for the custom editor, which undoes the last `WorkspaceEdit`.
- `DocumentSync.applyRemote` (`lib/documentSync.ts`) ignores document states older than the latest sent edit (`ackSeq`), and otherwise rebases unsent local changes onto the external change. If VS Code's undo arrives while CodeMirror's undo is not sent yet, both undos are applied; undoing a deletion re-inserts the text twice.

## Goals / Non-Goals

**Goals:**
- One undo step per key press, with CodeMirror's fine-grained history and cursor handling.

**Non-Goals:**
- Changing `DocumentSync`: it behaves correctly for genuine external changes; the bug is that one key press produces two changes.

## Decisions

### 1. Handle undo/redo keys in the editor and stop them there

A high-precedence `EditorView.domEventHandlers({ keydown })` checks the key with a pure `undoRedoCommand(event, isMac)`:
- `Mod-z` → undo, `Mod-Shift-z` → redo, and on non-Mac `Ctrl-y` → redo (`Mod` = `Cmd` on Mac, `Ctrl` elsewhere; `Alt` must not be pressed).

For a match it runs `undo(view)` / `redo(view)` from `@codemirror/commands`, calls `preventDefault()` and `stopPropagation()`, and returns `true`. VS Code's webview wrapper listens for key presses on the document in the bubbling phase, so stopping propagation at CodeMirror's content element keeps the key away from the workbench. `historyKeymap` stays for its other bindings; the handler runs first.

*Alternative considered:* removing CodeMirror's history and relying on VS Code's document undo. Undo steps would become whole sync batches, the cursor would be restored from outside, and editor-side actions (AI apply, image insert) would lose clean steps.

### 2. Fallback key binding (only if the manual check shows it is needed)

If VS Code still receives the key press (for example because its listener runs in the capture phase), `package.json` gets key bindings for `cmd+z`/`ctrl+z`, `cmd+shift+z`/`ctrl+shift+z` and `ctrl+y` with `when: activeCustomEditorId == 'janus.markdownEditor'`, bound to `janus.editor.undo` / `janus.editor.redo`. These post `{ type: 'undo' | 'redo' }` to the active panel, and the webview runs the CodeMirror command. Menu `Edit → Undo` does not use key bindings and keeps undoing the document once.

## Risks / Trade-offs

- [VS Code changes how webviews forward keys] → The fallback binding covers that path; the manual check verifies which path is active.
- [Menu undo and editor undo now act on different stacks] → Each acts once, so nothing is duplicated; mixing them can undo in a different order, which is acceptable for a rarely used menu path.
