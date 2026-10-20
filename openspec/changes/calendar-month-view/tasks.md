# Tasks

## 1. Calendar Event Extraction & AI Task DueDate Support

- [ ] 1.1 Create `src/services/calendarService.ts` with `extractNoteEventsFromMarkdown` (supporting German `DD.MM.YYYY`/`DD.MM.YY`, ISO `YYYY-MM-DD`/`@YYYY-MM-DD`, optional `HH:MM` times, YAML frontmatter `date: YYYY-MM-DD`, and fenced code block exclusion) and `loadAllCalendarEntries(notesRootUri)` combining note events with `dueDate` tasks from `FolderTasksService`, and verify with unit tests in `src/test/calendarService.test.ts` (`npm test`).
- [ ] 1.2 Extend `AiTaskGeneratorService` (`src/services/aiTaskGeneratorService.ts`) to request and parse an optional `dueDate` (`YYYY-MM-DD` or German `DD.MM.YYYY` normalized to `YYYY-MM-DD`) in `parseAiExtractedTasks` and persist `dueDate` onto created `TaskItem` entries, and verify with unit tests (`npm test`).

## 2. Dual-Panel Calendar Webview Provider & React UI

- [ ] 2.1 Create `src/webviews/calendar/CalendarMonthApp.tsx`, `src/webviews/calendar/CalendarDayDetailsApp.tsx`, and `src/webviews/calendar/index.tsx` rendering the 7-column Monday–Sunday month grid (`mode: 'month'`) and the Day Details view (`mode: 'day-details'`) with note links and interactive task checkboxes, and register the `calendar` entry point in `esbuild.js` (`npm run build`).
- [ ] 2.2 Implement `CalendarViewProvider` (`src/editors/calendarViewProvider.ts`) managing the Month View `WebviewPanel` in `vscode.ViewColumn.One` and the synchronized Day Details `WebviewPanel` in `vscode.ViewColumn.Beside` (handling `selectDay`, `openNote`, `toggleTask`, and live `refresh()`), and verify with unit tests (`npm test`).

## 3. Sidebar, Command & Watcher Integration

- [ ] 3.1 Add `CalendarTreeItem` (`Kalender`) to `NotesTreeDataProvider` (`src/ui/notesTreeDataProvider.ts`) right below `AllTasksTreeItem`, contribute `janus.openCalendar` in `package.json`, and wire `CalendarViewProvider` and `CompanionWatcher` live refresh in `src/extension.ts`, verifying that `npm run compile`, `npm run build`, and `npm test` pass cleanly.

