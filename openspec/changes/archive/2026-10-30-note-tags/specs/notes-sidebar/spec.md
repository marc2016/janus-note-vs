# Spec Delta

## ADDED Requirements

### Requirement: Pinned Tags Entry
In initialized workspaces where at least one note under `janus.notesRoot` or `janus.includeFolders` carries a tag, the Notes TreeView SHALL display a pinned, collapsed `Tags` entry directly below the `Netzwerk` entry, showing the number of distinct tags. Expanding it SHALL list every tag (as defined in `note-tags`) sorted alphabetically with the number of notes carrying it. Expanding a tag SHALL list those notes by file name, and clicking a note SHALL open it in the Janus Markdown Editor. The entry SHALL reflect added, changed and removed tags when the Notes TreeView refreshes.

#### Scenario: Listing tags
- **WHEN** three notes contain `#backend` and one note contains `#budget`
- **THEN** the `Tags` entry shows `2`, and expanding it lists `backend` with `3` and `budget` with `1`

#### Scenario: Opening a tagged note
- **WHEN** the user expands `backend` and clicks `plan`
- **THEN** `plan.md` opens in the Janus Markdown Editor

#### Scenario: No tags
- **WHEN** no note carries a tag
- **THEN** no `Tags` entry is shown

#### Scenario: Tag added in a note
- **WHEN** the user saves a note with a new tag `#idee` and the Notes TreeView refreshes
- **THEN** `idee` appears in the `Tags` entry
