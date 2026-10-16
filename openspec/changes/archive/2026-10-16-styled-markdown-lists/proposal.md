# Proposal

## Why

Markdown bullet lists currently display raw hyphens (`- `) or asterisks (`* `) with standard monospaced/plain-text indentation in the CodeMirror Live Preview editor. This gives lists an unpolished plain-text appearance rather than a clean, modern document reading and writing experience. Users expect unordered lists to render styled visual bullet points (`•`) and visually distinct hierarchical indentation when nesting items, without sacrificing the underlying raw Markdown text fidelity.

## What Changes

- **Visual Bullet Rendering (Permanent Visual Bullet)**: Render bullet list items (`- `, `* `, `+ `) with clean typographic bullet points (`•`) using visual decorations in CodeMirror 6, replacing the literal marker characters while keeping editing smooth and jump-free.
- **Hierarchical Visual Indentation**: Apply visual indentation styling to list lines based on nesting depth (indentation whitespace count), rendering nested list items with proportional `padding-left`.
- **Task List Compatibility**: Ensure task checkboxes (`- [ ]`, `- [x]`) coexist harmoniously with list indentation and are not erroneously replaced by standard bullet decorations.
- **Ordered List Indentation**: Ensure nested ordered list items (`1. `, `2. `) also receive hierarchical visual indentation matching unordered lists.
- **Zero-Diff Text Integrity**: Guarantee that all list decorations remain purely non-destructive visual presentations in the CodeMirror DOM. Raw file bytes remain strictly intact with standard Markdown markers and exact whitespace upon save.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `markdown-editor`: Adds requirement for hierarchical list styling, specifying that unordered lists render typographic bullets and nested lists render proportional indentation in Live Preview while preserving raw markdown markers and exact whitespace.

## Impact

- Affects `src/webviews/markdown/extensions/` (new extension `styledLists.ts` or enhancement of `livePreview.ts`).
- Affects `src/webviews/markdown/MarkdownEditorApp.tsx` (extension registration).
- No backend extension changes or schema/file format changes; 100% compatible with existing markdown files.
