# Spec Delta

## ADDED Requirements

### Requirement: Date Picker Slash Commands and Toolbar Action
The system SHALL provide interactive slash commands (`/date`, `/datum`, `/today`, `/heute`) and a dedicated calendar toolbar button in the Markdown editor to insert ISO-formatted dates and optional times.

#### Scenario: Triggering DatePicker via /date or /datum slash command
- **WHEN** user types `/date` or `/datum` and confirms the autocomplete command in the Markdown editor
- **THEN** the slash command text is removed and a DatePicker popover appears anchored to the cursor position

#### Scenario: Directly inserting today's date via /today or /heute
- **WHEN** user types `/today` or `/heute` and confirms the autocomplete command
- **THEN** the command text is immediately replaced with the current date in ISO format (`YYYY-MM-DD`) without opening the popover

#### Scenario: Opening DatePicker from the formatting toolbar
- **WHEN** user clicks the calendar button in the Markdown editor toolbar
- **THEN** the DatePicker popover opens for the active cursor position

#### Scenario: Selecting a date and optional time in the popover
- **WHEN** user selects a date (e.g. `2026-10-24`) and optionally enters a time (e.g. `14:00`) in the DatePicker popover and confirms
- **THEN** the formatted ISO string (`2026-10-24` or `2026-10-24 14:00`) is inserted at the cursor position, the popover closes, and keyboard focus returns to the editor

#### Scenario: Canceling the DatePicker popover
- **WHEN** user presses `Escape` or clicks outside the DatePicker popover
- **THEN** the popover closes without modifying editor content and keyboard focus returns to the editor

