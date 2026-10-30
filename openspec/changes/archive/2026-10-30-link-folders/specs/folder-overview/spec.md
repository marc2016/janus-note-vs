# Spec Delta

## ADDED Requirements

### Requirement: Notes Linking to the Folder
The Folder Overview of a single folder SHALL show a section `Verlinkt von` listing every note that links to this folder (as defined for folder links in `note-linking`), with the note title and the line of the link. Clicking an entry SHALL open the note in the Janus Markdown Editor at that line. When no note links to the folder, the section SHALL be hidden. The section SHALL NOT be shown for multi-item selections.

#### Scenario: Folder with backlinks
- **WHEN** `project-plan.md` line 14 and `sprint-review.md` line 4 link to `projects/App-Launch/` and the user opens its Folder Overview
- **THEN** the section `Verlinkt von` lists `project-plan` with line 14 and `sprint-review` with line 4

#### Scenario: Opening a linking note
- **WHEN** the user clicks the `project-plan` entry in `Verlinkt von`
- **THEN** `project-plan.md` opens in the Janus Markdown Editor at line 14

#### Scenario: Folder without backlinks
- **WHEN** no note links to the folder
- **THEN** the Folder Overview shows no `Verlinkt von` section
