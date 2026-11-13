# Design

## Context

See proposal.md for the motivation. Observed state of the code:

- `CalendarDayDetailsViewProvider` sets `selectedDate` to today in its constructor (extension activation). It changes only through `setSelectedDate`, which is called when the Month View posts `selectDay`.
- `CalendarMonthApp` computes `today` with `useMemo(() => new Date(), [])`. The panel uses `retainContextWhenHidden`, so this value lives until the panel is closed or the window reloads. Highlight and `Heute` both use it.
- `CalendarViewProvider.open()` sets `this.selectedDate = this.selectedDate || todayIso` and never updates it on `selectDay` (only `openDayDetails` writes it, and that runs only when the split `dayDetailsPanel` exists, which nothing creates). `refresh()` posts this stale value as `selectedDate` to the Month View, so a refresh after a file change resets the Month View's selection to the day the calendar was opened on.
- Nothing in the extension reacts to time passing: no timer, no window-state or visibility listener for the calendar.
- The daily note button already depends only on `selectedDate` (`getDailyNoteState`), so it becomes correct as soon as the selection is correct.

## Goals / Non-Goals

**Goals:**

- One place that knows the current day; both webviews get it from the extension host.
- Date logic as pure functions that vitest can cover without VS Code.
- Robust against missed timers (sleep, throttling).

**Non-Goals:**

- No change to how entries are extracted or to the daily note command.
- No persistence of the selection across window reloads.
- No removal of the unused split `dayDetailsPanel` code path.

## Decisions

### 1. The extension host owns "today" and pushes it to the webviews

`CalendarViewProvider` keeps `currentToday` (ISO string) and includes `today` in the Month View's initial data and in every `updateEvents` message. `CalendarMonthApp` holds `today` in state, initialised from the initial data (falling back to its own clock) and replaced whenever a message carries `today`. Highlight and `handleToday` read that state.

Alternative considered: let the webview run its own midnight timer. Rejected, because the selection logic lives in the host (Day Details is a second webview), so two clocks would have to agree, and webview timers are throttled while hidden.

### 2. Pure helper module `src/services/calendarToday.ts`

No `vscode` import, so it can be unit tested like `dailyNotePaths.ts`:

- `todayIso(now: Date): string` - reuses `formatDailyNoteDate`.
- `msUntilNextDay(now: Date): number` - milliseconds to the next local midnight, computed with `new Date(y, m, d + 1)` so DST days are right.
- `followDayChange(selected, previousToday, today)` - returns `today` when `selected === previousToday` (or `selected` is undefined), otherwise `selected`.
- `followMonth(shown: {year, month}, previousToday, today)` - returns the month of `today` when `shown` is the month of `previousToday`, otherwise `shown`.

The two existing hand-rolled `YYYY-MM-DD` formatters in the providers are replaced by `todayIso`.

### 3. One check function, several triggers

`CalendarViewProvider.checkDayChange()` compares `todayIso(new Date())` with `currentToday`. If unchanged it does nothing. If changed it:

1. computes the new selection with `followDayChange` and stores it in itself and, via `setSelectedDate(date, false)`, in the Day Details provider (without revealing the view),
2. stores the new `currentToday`,
3. calls `refresh()`, which posts `today`, `selectedDate` and, when the selection followed, the new `year`/`month` (only if the webview's shown month should follow - see decision 4).

Triggers, all calling `checkDayChange()`:

- a `setTimeout` for `msUntilNextDay(now) + 1000`, re-armed after each run; its handle is disposed with the extension,
- `vscode.window.onDidChangeWindowState` when `focused` becomes true,
- the Day Details view's `onDidChangeVisibility` when visible,
- the Month panel's `onDidChangeViewState` when visible, and `open()`.

The timer alone is not enough: after sleep it can fire late or be coalesced. Focus and visibility cover that case, and the check is cheap (a string compare) when nothing changed.

Alternative considered: `setInterval` every minute. Rejected as needless wake-ups; the triggers above cover every moment the user can actually see the calendar.

### 4. Displayed month follows in the webview

The host does not know which month the Month View currently shows (navigation is local webview state). So the host sends `previousToday` along with `today` on a day change, and the webview applies `followMonth` to its own `year`/`month` state. Outside a day change the message carries no `previousToday` and the shown month is left alone.

Alternative considered: report every month navigation to the host. Rejected, more message traffic and state duplication for one edge case.

### 5. The host records the selection on `selectDay`

`handleMessage('selectDay')` sets `this.selectedDate = message.date` before forwarding to Day Details. Without this, `followDayChange` would compare against a stale selection and `refresh()` would keep resetting the Month View. This fixes the reset described in Context as a side effect; it is required for the follow logic to be correct.

The Day Details provider's constructor no longer needs its own clock: it takes the initial selection from `todayIso(new Date())` as before, and from then on is driven by `setSelectedDate`.

## Risks / Trade-offs

- [Selection jumps while the user is reading yesterday's details at midnight] -> Accepted and specified: only a selection equal to the previous today moves. The user can click the previous day again.
- [Timer fires slightly before the date flips] -> One second of slack is added; if the date is still unchanged the check is a no-op and the timer re-arms for the next midnight, while focus/visibility triggers catch up.
- [Day Details view not yet resolved] -> `setSelectedDate` still stores the date; `refresh()` is a no-op without a view and the `ready` message triggers a refresh with the stored date later.
- [System clock or time zone changes] -> Covered by the same check on the next focus or visibility change; the timer may be off until then.
