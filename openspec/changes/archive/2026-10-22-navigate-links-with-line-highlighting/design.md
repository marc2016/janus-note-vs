# Design: Line-Targeted Note Navigation with Line Highlighting

## Context

See [proposal.md](proposal.md) for motivation.

Currently:
1. `MarkdownEditorProvider` strips `#...` fragments and does not parse `:line` suffixes when handling `openLink` messages.
2. `vscode.commands.executeCommand('vscode.open', targetUri)` or `'vscode.openWith'` is invoked without selection or line parameters.
3. `findBacklinks()` in `noteLinkService.ts` only records which files reference the target note, without recording line offsets.
4. The CodeMirror 6 editor in `MarkdownEditorApp.tsx` has no mechanism to receive target line instructions or render transient line highlights.

## Goals / Non-Goals

**Goals:**
- Parse line numbers from both `:line` and `#Lline` (e.g. `file.ts:42`, `file.ts#L42`, `[[note:15]]`, `[[note#L15]]`).
- Record 1-based origin line numbers during backlink indexing and render line badges on backlink chips in the footer (e.g. `Note A :15`).
- Open non-markdown code files using `vscode.window.showTextDocument` with a line selection range so VS Code natively jumps to and highlights the target line.
- For Janus Markdown Editor targets, dispatch a `revealLine` message with target line number.
- In CodeMirror 6, scroll the target line into view, place cursor at the line start, and render a persistent line highlight decoration until the user moves the cursor or edits the document (Option 2).
- Clamp line numbers out-of-range to `[1, doc.lines]`.

**Non-Goals:**
- Column-level character range highlighting (only whole line highlighting).
- Persisting highlight state across editor closures or sessions.
- Multi-line range selection spanning multiple lines.

## Decisions

### 1. Link Target & Line Extraction (`parseLinkTargetAndLine`)
- Central utility function `parseLinkTargetAndLine(rawTarget: string)`:
  - Strips wiki delimiters (`[[...]]`) and markdown link delimiters (`[...] (...)`).
  - Matches GitHub anchor `#L(\d+)` (e.g. `path/file.ts#L42` -> target `path/file.ts`, line `42`).
  - Matches colon line syntax `(?::(\d+))(?::\d+)?$` (e.g. `path/file.ts:42` or `path/file.ts:42:10` -> target `path/file.ts`, line `42`).
  - Strips trailing title attributes.
  - Returns `{ cleanTarget: string, lineNumber?: number }`.

*Alternatives considered:*
- Storing line numbers as URL search params (`?line=42`): rejected because `#L42` and `:42` are the universal standards in Markdown and developer tools.

### 2. Backlink Line Tracking in `noteLinkService`
- In `findBacklinks(targetNoteUri, notesRoots)`:
  - When scanning file text, compute line numbers:
    ```typescript
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      const extracted = extractDocumentLinks(lineText);
      // If any link matches targetNoteUri, record backlink with lineNumber = i + 1
    }
    ```
  - `NoteLinkItem` interface updated with `lineNumber?: number`.
  - In `NotesLinksFooter`, render line badge if `lineNumber` is present:
    `${item.title} :${item.lineNumber}`.
  - Clicking passes `targetUri` with `#L${item.lineNumber}` or explicit `lineNumber`.

### 3. Editor Navigation Mechanism
- In `MarkdownEditorProvider.handleWebviewMessage` for `openLink`:
  - If target is a non-markdown file:
    ```typescript
    const doc = await vscode.workspace.openTextDocument(targetUri);
    const lineIndex = Math.max(0, (lineNumber || 1) - 1);
    const pos = new vscode.Position(lineIndex, 0);
    await vscode.window.showTextDocument(doc, {
      selection: new vscode.Range(pos, pos),
      preview: false,
    });
    ```
  - If target is a markdown note:
    - Open with `vscode.commands.executeCommand('vscode.openWith', targetUri, MarkdownEditorProvider.viewType)`.
    - Retrieve active editor or post message:
      `{ type: 'revealLine', line: lineNumber }`.
    - If webview is newly opening, cache pending reveal request and send upon webview `'ready'` message.

### 4. CodeMirror 6 Line Highlighting (Option 2)
- Define a CodeMirror extension `lineHighlightExtension`:
  - `setHighlightLine = StateEffect.define<number | null>()`
  - `highlightLineField = StateField.define<number | null>`:
    - Holds the active 1-based line number (or null).
    - When transaction contains `setHighlightLine.of(line)`: stores the line.
    - When transaction has `tr.selection` (user moves cursor) or `tr.docChanged` (user edits): resets state to `null`.
    - Provides `Decoration.set`: produces `Decoration.line({ class: 'cm-target-line-highlight' })` for the active line.
  - Styling in theme:
    `.cm-target-line-highlight`:
    `background-color: var(--vscode-editor-lineHighlightBackground, rgba(255, 255, 0, 0.2))`
    with a left border accent:
    `border-left: 3px solid var(--vscode-editorCursor-foreground, #007acc)`.
  - On `revealLine` message in `MarkdownEditorApp.tsx`:
    - Clamp line to `Math.min(Math.max(1, message.line), view.state.doc.lines)`.
    - Determine line start pos `linePos = view.state.doc.line(clampedLine).from`.
    - Dispatch selection to `linePos`, scroll effect `EditorView.scrollIntoView(linePos, { y: 'center' })`, and `setHighlightLine.of(clampedLine)`.

## Risks / Trade-offs

- **[Risk] Webview timing when opening a new tab**
  - If the target document is opened in a new tab, posting a message immediately might occur before the webview script is loaded.
  - **Mitigation**: Cache pending line reveal in `MarkdownEditorProvider` keyed by URI, and dispatch when the webview sends its initial `'ready'` message.
- **[Risk] Path contains a colon on Windows (e.g. `C:\...`)**
  - **Mitigation**: Ensure colon matching only checks for trailing `:(\d+)$` after the file extension.

