# Spec Delta

## ADDED Requirements

### Requirement: Enter on Empty List Items
When the cursor is on an empty list item in the Janus Markdown Editor and the user presses `Enter` without a selection, the editor SHALL leave the item instead of continuing the list. A list item is empty when its line contains nothing after the list marker (`-`, `*`, `+`, `1.`, `1)`) and, for task items, the checkbox (`[ ]`, `[x]`) other than spaces, and it has no nested child items. If the item is nested in another list item, the editor SHALL move it one level up exactly as `Shift-Tab` does (as defined in "Tab Key Indentation"), including renumbering affected ordered lists, and keep the cursor after its marker. If the item is at the top level, the editor SHALL remove the marker, the checkbox and trailing spaces, leaving an empty line with the cursor on it. In both cases the editor SHALL NOT insert a line break and SHALL NOT leave a line that consists only of spaces. Inside a blockquote the `>` prefix SHALL be kept. The change SHALL form one undo step. `Enter` on a list item with text, on an empty item that has child items, and with a selection SHALL keep its previous behavior. Table cell navigation, open autocomplete popups and the creation time in daily note headings SHALL keep priority over this behavior.

#### Scenario: Empty nested bullet moves one level up
- **WHEN** the document is `- A` / `  - B` / `  - ` with the cursor at the end of the last line and the user presses `Enter`
- **THEN** the document is `- A` / `  - B` / `- ` with the cursor after `- `

#### Scenario: Empty nested task moves one level up
- **WHEN** the document is `- [ ] A` / `  - [ ] B` / `  - [ ] ` with the cursor at the end of the last line and the user presses `Enter`
- **THEN** the document is `- [ ] A` / `  - [ ] B` / `- [ ] ` with the cursor after `- [ ] `

#### Scenario: Empty nested ordered item is renumbered
- **WHEN** the document is `1. A` / `   1. B` / `   2. ` with the cursor at the end of the last line and the user presses `Enter`
- **THEN** the document is `1. A` / `   1. B` / `2. `

#### Scenario: Third level moves to the second level
- **WHEN** the document is `- A` / `  - B` / `    - C` / `    - ` with the cursor at the end of the last line and the user presses `Enter`
- **THEN** the last line becomes `  - ` and the cursor is after its marker

#### Scenario: Empty top-level item ends the list
- **WHEN** the document is `- A` / `- ` with the cursor at the end of the last line and the user presses `Enter`
- **THEN** the document is `- A` / followed by an empty line with the cursor on it

#### Scenario: Empty top-level task ends the list
- **WHEN** the document is `- [ ] A` / `- [ ] ` with the cursor at the end of the last line and the user presses `Enter`
- **THEN** the last line is empty and contains no spaces

#### Scenario: List inside a blockquote
- **WHEN** the document is `> - A` / `> - ` with the cursor at the end of the last line and the user presses `Enter`
- **THEN** the last line is `> ` and the cursor is at its end

#### Scenario: Item with text continues the list
- **WHEN** the document is `- A` / `  - B` with the cursor at the end of `B` and the user presses `Enter`
- **THEN** a new item `  - ` is inserted below as before

#### Scenario: Undo
- **WHEN** an empty nested item was moved one level up by `Enter` and the user presses `Cmd+Z`
- **THEN** the document and the cursor are as before the `Enter`

#### Scenario: No blank line with leftover spaces
- **WHEN** the user presses `Enter` on any empty list item
- **THEN** no new line is inserted and no line of the document consists only of spaces as a result
