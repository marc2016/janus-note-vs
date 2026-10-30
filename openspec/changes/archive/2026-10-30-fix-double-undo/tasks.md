# Tasks

## 1. Editor

- [x] 1.1 Add `undoRedoCommand(event, isMac)` and a high-precedence keydown handler that runs CodeMirror's `undo`/`redo`, prevents the default and stops propagation; register it in the editor; verify with unit tests for the key mapping on Mac and other platforms (including `Alt` combinations that must not match) and that the handler undoes one step and stops propagation

## 2. Verification

- [x] 2.1 Run `npm test`, `npm run compile` and `npm run build` and verify all succeed
- [x] 2.2 Manually check "Undoing a deletion", "Undoing typed text", "Redo", "Undoing an applied AI proposal" and "Undo from the menu"; if text is still duplicated on key press, implement the fallback key binding from the design (`janus.editor.undo`/`janus.editor.redo`, webview handler) and repeat the check
