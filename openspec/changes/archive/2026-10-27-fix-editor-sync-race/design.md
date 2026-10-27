# Design

## Context

- **Webview → host:** `MarkdownEditorApp.tsx` has an `updateListener` that debounces 250 ms and posts `{ type: 'updateContent', content }` with the full text. Host-originated dispatches are excluded with the `isUpdatingFromHostRef` flag.
- **Host:** `MarkdownEditorProvider.handleWebviewMessage` replaces the whole TextDocument with `applyEdit` when the text differs.
- **Host → webview:** `onDidChangeTextDocument` posts `{ type: 'update', content }` for *every* change to the document, including the one just applied from the webview (the echo).
- **Webview on `init` / `update`:** It replaces the entire CodeMirror document whenever the text differs. That reverts newer local typing (stale echo) and resets the selection (full replacement).
- Other host-side writers (link insertion via `applyEdit`, AI inbox/task actions, VS Code undo/redo, the same file open in a text editor) go through the same `onDidChangeTextDocument` path and must keep working.

## Goals / Non-Goals

**Goals:**
- Never lose or revert keystrokes because of synchronization.
- Keep the cursor stable on external changes.
- Keep the wire format compatible (full-text messages) with minimal additions (`seq`, `ackSeq`).

**Non-Goals:**
- Operational transform or CRDT-level conflict resolution. Overlapping concurrent edits use last-writer-wins on the overlapping range.
- Changing CodeMirror history semantics beyond excluding remote changes from local undo.

## Decisions

**1. Sequence numbers instead of content comparison for staleness.**
- The webview increments `seq` for every `updateContent` it sends.
- The host stores, per webview panel, `lastAppliedSeq` and includes it as `ackSeq` in every `update` message.
- The webview ignores an `update` whose `ackSeq < lastSentSeq`: the host has not processed the latest edit yet, so its state is older than the webview's. The pending edit will overwrite the document anyway.

*Alternative:* compare content against recently sent texts. Rejected because it fails for intermediate states and for external changes that happen to equal an old text.

**2. Echo suppression on the host.**
In the `updateContent` handler, the host records `expectedEchoText = newText` before `applyEdit`. In `onDidChangeTextDocument`, if the new document text equals `expectedEchoText`, the host clears it and does not post. Clearing after the first match ensures that a later, genuine change producing the same text (e.g. undo then redo) is still delivered. The per-panel state lives in a small `WebviewSyncTracker` class (in `markdownEditorProvider.ts`, or a sibling module) so it can be unit-tested without VS Code panels.

**3. Pure sync core in `src/webviews/markdown/lib/documentSync.ts`.**
- `minimalChange(oldText, newText): { from, to, insert } | null`: common prefix/suffix diff, a single replacement.
- `class DocumentSync`:
  - `lastSynced: string` — the text both sides agreed on most recently.
  - `pending: ChangeSet` — local changes since `lastSynced`, composed from local transactions.
  - `lastSentSeq: number`.
  - `recordLocal(changes: ChangeSet)` — compose into `pending`.
  - `takeOutgoing(currentText): { content, seq }` — increment the seq, set `lastSynced = currentText`, reset `pending`.
  - `applyRemote(content, ackSeq, docLength): ChangeSet | null`:
    - return null if stale (`ackSeq < lastSentSeq`) or unchanged;
    - otherwise build `remote` from `minimalChange(lastSynced, content)`;
    - if `pending` is non-empty, rebase: `remote.map(pending)`, and update `pending = pending.map(remote, true)`;
    - set `lastSynced = content` and return the change to dispatch.
  - `reset(content)` on `init`.

CodeMirror's `ChangeSet.map` gives the rebase for free. On overlapping edits, mapping keeps both insertions in a deterministic order, which is acceptable for the rare overlap case.

**4. Dispatching remote changes.**
The webview dispatches the returned `ChangeSet` with annotations `Transaction.remote.of(true)` and `Transaction.addToHistory.of(false)`. The update listener treats only non-remote transactions as local: it calls `recordLocal` and schedules the debounced send. This replaces the `isUpdatingFromHostRef` flag. Because the change is minimal and positional, CodeMirror maps the selection, and the cursor keeps its text position. If a remote change arrives while local edits are pending, the merged document differs from the host's text, but the pending debounce sends the merged full text, so the host converges.

**5. Flush on blur / hide.**
`EditorView.domEventHandlers({ blur })` and a `visibilitychange` listener (`document.hidden`) cancel the debounce timer and send immediately when edits are pending. This covers switching tabs right after typing.

**6. Initial load.**
`init` (and the first `update` before any local edit) calls `sync.reset(content)` and replaces the document wholesale as today. There is no cursor to preserve yet.

## Risks / Trade-offs

- [Host processes an external change between receiving and applying a webview edit] → The webview's full-text edit wins (last-writer-wins). The window is a few milliseconds, which is acceptable.
- [Echo comparison by full text could be expensive for very large notes] → One string comparison per change. It is negligible next to the existing `getText()` calls.
- [Remote changes excluded from CodeMirror undo] → Undo in the webview only undoes the user's own typing. External changes are undone where they were made (VS Code undo or the source action). This matches common editor behavior.
- [Older webview builds without `seq`] → The host treats a missing `seq` as 0, and the webview treats a missing `ackSeq` as current. Both builds ship together, so there is no mixed-version state in practice.
