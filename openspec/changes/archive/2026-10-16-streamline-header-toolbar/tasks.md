# Tasks

## 1. MarkdownToolbar Updates

- [x] 1.1 Add `onOpenSource?: () => void` to `MarkdownToolbarProps` in `src/webviews/markdown/components/MarkdownToolbar.tsx` and verify TypeScript compiles without error
- [x] 1.2 Add a visual separator and the "Quelltext bearbeiten" action button at the end of `MarkdownToolbar` (styled with `ml-auto`) invoking `onOpenSource` when clicked

## 2. Streamline MarkdownEditorApp

- [x] 2.1 Remove the top application `<header>` element from `src/webviews/markdown/MarkdownEditorApp.tsx` and eliminate manual theme toggle states and handlers
- [x] 2.2 Pass `handleOpenSource` as `onOpenSource` to `<MarkdownToolbar />` and clean up unused imports (`Badge`, `mdiThemeLightDark`, `themeMode` types)

## 3. Verification & Build

- [x] 3.1 Run `npm run compile` (or `npm run build`) to verify clean type checking and webview bundle creation with no compilation errors
