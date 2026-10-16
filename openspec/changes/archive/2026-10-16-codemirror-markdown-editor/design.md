# Design: CodeMirror 6 Live-Preview Markdown Editor

## Context

See [proposal.md](file:///Users/marclammers/sources/janus-note-vs/openspec/changes/codemirror-markdown-editor/proposal.md) for motivation and problem background.

The existing Markdown editor in `janus.markdownEditor` (`src/webviews/markdown/MarkdownEditorApp.tsx`) was built using TipTap (ProseMirror). TipTap parses the entire Markdown file into an in-memory Abstract Syntax Tree (AST) and re-serializes it back to Markdown using `tiptap-markdown`. Even with strict configuration, re-serialization alters trivia, normalizes block spacing, inserts unwanted backslashes, and modifies untouched lines across the document.

To eliminate git diff noise while preserving a visual editing experience, we adopt the architecture used by modern note-taking tools like Obsidian: a raw text editor based on **CodeMirror 6** equipped with dynamic View Decorations for in-place live preview, transactional toolbar manipulations, and `@codemirror/autocomplete` for slash commands.

## Goals / Non-Goals

**Goals:**
- Maintain 100% byte fidelity: the document is stored as a raw text string; only exact character ranges modified by the user are touched in transactions.
- In-place Live Preview: Render headings, task lists, bold/italic, and code blocks visually while editing, revealing raw markdown markers (`# `, `**`, etc.) when the cursor enters the active line.
- Fixed Top Formatting Toolbar: Provide a sticky toolbar with shadcn/ui buttons and `@mdi/js` icons that dispatches atomic CodeMirror transactions.
- Interactive Slash Commands: Trigger an autocomplete menu when typing `/` at word/line boundaries to insert templates (`/tasks`, `/table`, `/callout`, `/chart`, `/h1`).
- Interactive Task Checkboxes: Render `- [ ]` as clickable visual checkboxes that toggle to `- [x]` by updating a single character.

**Non-Goals:**
- Dual-pane split preview (side-by-side raw markdown and HTML view). The target is unified in-place Live Preview.
- WYSIWYG rich text without markdown syntax. Raw syntax is a first-class feature that is selectively concealed and revealed.
- Custom AST serialization or schema validations on file save.

## Decisions

### 1. CodeMirror 6 text engine instead of ProseMirror / TipTap / Monaco
- **Choice**: CodeMirror 6 (`@codemirror/view`, `@codemirror/state`, `@codemirror/lang-markdown`).
- **Rationale**: CM6 represents documents as immutable string ropes (`Text`). Edits are represented as atomic change sets (`ChangeSet`). CM6 does not enforce a rigid block AST schema; markdown is parsed incrementally via Lezer for syntax highlighting and decorations, meaning the underlying document is never re-serialized.
- **Alternatives Considered**:
  - *Keep TipTap with custom serializer*: Tried and proved brittle; CommonMark serializers unavoidably normalize whitespace and block boundaries.
  - *Monaco Editor*: Monaco is heavier, lacks native lightweight decoration widgets for inline live preview (like Obsidian), and has higher bundle overhead in webviews.
  - *MDXEditor*: Also relies on Lexical AST under the hood and re-serializes on export, presenting the same diffing pitfalls.

### 2. ViewPlugin and Decoration-based Live Preview (Obsidian Approach)
- **Choice**: Implement a custom CM6 `ViewPlugin` providing `DecorationSet`.
  - For headings: Apply `Decoration.line` with heading classes (e.g., `cm-heading-1`), and `Decoration.replace` over `# ` markers when the editor selection (`view.state.selection.main`) is outside that line.
  - For inline marks (bold `**`, italic `*`, inline code `` ` ``): Apply `Decoration.mark` with styling, concealing the delimiter tokens when unfocused.
  - When the cursor moves into a line, all conceal decorations on that line are omitted, exposing the raw markdown text for natural editing.
- **Rationale**: Matches user expectations from Obsidian. Cleanly separates presentation from document storage without modifying document state.
- **Alternatives Considered**:
  - *CSS-only hiding*: Inadequate for hiding syntax prefixes like `# ` while preserving proper cursor placement.
  - *Block-level widgets*: Replacing entire lines with DOM elements breaks cursor navigation and copy-paste.

### 3. Fixed Formatting Toolbar via Transaction Dispatchers
- **Choice**: A React component rendered above the CM6 container. It inspects `view.state.selection` to determine active formatting and dispatches transactions using standard CM6 helpers:
  - Inline formatting (e.g. Bold): wraps selection in `**...**` or strips if already wrapped.
  - Block formatting (e.g. Heading): prepends `# ` at the line start using `line.from`.
  - Block templates (e.g. Table, Code block): inserts markdown snippets at `selection.main.from`.
- **Rationale**: Keeps React in charge of UI buttons/tooltips/icons while delegating all text manipulation to CodeMirror transactions.

### 4. Slash Commands via `@codemirror/autocomplete`
- **Choice**: Implement a custom completion source configured in `@codemirror/autocomplete`:
  ```ts
  function slashCommandSource(context: CompletionContext) {
    let word = context.matchBefore(/(?:^|\s)\/([a-zA-Z0-9-]*)/);
    if (!word) return null;
    return {
      from: word.from + (word.text.startsWith('/') ? 0 : 1),
      options: [
        { label: '/tasks', detail: 'Task List item', apply: '- [ ] ' },
        { label: '/h1', detail: 'Heading 1', apply: '# ' },
        { label: '/table', detail: 'Markdown Table', apply: '| Column 1 | Column 2 |\n| --- | --- |\n| Item 1 | Item 2 |\n' },
        { label: '/callout', detail: 'Callout note', apply: '> [!NOTE]\n> ' },
        { label: '/chart', detail: 'Mermaid Chart', apply: '```mermaid\ngraph TD;\n    A-->B;\n```\n' }
      ]
    };
  }
  ```
- **Rationale**: Uses native CM6 autocomplete popup navigation, keyboard handling (arrows, enter, escape), and fuzzy matching without custom overlay positioning bugs.

### 5. Interactive Checkbox Widget
- **Choice**: Implement a `WidgetType` in CM6 that replaces `- [ ] ` and `- [x] ` with a styled checkbox element (`<input type="checkbox">`).
  - On click, the widget handler intercepts the mouse event, computes the document position of the space or `x`, and dispatches a transaction:
    ```ts
    view.dispatch({
      changes: { from: boxPos, to: boxPos + 1, insert: isChecked ? ' ' : 'x' }
    });
    ```
- **Rationale**: Zero diff outside of the single toggled character ` ` <-> `x`. Instant visual feedback with perfect git hygiene.

## Risks / Trade-offs

- **[Risk]** Cursor navigation artifacts when entering/leaving concealed decoration ranges.
  → **Mitigation**: Conceal decorations only deactivate at whole-line granularity when the cursor intersects the line, avoiding sub-line jitter.
- **[Risk]** Performance degradation on large markdown documents with complex decoration calculation.
  → **Mitigation**: CodeMirror 6 processes decorations lazily per viewport range using `view.visibleRanges`.
- **[Risk]** Webview host message synchronization conflicts.
  → **Mitigation**: The editor dispatches changes to VS Code host via `vscode.postMessage({ type: 'edit', text })` on a short debounce (e.g. 300ms) or on blur/save.

## Migration Plan

1. Install CodeMirror 6 packages:
   - `@codemirror/view`, `@codemirror/state`, `@codemirror/language`, `@codemirror/lang-markdown`, `@codemirror/autocomplete`, `@codemirror/commands`.
2. Implement CodeMirror extensions:
   - `livePreviewExtension`: Line-level heading styles & delimiter hiding.
   - `taskCheckboxExtension`: Interactive widget for task lists.
   - `slashCommandsExtension`: Autocomplete completions for `/`.
3. Implement `MarkdownEditorApp.tsx` and `MarkdownToolbar.tsx`:
   - Integrate React layout with CodeMirror container.
   - Bind toolbar buttons to CM6 transaction dispatches.
4. Remove TipTap dependencies (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-*`, `tiptap-markdown`).
5. Verify zero-diff persistence against real markdown files.
