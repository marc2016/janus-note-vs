# Spec Delta

## ADDED Requirements

### Requirement: Folder Links
Wiki-links and Markdown links in notes SHALL be able to point to folders. A link target ending in `/` SHALL always refer to a folder. A target without a trailing `/` SHALL refer to a folder only when no note matches it by path, file name or alias. Folder targets SHALL be resolved relative to the note's folder, the notes root and the workspace folder, in that order, like note paths. Clicking a link to an existing folder SHALL open the Folder Overview for that folder and reveal the folder in the Notes view. Clicking a link to a missing folder (with a trailing `/`) SHALL show a message and SHALL NOT offer to create a note. The `[[` autocomplete SHALL also suggest folders of the notes collection, shown with a folder icon and inserted with a trailing `/`. The note footer SHALL list outgoing folder links with a folder icon. When a folder is renamed or moved through Janus, links that point to it SHALL be updated like links to notes inside it.

#### Scenario: Opening a folder link
- **WHEN** a note contains `[[projects/App-Launch/]]` and the user clicks it
- **THEN** the Folder Overview for `projects/App-Launch` opens and the folder is revealed in the Notes view

#### Scenario: Note wins without trailing slash
- **WHEN** a note `projects/App-Launch.md` and a folder `projects/App-Launch/` both exist, and a note contains `[[projects/App-Launch]]`
- **THEN** the link opens the note `projects/App-Launch.md`

#### Scenario: Folder without trailing slash
- **WHEN** only the folder `projects/Website-Relaunch/` exists and a note contains `[Website](projects/Website-Relaunch)`
- **THEN** the link opens the Folder Overview for `projects/Website-Relaunch`

#### Scenario: Missing folder
- **WHEN** a note contains `[[projects/Gibt-es-nicht/]]` and the user clicks it
- **THEN** a message says the folder does not exist and no note is created

#### Scenario: Autocomplete suggests folders
- **WHEN** the user types `[[App`
- **THEN** the suggestions include the folder `projects/App-Launch/` with a folder icon, and choosing it inserts `[[projects/App-Launch/]]`

#### Scenario: Footer shows folder links
- **WHEN** a note links to `projects/App-Launch/`
- **THEN** the footer lists `App-Launch` with a folder icon, and clicking it opens the Folder Overview

#### Scenario: Renaming a linked folder
- **WHEN** the folder `projects/App-Launch` is renamed to `projects/Mobile-App` and a note contains `[[projects/App-Launch/]]`
- **THEN** the link becomes `[[projects/Mobile-App/]]`
