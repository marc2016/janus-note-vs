# Proposal

## Why

The calendar determines "today" once and never again: the Day Details panel fixes its selected day when the extension activates, and the Month View fixes today's date when its webview loads. When a window stays open over midnight, Day Details keeps showing yesterday with `Tagesnotiz öffnen`, so the button `Tagesnotiz anlegen` for the new day never appears, and the today highlight and the `Heute` button still point to the previous day. Only a window reload fixes it.

## What Changes

- The calendar re-determines the current day while the window is running: at midnight, when the window regains focus, and when the Month View or the Day Details panel becomes visible.
- When the day has changed and the selected day was the previous "today", the selection moves to the new day. Day Details then shows the new day, including `Tagesnotiz anlegen` when it has no daily note yet. A day the user selected deliberately (any day other than the previous "today") stays selected.
- The Month View's today highlight and its `Heute` button use the current day. If the Month View was showing the month of the previous "today" and the selection moved, it shows the month of the new day.
- A day selected in the Month View is remembered by the calendar host, so that later refreshes do not reset the Month View's selection to the day the calendar was opened on.

Not part of this change: a notification or badge on day change, and a hint inside yesterday's daily note that is still open. The command `janus.openDailyNote` is unaffected; it already uses the current date on every call.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `calendar-view`: new requirement that the calendar follows the current day in a running window (today highlight, `Heute`, selected day and Day Details including the daily note button).

## Impact

- `src/editors/calendarViewProvider.ts`, `src/editors/calendarDayDetailsViewProvider.ts`: current day and selection handling, `today` in webview messages.
- `src/webviews/calendar/CalendarMonthApp.tsx`: today comes from the host instead of a value frozen at load.
- `src/extension.ts`: triggers for the day check (midnight timer, window focus), disposal.
- New pure helper module for the date logic with unit tests in `tests/`.
- No new dependencies, no settings, no data format changes.
