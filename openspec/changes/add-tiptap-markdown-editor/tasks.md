# Tasks: TipTap Markdown WYSIWYG Editor

## 1. Dependencies and Base Styles

- [x] 1.1 Verify TipTap packages are installed in `package.json` (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `@tiptap/extension-task-list`, `@tiptap/extension-task-item`, `tiptap-markdown`)
- [x] 1.2 Define ProseMirror, task list, and typography CSS tokens in `src/webviews/styles/globals.css` and verify Tailwind v4 compilation with `npm run build`

## 2. Webview Editor Component

- [x] 2.1 Implement `src/webviews/markdown/MarkdownEditorApp.tsx` with TipTap editor, extensions, and debounced bidirectional updates
- [x] 2.2 Implement fixed top toolbar with shadcn/ui buttons and `@mdi/js` icons (Undo/Redo, Headings H1-H3, Bold, Italic, Strikethrough, Code, Bullet/Numbered/Task Lists, Blockquote, Code Block, Horizontal Rule)
- [x] 2.3 Create `src/webviews/markdown/index.tsx` mounting root and add `markdown` entry point in `esbuild.js`

## 3. Extension Host Provider & Registrations

- [x] 3.1 Implement `src/editors/markdownEditorProvider.ts` handling document lifecycle, bidirectional message exchange, and split view opening
- [x] 3.2 Register `MarkdownEditorProvider` and `janus.openMarkdownEditor` command in `src/extension.ts`
- [x] 3.3 Register `janus.markdownEditor` custom editor in `package.json` with `priority: "option"`
- [x] 3.4 Add `$(edit) Rich Editor` CodeLens in `src/companion/companionCodeLensProvider.ts`

## 4. Verification and Integration

- [x] 4.1 Run `npm run compile` and verify 0 TypeScript diagnostic errors
- [x] 4.2 Run `npm run build` and verify `dist/webviews/markdown.js` is bundled cleanly without external network dependencies
- [x] 4.3 Run `npm test` and verify all test suites pass
