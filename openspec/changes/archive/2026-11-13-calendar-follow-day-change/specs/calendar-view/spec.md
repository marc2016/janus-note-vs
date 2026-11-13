# Spec Delta

## ADDED Requirements

### Requirement: Calendar Follows the Current Day
The calendar SHALL use the current local date as "today" for as long as the window is running, without requiring a reload. It SHALL re-determine today when the local date changes at midnight, when the VS Code window regains focus, and when the Calendar Month View or the Day Details panel becomes visible. After such a change, the Month View SHALL highlight the new today, and its `Heute` button SHALL navigate to and select the new today.

When today changes and the selected day is the previous today, the system SHALL select the new today instead: the Day Details panel SHALL show the new day with its entries and its daily note button as defined in "Daily Note Action in Day Details", and the Month View SHALL mark the new day as selected. If the Month View was showing the month of the previous today and the new today lies in another month, it SHALL show the month of the new today. When the selected day is any other day, the selection and the displayed month SHALL stay unchanged. The system SHALL NOT create a daily note on its own when the day changes.

#### Scenario: Window open over midnight
- **WHEN** the calendar was opened on 2026-11-12 with 2026-11-12 selected, `journal/2026-11-12.md` exists, the window stays open, and the user looks at the calendar on 2026-11-13, which has no daily note
- **THEN** the Month View highlights and selects 2026-11-13, and the Day Details panel shows 2026-11-13 with the button `Tagesnotiz anlegen`

#### Scenario: Deliberately selected day is kept
- **WHEN** today is 2026-11-12, the user has selected 2026-11-20, and the date changes to 2026-11-13
- **THEN** the Day Details panel still shows 2026-11-20 and the Month View still marks it as selected, while the today highlight moves to 2026-11-13

#### Scenario: Heute after a day change
- **WHEN** the window has been open since 2026-11-12, today is 2026-11-13, and the user clicks `Heute` in the Month View
- **THEN** the Month View shows November 2026 with 2026-11-13 selected and the Day Details panel shows 2026-11-13

#### Scenario: Day change into a new month
- **WHEN** the Month View shows November 2026 with 2026-11-30 selected as today, and the date changes to 2026-12-01
- **THEN** the Month View shows December 2026 with 2026-12-01 highlighted and selected

#### Scenario: Another month is being viewed
- **WHEN** today is 2026-11-12 and selected, the user has navigated the Month View to January 2027, and the date changes to 2026-11-13
- **THEN** the Month View keeps showing January 2027, and the Day Details panel shows 2026-11-13

#### Scenario: Computer was asleep at midnight
- **WHEN** the computer sleeps from 2026-11-12 until the morning of 2026-11-13 with 2026-11-12 selected, and the user then returns to the VS Code window
- **THEN** the calendar shows 2026-11-13 as today and as the selected day

#### Scenario: No daily note is created automatically
- **WHEN** the date changes to 2026-11-13 and the selection moves to that day
- **THEN** `journal/2026-11-13.md` does not exist until the user clicks `Tagesnotiz anlegen` or runs `janus.openDailyNote`
