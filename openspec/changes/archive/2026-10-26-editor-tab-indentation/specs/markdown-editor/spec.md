# Spec Delta

## ADDED Requirements

### Requirement: Tab Key Indentation
The system SHALL handle `Tab` and `Shift-Tab` inside the Janus Markdown Editor to indent and outdent content following common Markdown editor conventions, keeping keyboard focus in the editor. Inside list items (unordered, ordered, and task items), `Tab` SHALL nest the item one level deeper under its previous sibling and `Shift-Tab` SHALL move it one level up, carrying its child items along. Nested items SHALL be indented with spaces to the content column of the parent list marker as defined by CommonMark (e.g. 2 spaces under `- `, 3 spaces under `1. `, 4 spaces under `10. `). Outside list items, `Tab` and `Shift-Tab` SHALL indent and outdent the affected lines by one indent unit of 2 spaces. Table cell navigation and open autocomplete popups SHALL take precedence over these bindings.

#### Scenario: Nesting a bullet list item
- **WHEN** the cursor is anywhere on the line `- Child` that directly follows the sibling `- Parent` and the user presses `Tab`
- **THEN** the line becomes `  - Child` (indented by 2 spaces) and the cursor stays at the same position relative to the item text

#### Scenario: Nesting an ordered list item uses the parent marker width
- **WHEN** the cursor is on the second item of the list `1. First` / `2. Second` and the user presses `Tab`
- **THEN** the second item is indented by 3 spaces so that it renders as a nested list under `1. First` in any CommonMark/GFM renderer

#### Scenario: Renumbering ordered lists on nesting
- **WHEN** the user presses `Tab` on `2. Second` in the list `1. First` / `2. Second` / `3. Third`
- **THEN** the nested item is renumbered to start a new sub-list at `1.` and the following parent-level item is renumbered from `3.` to `2.`

#### Scenario: Outdenting a nested list item
- **WHEN** the cursor is on the nested item `  - Child` below `- Parent` and the user presses `Shift-Tab`
- **THEN** the line becomes `- Child` at the parent's indentation level and, for ordered lists, the affected list items are renumbered consecutively

#### Scenario: Child items move with their parent
- **WHEN** the user presses `Tab` or `Shift-Tab` on a list item that has nested child items
- **THEN** the item and all of its child items shift by the same amount, preserving their relative nesting

#### Scenario: Indenting multiple selected list items
- **WHEN** the selection spans several list items and the user presses `Tab` or `Shift-Tab`
- **THEN** every list item touched by the selection is indented or outdented by one level and the selection is preserved over the same text

#### Scenario: Task list items are indented like bullets
- **WHEN** the cursor is on the task item `- [ ] Subtask` following the sibling `- [ ] Task` and the user presses `Tab`
- **THEN** the line becomes `  - [ ] Subtask` and its checkbox remains interactive

#### Scenario: No change at the list boundary
- **WHEN** the user presses `Tab` on the first item of a list (no previous sibling to nest under) or `Shift-Tab` on a top-level list item
- **THEN** the document remains unchanged and keyboard focus stays in the editor

#### Scenario: Indenting plain text outside lists
- **WHEN** the cursor is on a line that is not a list item and the user presses `Tab`
- **THEN** the line is indented by 2 spaces, and pressing `Shift-Tab` removes up to 2 spaces of leading indentation

#### Scenario: Only spaces are written
- **WHEN** the user indents any content with `Tab`
- **THEN** the document contains only space characters as inserted indentation and no tab characters

#### Scenario: Table cell navigation keeps priority
- **WHEN** the cursor is inside a table cell and the user presses `Tab` or `Shift-Tab`
- **THEN** the cursor navigates between table cells as before and no indentation is applied

#### Scenario: Autocomplete popup keeps priority
- **WHEN** an autocomplete popup (slash commands or link completion) is open and handles the `Tab` key
- **THEN** the popup's action is performed and no indentation is applied

#### Scenario: Leaving the editor with the keyboard
- **WHEN** the user presses `Esc` and then `Tab`
- **THEN** keyboard focus moves out of the editor without modifying the document

## MODIFIED Requirements

### Requirement: Hierarchical Bullet List Styling
The system SHALL visually style Markdown unordered lists (`- `, `* `, `+ `) with clean typographic bullet points (`•`) and render proportional visual indentation based on nesting depth in the Live Preview editor while preserving exact Markdown syntax in document storage. The nesting depth SHALL be determined by the actual list structure (how many list items an item is nested within), not by the raw count of leading whitespace characters.

#### Scenario: Visual bullet point presentation
- **WHEN** user views an unordered list item (e.g. `- Item 1`) in the Live Preview editor
- **THEN** the marker is rendered visually as a typographic bullet point (`•`) without altering the raw `- ` text in the document

#### Scenario: Nested list hierarchical indentation
- **WHEN** user indents a list item with whitespace (e.g. `  - Child item`)
- **THEN** the editor renders the line with visual indentation padding proportional to its nesting depth

#### Scenario: Coexistence with task checkboxes
- **WHEN** user views or edits a task item starting with `- [ ]` or `- [x]`
- **THEN** the interactive checkbox is rendered and not obscured or duplicated by standard bullet point decorations

#### Scenario: Ordered list indentation
- **WHEN** user indents an ordered list item (e.g. `  1. Step one`)
- **THEN** the line renders with matching hierarchical indentation padding while displaying the numbered prefix

#### Scenario: Nesting depth under ordered list markers
- **WHEN** a list is nested twice under ordered items using CommonMark widths (e.g. `1. A` / `   1. B` / `      1. C`)
- **THEN** the items render at visual nesting levels 0, 1, and 2 respectively

#### Scenario: Nesting depth under wide ordered markers
- **WHEN** a bullet item is nested under a wide ordered marker (e.g. `10. A` followed by `    - B`)
- **THEN** the bullet item renders at visual nesting level 1
