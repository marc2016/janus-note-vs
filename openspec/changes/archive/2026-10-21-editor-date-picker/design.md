# Design: Editor Date Picker

## Context

See [proposal.md](proposal.md) for motivation.

The Janus Markdown Editor (`MarkdownEditorApp.tsx`) uses CodeMirror 6 and includes an autocomplete-based slash command extension (`slashCommands.ts`) and a fixed formatting toolbar (`MarkdownToolbar.tsx`). Currently, inserting dates requires manual typing without visual calendar aid or quick relative shortcuts (e.g. today, tomorrow).

## Goals / Non-Goals

**Goals:**
- Provide `/date` and `/datum` slash commands that trigger an interactive DatePicker popover anchored to the editor cursor.
- Provide `/today` and `/heute` slash commands that immediately insert the current date (`YYYY-MM-DD`) without opening the popover.
- Add a calendar icon button to `MarkdownToolbar` that triggers the DatePicker popover for the active cursor position.
- Implement `DatePickerPopover` with month/year navigation, quick-select buttons (*Heute*, *Morgen*, *In 1 Woche*), and an optional time field (`HH:MM`).
- Insert dates formatted in standard ISO syntax (`YYYY-MM-DD` or `YYYY-MM-DD HH:MM`), directly compatible with Janus calendar extraction.
- Ensure focus handling restores cursor focus back to the CodeMirror editor upon selection or cancellation (`Escape`).

**Non-Goals:**
- Complex recurrence rule editors (RRULE) or multi-day range pickers.
- Localized date formatting outputs (e.g. `24.10.2026`); standard ISO 8601 ensures consistency across markdown parsers and calendar tools.

## Decisions

### 1. React Popover vs. Native HTML5 Date Input
- **Decision**: Implement a custom React component (`DatePickerPopover.tsx`) styled with VS Code CSS variables.
- **Rationale**: Browser-native `<input type="date">` with `showPicker()` lacks styling customization, cannot embed quick-select shortcuts (*Heute*, *Morgen*, *In 1 Woche*), and renders inconsistently across OS environments. A React popover provides full control over layout, keyboard navigation, theme colors, and time inputs.

### 2. Slash Command Autocomplete Integration
- **Decision**: In `slashCommands.ts`, use custom `apply` functions for completion options instead of static string replacements:
  - For `/today` and `/heute`: `apply` computes today's ISO date string `YYYY-MM-DD` and replaces the `/today` range directly.
  - For `/date` and `/datum`: `apply` removes the `/date` text, computes cursor screen coordinates using `view.coordsAtPos(from)`, and triggers the popover state in `MarkdownEditorApp`.
- **Rationale**: CodeMirror's autocomplete API natively supports `apply: (view, completion, from, to) => void`, cleanly separating text replacement from custom UI triggers.

### 3. DatePicker Component Architecture
- **Location**: `src/webviews/markdown/components/DatePickerPopover.tsx`.
- **Props**:
  - `isOpen: boolean`
  - `position: { top: number; left: number }`
  - `initialDate?: Date`
  - `onSelect: (dateStr: string) => void`
  - `onClose: () => void`
- **Internal State**:
  - Active displayed month/year (`viewYear`, `viewMonth`).
  - Selected date (`selectedDate: string`).
  - Optional time string (`time: string`, e.g. `'14:00'`).
- **Positioning**:
  - Clamps the popover within viewport bounds (`window.innerWidth`, `window.innerHeight`) to prevent overflowing beneath the bottom of the window.

### 4. Insertion Format & Focus Restoration
- **Decision**:
  - If time is empty or invalid: output `YYYY-MM-DD`.
  - If valid time is provided: output `YYYY-MM-DD HH:MM`.
  - Execute text insertion via `editorView.dispatch({ changes: { from: insertPos, insert: resultText }, selection: { anchor: insertPos + resultText.length } })`.
  - Call `editorView.focus()` so the user can continue typing immediately.

## Risks / Trade-offs

- **[Risk] Cursor coordinates undefined when editor is scrolled or hidden**
  - **Mitigation**: Fall back to centered popover positioning or toolbar button bounding box if `coordsAtPos` returns null.
- **[Risk] Focus stolen by popover input elements**
  - **Mitigation**: Trap `Escape` key inside the popover to call `onClose()`, ensuring `editorView.focus()` is called on teardown.

