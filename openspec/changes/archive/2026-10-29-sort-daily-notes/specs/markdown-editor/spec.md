# Spec Delta

## ADDED Requirements

### Requirement: Sorted Link Display in Daily Notes
In a daily note, the Live Preview editor SHALL display every line that consists only of `->` and a single wiki link (outside fenced code) as a clickable card instead of the raw text. The card SHALL show an icon, the label `Einsortiert in`, the target note's title (frontmatter `title`, otherwise its first `#` heading, otherwise its file name) and its folder. When the target note does not exist, the card SHALL be marked as missing with the label `Ziel nicht gefunden`. For a block that starts with a `##`-or-deeper heading, the heading line SHALL additionally show a small badge with a check mark and the target note's title. Clicking the card or the badge SHALL open the target note in the Janus Markdown Editor at the section copied from this block, or at the top of the note if that section cannot be found. While the cursor is on the link line, or when syntax visibility is set to always visible, the editor SHALL show the raw line instead of the card. The note's file content SHALL stay unchanged.

#### Scenario: Card instead of the raw link line
- **WHEN** `journal/2026-10-29.md` contains the block `## Call mit Anna` followed by `-> [[projects/App-Launch/app-launch]]`, and `app-launch.md` has the title `Projekt: Mobile App-Launch (v2.0)`
- **THEN** the editor shows a card `Einsortiert in Projekt: Mobile App-Launch (v2.0)` with the folder `projects / App-Launch` in place of the link line, and the heading `Call mit Anna` shows a check mark badge with the same title

#### Scenario: Opening the copied section
- **WHEN** the user clicks the card, and `app-launch.md` contains the heading `## Call mit Anna (2026-10-29)`
- **THEN** `app-launch.md` opens in the Janus Markdown Editor at that heading

#### Scenario: Missing target
- **WHEN** the link line points to a note that does not exist
- **THEN** the card shows `Ziel nicht gefunden` and is marked as missing

#### Scenario: Editing the raw line
- **WHEN** the user moves the cursor onto the link line
- **THEN** the editor shows the raw text `-> [[projects/App-Launch/app-launch]]` so it can be edited

#### Scenario: Other notes are not affected
- **WHEN** a note outside `journal/` contains a line `-> [[knowledge/x]]`
- **THEN** the editor shows the line as normal text with a normal wiki link

## MODIFIED Requirements

### Requirement: Footer Bar AI Task Generation and Model Selector
The system SHALL render an AI task generation button (`Aufgaben generieren`) in the Markdown editor's bottom footer bar (`NotesLinksFooter`), allowing users to generate folder tasks from the current note with visual loading feedback, without rendering an AI model selector dropdown in the footer bar. The footer bar SHALL additionally render a sort button only for notes that can be sorted: `Inbox einsortieren` when the open note is `<notesRoot>/inbox.md`, and `Tagesnotiz einsortieren` when the open note is a daily note (as defined in `daily-notes`). The sort button SHALL sort the open note: the inbox as defined for inbox sorting, a daily note as defined for daily note sorting in `ai-inbox-sorting`. Other notes SHALL NOT show a sort button.

#### Scenario: Clicking AI task generation button in the footer bar
- **WHEN** user clicks the `Aufgaben generieren` button in the Markdown editor footer bar
- **THEN** the button displays a loading state while the active AI model extracts tasks from the note into `<folder>/tasks.json`, and updates the folder tasks badge once complete

#### Scenario: Clicking AI inbox sorting button in the footer bar
- **WHEN** `inbox.md` is open and the user clicks the `Inbox einsortieren` button in the Markdown editor footer bar
- **THEN** the button displays a loading state while the active AI model analyzes and sorts `inbox.md` entries into target notes and folders, resetting the loading state once complete

#### Scenario: Clicking the daily note sorting button
- **WHEN** `journal/2026-10-29.md` is open and the user clicks `Tagesnotiz einsortieren`
- **THEN** the button displays a loading state while the blocks of this daily note are copied into target notes and linked in the daily note, resetting the loading state once complete, and `inbox.md` is not changed

#### Scenario: No sort button in other notes
- **WHEN** the user opens `projects/App-Launch/architektur.md`
- **THEN** the footer bar shows no sort button

#### Scenario: Configuring AI model from error notification opens Settings Panel
- **WHEN** AI task generation or sorting fails and the user clicks `KI-Modell konfigurieren` in the error notification
- **THEN** the system opens the Janus Settings Panel (`janus.openSettings`) so the user can configure the provider, model, or API key
