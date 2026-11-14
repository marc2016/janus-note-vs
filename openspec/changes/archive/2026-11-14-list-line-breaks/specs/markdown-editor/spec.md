# Spec Delta

## ADDED Requirements

### Requirement: Line Breaks in List Items
When the cursor is in a list item (unordered, ordered or task item) in the Janus Markdown Editor, on the marker line after the marker or on one of the item's continuation lines, and the user presses `Shift+Enter`, the editor SHALL split the line at the cursor and start a new line that belongs to the same item: the new line SHALL have no list marker and SHALL be indented with spaces to the item's content column as defined by CommonMark (2 spaces under `- `, 3 under `1. `, 4 under `10. `; 2 for task items). Inside a blockquote the new line SHALL start with the same `>` prefix. Spaces directly before the cursor SHALL be removed so that no trailing spaces remain, and text after the cursor SHALL move to the new line without leading spaces. A selection SHALL be replaced by the line break. The change SHALL form one undo step. Outside list items, and with the cursor before the list marker, `Shift+Enter` SHALL keep its previous behavior. Table cell navigation and open autocomplete popups SHALL keep priority.

When the user presses `Enter` on a continuation line of a list item (a line of the item's text without its own marker), the editor SHALL start a new item of the same list directly below it: with the item's indentation and marker, an unchecked checkbox `[ ] ` for task items, and the next number for ordered items, renumbering the following items of that list consecutively. Text after the cursor SHALL become the text of the new item, without spaces around the split. On an indented empty continuation line (for example right after `Shift+Enter`), `Enter` SHALL turn that line into the new item instead of inserting another line. Inside a blockquote the `>` prefix SHALL be kept. This SHALL form one undo step.

#### Scenario: Line break in a bullet item
- **WHEN** the document is `- A` with the cursor after `A` and the user presses `Shift+Enter`
- **THEN** the document is `- A` / `  ` with the cursor at the end of the second line

#### Scenario: Line break in an ordered item
- **WHEN** the document is `10. Zehn` with the cursor after `Zehn` and the user presses `Shift+Enter`
- **THEN** the second line is indented by 4 spaces

#### Scenario: Line break in a nested task item
- **WHEN** the document is `- [ ] A` / `  - [ ] B` with the cursor after `B` and the user presses `Shift+Enter`
- **THEN** a third line indented by 4 spaces is inserted and the cursor is at its end

#### Scenario: Splitting text
- **WHEN** the document is `- Erste Zeile zweite Zeile` with the cursor before `zweite` and the user presses `Shift+Enter`
- **THEN** the document is `- Erste Zeile` / `  zweite Zeile`

#### Scenario: Line break on a continuation line
- **WHEN** the document is `- A` / `  weiter` with the cursor after `weiter` and the user presses `Shift+Enter`
- **THEN** a third line indented by 2 spaces is inserted

#### Scenario: List inside a blockquote
- **WHEN** the document is `> - Q` with the cursor after `Q` and the user presses `Shift+Enter`
- **THEN** the document is `> - Q` / `>   ` with the cursor at the end of the second line

#### Scenario: Outside lists
- **WHEN** the cursor is at the end of a paragraph line `Text` and the user presses `Shift+Enter`
- **THEN** a line break is inserted as before

#### Scenario: Undo
- **WHEN** the user pressed `Shift+Enter` in a list item and then presses `Cmd+Z`
- **THEN** the document and the cursor are as before

#### Scenario: Enter after a manual line break starts a new item
- **WHEN** the document is `- A` / `  weiter` with the cursor after `weiter` and the user presses `Enter`
- **THEN** the document is `- A` / `  weiter` / `- ` with the cursor after `- `

#### Scenario: New ordered item after a continuation line
- **WHEN** the document is `1. A` / `   weiter` / `2. B` with the cursor after `weiter` and the user presses `Enter`
- **THEN** the document is `1. A` / `   weiter` / `2. ` / `3. B`

#### Scenario: New task item after a continuation line
- **WHEN** the document is `- [x] A` / `  weiter` with the cursor after `weiter` and the user presses `Enter`
- **THEN** the third line is `- [ ] `

#### Scenario: New nested item after a continuation line
- **WHEN** the document is `- A` / `  - B` / `    weiter` with the cursor after `weiter` and the user presses `Enter`
- **THEN** the fourth line is `  - ` with the cursor after the marker

#### Scenario: Enter on the empty line right after Shift+Enter
- **WHEN** the document is `- A` / `  ` with the cursor at the end of the second line and the user presses `Enter`
- **THEN** the document is `- A` / `- ` with the cursor after `- `

#### Scenario: Splitting a continuation line
- **WHEN** the document is `- A` / `  erste zweite` with the cursor before `zweite` and the user presses `Enter`
- **THEN** the document is `- A` / `  erste` / `- zweite`

### Requirement: Aligned Continuation and Wrapped Lines in Lists
In the Janus Markdown Editor, the text of a list item's continuation lines and of every wrapped visual line of a list item SHALL start at the same horizontal position as the text after the item's marker: after the bullet for unordered items, after the number for ordered items, and after the checkbox for task items. This SHALL hold at every nesting level. The visual indentation of list lines and their continuation lines SHALL be determined by the nesting level only; leading indentation spaces SHALL NOT add extra visual space. The Markdown source SHALL remain unchanged. Lists inside blockquotes MAY keep their previous rendering.

#### Scenario: Wrapped bullet item
- **WHEN** a top-level bullet item is longer than the editor width
- **THEN** its second visual line starts below the first character of the item text, not below the bullet

#### Scenario: Wrapped task item
- **WHEN** a task item `- [ ] ...` is longer than the editor width
- **THEN** its second visual line starts below the first character after the checkbox

#### Scenario: Wrapped ordered item with a wide marker
- **WHEN** the item `10. ...` is longer than the editor width
- **THEN** its second visual line starts below the first character after `10. `

#### Scenario: Continuation line
- **WHEN** the document contains `- A` / `  weiter`
- **THEN** `weiter` starts at the same horizontal position as `A`

#### Scenario: Continuation line of a nested item
- **WHEN** the document contains `- A` / `  - B` / `    weiter`
- **THEN** `weiter` starts at the same horizontal position as `B`

#### Scenario: Nesting level drives indentation
- **WHEN** the document contains `- A` / `  - B` and `- C` / `    - D`, where `D` is nested one level as well
- **THEN** `B` and `D` are shown at the same indentation
