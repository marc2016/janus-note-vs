# Proposal: Editor Date Picker

## Why

Typing dates and times manually into Markdown notes (for deadlines, meeting logs, or calendar scheduling) is tedious, prone to syntax errors, and disconnects note-taking from calendar workflows. Providing intuitive slash commands and an interactive visual DatePicker popover in the Janus Markdown Editor streamlines inserting correctly formatted dates that seamlessly feed into the Janus Calendar view.

## What Changes

- Add `/date` and `/datum` slash commands in the Markdown editor autocomplete list that launch an interactive DatePicker popover directly at the cursor position.
- Add `/today` and `/heute` slash commands that immediately insert the current date in ISO format (`YYYY-MM-DD`) without opening the popover.
- Add a calendar action button (`$(calendar)`) to the fixed `MarkdownToolbar` that opens the DatePicker popover for the current cursor location.
- Implement a lightweight, VS Code-themed React `DatePickerPopover` component featuring:
  - Interactive month and year navigation with a full day grid (Monday to Sunday).
  - Quick-pick shortcut buttons (*Heute*, *Morgen*, *In 1 Woche*).
  - An optional time input field (`HH:MM`) for scheduled events.
  - Standard ISO format output (`YYYY-MM-DD` or `YYYY-MM-DD HH:MM`).
  - Keyboard accessibility: `Enter` to confirm, `Escape` to cancel, returning focus directly to the editor.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `markdown-editor`: Add requirement for Date Picker slash commands and toolbar action.

## Impact

- **Affected Code**:
  - `src/webviews/markdown/components/DatePickerPopover.tsx`: New popover component for visual calendar selection and optional time entry.
  - `src/webviews/markdown/extensions/slashCommands.ts`: Register `/date`, `/datum`, `/today`, and `/heute` autocomplete items and custom action execution.
  - `src/webviews/markdown/components/MarkdownToolbar.tsx`: Add calendar icon button with active/open state.
  - `src/webviews/markdown/MarkdownEditorApp.tsx`: State management for date picker coordinates, insertion position, and text dispatch into CodeMirror.
- **Dependencies**: No external packages required; builds on existing React, CodeMirror 6 view/state, and VS Code Codicon infrastructure.

