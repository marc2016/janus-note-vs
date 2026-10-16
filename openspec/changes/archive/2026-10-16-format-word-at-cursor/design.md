# Design

## Context

In `src/webviews/markdown/components/MarkdownToolbar.tsx`, inline formatting (`toggleInlineMark`) currently handles two selection states:
1. `sel.from !== sel.to`: Wraps the active selection or strips existing surrounding markers.
2. `sel.from === sel.to`: If the cursor is inside a parsed syntax node matching the marker (`StrongEmphasis`, `Emphasis`, `Strikethrough`, `InlineCode`), it removes the mark. Otherwise, it simply inserts empty markers `${marker}${marker}` at the cursor offset (`sel.from`).

When a user's cursor is positioned within a word (e.g. `foo|bar`) without an active selection, inserting markers produces `foo**|**bar` instead of formatting the word. Furthermore, standard formatting keyboard shortcuts (`Mod-b`, `Mod-i`) are not currently registered in the CodeMirror editor keymap.

## Goals / Non-Goals

**Goals:**
- Automatically expand the formatting target to the surrounding word boundaries when the cursor is collapsed (`from === to`) inside or directly touching a word.
- Support all inline mark types: Bold (`**`), Italic (`*`), Strikethrough (`~~`), and Inline Code (`` ` ``).
- Maintain existing node unwrap behavior if the word or node is already formatted with the requested mark.
- Retain empty marker insertion (`****`) when cursor is at whitespace or on an empty line.
- Provide a unified command helper used by both toolbar buttons and CodeMirror keyboard shortcuts (`Mod-b`, `Mod-i`, `Mod-e`).

**Non-Goals:**
- Multi-word heuristic expansions across spaces or punctuation.
- Changing block-level formatting logic (headings, lists, blockquotes, tables).

## Decisions

### 1. Word Boundary Resolution via `EditorState.wordAt(pos)`
- **Decision**: Use CodeMirror's built-in `state.wordAt(pos)` to determine word boundaries around the cursor.
- **Rationale**: `wordAt` accurately detects word ranges taking into account Unicode word characters and language boundaries, while naturally excluding trailing punctuation (e.g., in `hello, world`, targeting `hello` formats as `**hello**, world`).
- **Alternative considered**: Custom regex parsing on `line.text`. Rejected as redundant and more error-prone with multi-byte or Unicode characters.

### 2. Unified Formatting Helper
- **Decision**: Extract formatting logic into a reusable helper function (e.g. `toggleInlineFormatting(view: EditorView, marker: string): boolean`) located in `src/webviews/markdown/lib/formatting.ts` or directly within the editor extensions.
- **Rationale**: Allows both `MarkdownToolbar.tsx` and keymap definitions in `MarkdownEditorApp.tsx` (or a dedicated keymap extension) to share the exact same behavior without code duplication.

### 3. Cursor & Selection Handling
- **Decision**: When formatting a word at collapsed cursor, update the selection anchor and head so the cursor remains at the corresponding position inside the formatted word (shifted by `marker.length`), preserving seamless writing flow.

## Risks / Trade-offs

- **[Risk]** Overlapping marks (e.g. word is already Italic `*word*`, and user applies Bold).
  - *Mitigation*: If the cursor is inside `*word*`, `wordAt` identifies `word`. Applying bold produces `***word***` (or `** *word* **` depending on boundaries), which is valid Markdown syntax. Syntax tree checks ensure we only unwrap when the target mark matches the requested marker.
