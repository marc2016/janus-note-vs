# Spec Delta

## MODIFIED Requirements

### Requirement: Rename Item with Companion Synchronization
The system SHALL allow users to rename folders and notes via the `janus.renameItem` command from the item context menu, keeping attached companion files and links to the renamed items synchronized as defined in `note-linking` (Link Update on Note and Folder Rename).

#### Scenario: Renaming a note with companion files
- **WHEN** user renames a note `alpha.md` to `beta.md`
- **THEN** system renames `alpha.md` to `beta.md` and automatically renames any existing companion files (`alpha.tasks.json` -> `beta.tasks.json`, `alpha.chart.json` -> `beta.chart.json`)

#### Scenario: Renaming a directory
- **WHEN** user renames a folder in the Notes view
- **THEN** system prompts for the new name and renames the directory on disk

#### Scenario: Renaming a note updates links to it
- **WHEN** user renames `alpha.md` to `beta.md` and another note contains `[[alpha]]`
- **THEN** the other note contains `[[beta]]` after the rename

#### Scenario: Cancelled or failed rename
- **WHEN** user cancels the name prompt, or the rename on disk fails (for example because the target name already exists)
- **THEN** no link in any note is changed
