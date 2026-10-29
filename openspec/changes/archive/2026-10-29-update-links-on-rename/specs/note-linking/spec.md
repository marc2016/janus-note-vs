# Spec Delta

## ADDED Requirements

### Requirement: Link Update on Note and Folder Rename
When a note or folder is renamed through Janus, the system SHALL rewrite every wiki-link and Markdown link in the Markdown notes under `janus.notesRoot` and all directories in `janus.includeFolders` that resolved to the renamed note, or to a note inside the renamed folder, before the rename, so that it resolves to the same note afterwards. Links that did not resolve to an affected note before the rename SHALL NOT be changed. Links inside fenced code blocks and inline code spans SHALL NOT be changed.

#### Scenario: Wiki-link to a renamed note
- **WHEN** `projects/plan.md` contains `[[kickoff]]` and `meetings/kickoff.md` is renamed to `meetings/kickoff-2026.md`
- **THEN** `projects/plan.md` contains `[[kickoff-2026]]`

#### Scenario: Markdown link with relative path
- **WHEN** `projects/alpha/plan.md` contains `[Kickoff](../../meetings/kickoff.md)` and `meetings/kickoff.md` is renamed to `meetings/start.md`
- **THEN** the link becomes `[Kickoff](../../meetings/start.md)`

#### Scenario: Folder rename
- **WHEN** `index.md` contains `[[projects/alpha/plan]]` and `[Spec](projects/alpha/spec.md)`, and folder `projects/alpha` is renamed to `projects/apollo`
- **THEN** the links become `[[projects/apollo/plan]]` and `[Spec](projects/apollo/spec.md)`

#### Scenario: Basename wiki-link and folder rename
- **WHEN** `index.md` contains `[[plan]]`, which resolves to `projects/alpha/plan.md`, and folder `projects/alpha` is renamed to `projects/apollo`
- **THEN** `[[plan]]` stays unchanged because it still resolves to the same note

#### Scenario: Link form is preserved
- **WHEN** a note contains `[[kickoff|Erstes Treffen]]`, `[[kickoff#L12]]`, `[[kickoff.md]]` and `[Notes](./kickoff.md#agenda)`, and `kickoff.md` in the same folder is renamed to `start.md`
- **THEN** the links become `[[start|Erstes Treffen]]`, `[[start#L12]]`, `[[start.md]]` and `[Notes](./start.md#agenda)`

#### Scenario: Link labels are not changed
- **WHEN** a note contains `[Kickoff-Notizen](kickoff.md)` and `kickoff.md` is renamed to `start.md`
- **THEN** the link becomes `[Kickoff-Notizen](start.md)`

#### Scenario: Links in code are not changed
- **WHEN** a note contains `[[kickoff]]` in a paragraph, inside a fenced code block, and inside an inline code span, and `kickoff.md` is renamed to `start.md`
- **THEN** only the link in the paragraph is rewritten

#### Scenario: Unrelated note with the same name
- **WHEN** `projects/a/notes.md` and `projects/b/notes.md` both exist, `projects/a/index.md` contains `[Notes](notes.md)`, and `projects/b/notes.md` is renamed to `projects/b/log.md`
- **THEN** the link in `projects/a/index.md` stays unchanged

#### Scenario: Already broken links stay untouched
- **WHEN** a note contains `[[kickof]]`, which does not resolve to any note, and `kickoff.md` is renamed to `start.md`
- **THEN** `[[kickof]]` stays unchanged

#### Scenario: Links inside the renamed note
- **WHEN** `kickoff.md` contains a link to itself, `[[kickoff#L3]]`, and is renamed to `start.md`
- **THEN** the renamed note `start.md` contains `[[start#L3]]`

#### Scenario: Rewritten basename link would become ambiguous
- **WHEN** `index.md` contains `[[draft]]`, which resolves to `projects/draft.md`, `knowledge/plan.md` also exists and is found first by name, and `projects/draft.md` is renamed to `projects/plan.md`
- **THEN** the link is rewritten to a path form (`[[projects/plan]]`) that resolves to the renamed note, not to `knowledge/plan.md`

#### Scenario: Open note with unsaved changes
- **WHEN** a note that links to `kickoff.md` is open in an editor with unsaved changes, and `kickoff.md` is renamed to `start.md`
- **THEN** the link in the open document is updated, and the user's unsaved changes in that document are kept

#### Scenario: Reporting the result
- **WHEN** a rename causes 5 links in 3 notes to be rewritten
- **THEN** the user is informed that 5 links in 3 notes were updated
