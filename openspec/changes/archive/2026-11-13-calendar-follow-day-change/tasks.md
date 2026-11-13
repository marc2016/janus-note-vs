# Tasks

## 1. Date logic

- [x] 1.1 Add `src/services/calendarToday.ts` (no `vscode` import) with `todayIso`, `msUntilNextDay`, `followDayChange` and `followMonth` as described in design.md decision 2; verify with `npm run compile`
- [x] 1.2 Add `tests/calendarToday.test.ts`: `todayIso` uses the local date; `msUntilNextDay` at 23:59:30 and at 00:00:00; `followDayChange` for "selected is previous today", "other day selected" and "nothing selected"; `followMonth` for same month, month change (2026-11-30 -> 2026-12-01), year change, and "another month shown". Verify with `npx vitest run tests/calendarToday.test.ts`

## 2. Extension host

- [x] 2.1 `CalendarViewProvider`: keep `currentToday`, use `todayIso` instead of the hand-rolled formatter, include `today` in the Month View's initial data and in `updateEvents`, and store `message.date` in `selectedDate` on `selectDay`; verify with `npm run compile` and that selecting a day and then saving a note no longer resets the Month View selection
- [x] 2.2 `CalendarViewProvider.checkDayChange()`: on a changed date apply `followDayChange`, pass the new selection to the Day Details provider with `setSelectedDate(date, false)`, update `currentToday`, and refresh with `today` and `previousToday`; call it from `open()` and from the Month panel's `onDidChangeViewState` when visible; verify with `npm run compile`
- [x] 2.3 `CalendarDayDetailsViewProvider`: use `todayIso` for the initial selection and call the day check when the view becomes visible (`onDidChangeVisibility`), via a callback passed in from `extension.ts`; verify with `npm run compile`
- [x] 2.4 `extension.ts`: arm the midnight timer with `msUntilNextDay` (+1 s, re-armed after each run), call the day check on `vscode.window.onDidChangeWindowState` when focused, and dispose timer and listener through `context.subscriptions`; verify with `npm run compile`

## 3. Month View webview

- [x] 3.1 `CalendarMonthApp.tsx`: replace the memoised `today` with state initialised from `initialData.today` (fallback: local clock) and updated from messages; highlight and `handleToday` use it; verify with `npm run build`
- [x] 3.2 `CalendarMonthApp.tsx`: when a message carries `previousToday`, apply `followMonth` to the shown `year`/`month`; verify with `npm run build`

## 4. Verification

- [x] 4.1 Run `npm test` and `npm run build`; all tests pass
- [x] 4.2 Manual check: open the calendar with today selected, set the system date to the next day (or wait over midnight) and refocus the window: the today highlight and the selection move, Day Details shows the new day with `Tagesnotiz anlegen`, `Heute` selects the new day, and no daily note was created. Repeat with another day selected: the selection stays, only the highlight moves
