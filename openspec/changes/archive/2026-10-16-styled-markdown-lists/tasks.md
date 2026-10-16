# Tasks

## 1. List Decoration Extension

- [x] 1.1 Create `src/webviews/markdown/extensions/styledLists.ts` with `BulletWidget` and theme classes (`cm-bullet-marker`, `cm-list-item`, `cm-list-level-*`), and verify TypeScript compilation
- [x] 1.2 Implement regex scanning for unordered lists (`- `, `* `, `+ `), nesting level calculation, and bullet replacement decorations in `styledLists.ts`
- [x] 1.3 Add hierarchical line indentation support for task list items (`- [ ]`, `- [x]`) and ordered list items (`1. `) without rendering duplicate or conflicting bullet markers
- [x] 1.4 Register the `styledLists()` extension in `src/webviews/markdown/MarkdownEditorApp.tsx` and verify a clean build via `npm run compile`

## 2. Verification & Zero-Diff Testing

- [x] 2.1 Verify nested bullet lists, task checkboxes, and ordered lists render with styled bullets and proper indentation in the Live Preview editor
- [x] 2.2 Verify zero-diff persistence: edit list items, save the document, and confirm via `git diff` that raw Markdown markers and spacing remain intact
