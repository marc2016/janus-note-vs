# Spec Delta

## MODIFIED Requirements

### Requirement: Verbatim Transfer of Inbox Blocks
The system SHALL write each sorted block's original text from `inbox.md` into the target note without any rewording, shortening, or reformatting by the AI model. The only changes SHALL be the headings defined for appending and creating notes, and the rewrite of relative link and image paths defined in "Relative Path Rewrite for Moved Inbox Blocks".

#### Scenario: Appending a block without its own heading
- **WHEN** a paragraph block without a heading is appended to an existing note, with the AI-proposed title `Heartbeat-Intervall`
- **THEN** the note gains `## Heartbeat-Intervall (YYYY-MM-DD HH:mm)` followed by the paragraph exactly as it appeared in `inbox.md`

#### Scenario: Appending a block that has its own heading
- **WHEN** a block starting with `## Sync-Architektur: WebSocket Heartbeats` is appended to an existing note
- **THEN** the note gains `## Sync-Architektur: WebSocket Heartbeats (YYYY-MM-DD HH:mm)` followed by the remaining block lines exactly as they appeared in `inbox.md`

#### Scenario: Creating a new note from a block
- **WHEN** a block is sorted into a note path that does not exist yet
- **THEN** the new note contains a `#` title heading followed by the block text exactly as it appeared in `inbox.md`

#### Scenario: Block with relative links keeps everything else verbatim
- **WHEN** a block containing the sentence `Siehe [Plan](knowledge/plan.md) für Details.` is sorted into `projects/app/launch.md` and `knowledge/plan.md` exists
- **THEN** the target note contains `Siehe [Plan](../../knowledge/plan.md) für Details.` and every other character of the block is unchanged

## ADDED Requirements

### Requirement: Relative Path Rewrite for Moved Inbox Blocks
When writing a sorted block into its target note, the system SHALL rewrite the target path of every Markdown link and Markdown image in the block whose target is a relative path that resolves, relative to the folder of `inbox.md`, to an existing file, so that it resolves to the same file relative to the target note's folder. The rewritten path SHALL use `/` as separator and keep the link's label or alt text, optional title, and any `#anchor`, `#L42` or `:42` suffix. The system SHALL NOT change wiki-links, external URLs, anchor-only links, absolute paths, relative paths that do not resolve to an existing file from the folder of `inbox.md`, or links inside fenced code blocks and inline code spans.

#### Scenario: Image in a block moved two levels deeper
- **WHEN** a block contains `![Skizze](assets/skizze.png)`, `assets/skizze.png` exists in the notes root, and the block is sorted into `projects/app/launch.md`
- **THEN** the target note contains `![Skizze](../../assets/skizze.png)`

#### Scenario: Link with anchor and title
- **WHEN** a block contains `[Abschnitt](knowledge/plan.md#ziele "Ziele")`, `knowledge/plan.md` exists, and the block is sorted into `knowledge/notes.md`
- **THEN** the target note contains `[Abschnitt](plan.md#ziele "Ziele")`

#### Scenario: Link with explicit current-folder prefix
- **WHEN** a block contains `[Plan](./knowledge/plan.md)`, `knowledge/plan.md` exists, and the block is sorted into `meetings/sync.md`
- **THEN** the target note contains `[Plan](../knowledge/plan.md)`

#### Scenario: Wiki-links and external links stay unchanged
- **WHEN** a block contains `[[plan]]`, `[[knowledge/plan]]`, `[Docs](https://example.com/docs)` and `[Oben](#oben)`, and the block is sorted into `projects/app/launch.md`
- **THEN** all four links appear in the target note exactly as in `inbox.md`

#### Scenario: Unresolved relative link stays unchanged
- **WHEN** a block contains `[Später](ideen/später.md)` and no file `ideen/später.md` exists in the notes root
- **THEN** the link appears in the target note exactly as in `inbox.md`

#### Scenario: Links in code stay unchanged
- **WHEN** a block contains `[Plan](knowledge/plan.md)` inside a fenced code block and inside an inline code span, and `knowledge/plan.md` exists
- **THEN** both appear in the target note exactly as in `inbox.md`

#### Scenario: Target note in the notes root
- **WHEN** a block containing `[Plan](knowledge/plan.md)` is sorted into a note directly inside the notes root
- **THEN** the link appears in the target note exactly as in `inbox.md`

#### Scenario: Blocks remaining in the inbox are not rewritten
- **WHEN** a block containing `![Skizze](assets/skizze.png)` is not assigned by the AI model and stays in `inbox.md`
- **THEN** `inbox.md` still contains `![Skizze](assets/skizze.png)`
