# Tasks

## 1. Candidate Scanning and Webview Data Pipeline

- [ ] 1.1 Implement candidate discovery function in `src/companion/noteLinking.ts` to locate notes, companions, images, and document files in `notesRoot`, and verify with unit tests.
- [ ] 1.2 Update `MarkdownEditorProvider.ts` to push candidate file lists to the Markdown editor webview on `init` and file change events, and verify compilation.

## 2. CodeMirror Autocomplete and Trigger Integrations

- [ ] 2.1 Implement `linkAutocomplete` extension in `src/webviews/markdown/extensions/linkAutocomplete.ts` matching `[[` triggers and rendering items with type icons, and verify with unit tests.
- [ ] 2.2 Add `/link`, `/verlinken`, and `/note` slash commands to `slashCommands.ts` that insert `[[` and trigger link completion, and verify with unit tests.
- [ ] 2.3 Implement `Cmd+K` / `Ctrl+K` keybinding in editor formatting keymap to wrap selected text in `[[...]]` or insert `[[` when collapsed, and verify keymap behavior.
- [ ] 2.4 Add link button (`$(link)`) to `MarkdownToolbar.tsx` and wire it to dispatch link completion in `MarkdownEditorApp.tsx`, and verify compilation.

## 3. Verification & Testing

- [ ] 3.1 Add unit tests for candidate filtering, wiki-link insertion, and keybinding actions, and verify with `npm test`.
- [ ] 3.2 Run full build and test suite (`npm run compile` and `npm test`) to verify all existing and new tests pass with zero regressions.

