# Tasks

## 1. Package Installation & Extension Setup

- [x] 1.1 Install `codemirror-markdown-tables` and provide TypeScript declarations in `src/types/codemirror-markdown-tables.d.ts`
- [x] 1.2 Implement `styledTables` in `src/webviews/markdown/extensions/styledTables.ts` configuring `markdownTables` with VS Code dark and light theme tokens
- [x] 1.3 Ensure safe fallback in headless environments (`typeof window === 'undefined'`) for vitest compatibility

## 2. Editor Registration & Verification

- [x] 2.1 Register `styledTables()` in `src/webviews/markdown/MarkdownEditorApp.tsx` alongside other Live Preview extensions
- [x] 2.2 Run unit tests (`npm test`) and verify all tests pass without regressions
- [x] 2.3 Run full build (`npm run build`) and verify compilation and bundle output without TypeScript errors
