# Tasks

## 1. DatePicker Popover Component

- [ ] 1.1 Create `DatePickerPopover.tsx` with month/year navigation, Monday-to-Sunday day grid, and quick-select buttons (*Heute*, *Morgen*, *In 1 Woche*), and verify component rendering and tests.
- [ ] 1.2 Add optional time input (`HH:MM`) and confirmation/cancel buttons with keyboard shortcuts (`Enter`, `Escape`), and verify with unit tests.

## 2. Slash Commands and Toolbar Integration

- [ ] 2.1 Update `slashCommands.ts` to register `/date`, `/datum`, `/today`, and `/heute` commands with immediate ISO insertion for `/today`/`/heute` and popover trigger callbacks for `/date`/`/datum`, and verify with unit tests.
- [ ] 2.2 Add calendar button (`$(calendar)`) to `MarkdownToolbar.tsx` that triggers the DatePicker popover, and verify toolbar rendering.
- [ ] 2.3 Wire `DatePickerPopover` state, cursor positioning, and CodeMirror text insertion into `MarkdownEditorApp.tsx`, and verify compilation with `npm run compile`.

## 3. Verification & Testing

- [ ] 3.1 Add unit tests for date calculation helpers, optional time validation, and slash command completions, and verify with `npm test`.
- [ ] 3.2 Run full build and test suite (`npm run compile` and `npm test`) to verify all existing and new tests pass with zero regressions.

