# Tasks

## 1. Heading time in the editor

- [x] 1.1 Add `src/webviews/markdown/extensions/headingTime.ts` with the `StateField` that marks lines which became a `#` or `##` heading through user input (ignoring remote transactions), maps markers through changes and drops them when the line is no longer a heading; verify with unit tests in 1.3
- [x] 1.2 Add the high-precedence `Enter` binding and `headingTimeCompartment`: at the end of a marked heading with text and without a `(HH:mm)` / `(YYYY-MM-DD HH:mm)` suffix, insert ` (HH:mm)` plus the newline in one transaction and remove the marker; otherwise fall through. Enable it in `MarkdownEditorApp.tsx` only when `sortSource === 'daily'`; verify with `npm run build`
- [x] 1.3 Add `tests/headingTime.test.ts` (fake time): new heading gets the start time on `Enter`; one undo removes time and line break; template/pre-existing headings, `Enter` in the middle of the line, empty heading, a deleted time and a disabled compartment get no time; a heading created via `/h2` and a `#` heading get a time, `###` does not. Verify with `npx vitest run tests/headingTime.test.ts`

## 2. Sorting

- [x] 2.1 Add `combineHeadingTime(text, date)` in `aiInboxSorterService.ts` and apply it to daily note blocks before appending and before creating a note; verify with new cases in `tests/aiInboxSorting.test.ts` for append (`## Call mit Anna (2026-10-27 14:32)`), create, a block without time (unchanged `(2026-10-27)` suffix) and inbox sorting (unchanged)
- [x] 2.2 Run `npm test` and `npm run build`; all tests pass

## 3. Sample and manual check

- [x] 3.1 In `sample/journal/2026-10-29.md` give one entry a time (e.g. `## Call mit Anna: Crash-Reporting (09:40)`) and describe trying the feature in the daily note section of `sample/project-plan.md`; verify `npm test` still passes (tests read sample files)
- [x] 3.2 Manual check: in today's daily note type a new `##` heading, press `Enter` at its end and check the time; check `Cmd+Z`, a template heading, `inbox.md`, and that sorting the entry produces `(YYYY-MM-DD HH:mm)` in the target
