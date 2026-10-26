# Proposal

## Why

Pressing `Tab` in the Janus Markdown Editor does not indent anything: the CodeMirror keymap is built from `defaultKeymap`, which intentionally leaves `Tab` unbound, so the keypress falls through to the webview and moves focus away from the editor. Users cannot nest list items or indent text the way every other Markdown editor (Obsidian, Typora, VS Code with Markdown All in One) allows.

## What Changes

- **List-aware Tab / Shift-Tab**: When the cursor or selection is inside a list item (bullet, ordered, or task), `Tab` nests the item one level deeper under its previous sibling and `Shift-Tab` moves it one level up. Child items move along with their parent. Multi-line selections indent/outdent every touched list item.
- **CommonMark-correct indentation width**: A nested item is indented to the content column of its parent marker (`- ` → 2 spaces, `1. ` → 3 spaces, `10. ` → 4 spaces), so the resulting Markdown nests correctly in any CommonMark/GFM renderer (including PDF export). Indentation uses spaces, never tab characters.
- **Ordered list renumbering**: When an ordered item is nested, the new sub-list starts at `1.` and the remaining items of the parent list are renumbered; outdenting renumbers analogously (Obsidian-style). *Assumption chosen during exploration — easy to drop if not wanted.*
- **Plain Tab outside lists**: Outside list items, `Tab` / `Shift-Tab` indent and outdent the current line(s) by one indent unit (2 spaces).
- **Precedence**: Table cell navigation and open autocomplete popups keep handling `Tab` themselves; the new bindings only apply when nothing more specific consumes the key. `Esc` followed by `Tab` still moves focus out of the editor (CodeMirror accessibility convention).
- **Nesting-level styling fix**: List level decorations in `styledLists` are derived from actual list nesting instead of `floor(indent / 2)`, so ordered lists indented by 3 spaces (and lists nested under wide markers like `10. `) render at the correct visual depth.

## Capabilities

### New Capabilities
<!-- None; extending the existing markdown-editor capability -->

### Modified Capabilities
- `markdown-editor`: Adds a requirement for Tab / Shift-Tab indentation (list-aware, CommonMark widths, renumbering, precedence) and changes the hierarchical list styling requirement so visual nesting depth follows actual list structure rather than raw whitespace count.

## Impact

- `src/webviews/markdown/MarkdownEditorApp.tsx`: Register the new indentation keymap in the editor extensions.
- `src/webviews/markdown/lib/` (new module, e.g. `listIndentation.ts`): Commands for list-aware indent/outdent, renumbering, and plain-line fallback.
- `src/webviews/markdown/extensions/styledLists.ts`: Compute nesting level from list structure.
- `tests/`: New unit tests for indentation commands and updated list-level styling tests.
- No new dependencies; uses `@codemirror/commands` (`indentMore` / `indentLess`) and `@codemirror/language` already installed.
