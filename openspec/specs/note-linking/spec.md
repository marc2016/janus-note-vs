# note-linking Specification

## Purpose

Enables automated discovery, bi-directional backlink indexing, and companion status aggregation for interconnected Markdown notes in the workspace.

## Requirements

### Requirement: Wiki-Link and Markdown Link Parsing
The system SHALL parse outgoing references from Markdown document text, recognizing wiki-style links (`[[Note Name]]` or `[[note.md]]`) and standard Markdown links (`[Title](target.md)`).

#### Scenario: Parsing wiki-links in note text
- **WHEN** a note containing `[[Meeting-Notes]]` and `[Design](specs/design.md)` is opened or modified
- **THEN** system extracts both references as outgoing links associated with the source note

### Requirement: Bi-directional Backlink Indexing
The system SHALL identify all notes in the active notes root that reference the current note and expose them as backlinks.

#### Scenario: Discovering backlinks to active note
- **WHEN** Note B contains a link to Note A (`[[Note A]]`) and user opens Note A
- **THEN** system identifies Note B as an incoming backlink for Note A

### Requirement: Companion Status and Task Summary Resolution
The system SHALL query the containing folder's `tasks.json` and the active note's `*.chart.json` companion file, determine their existence, and summarize open vs. completed task counts when a folder task list exists.

#### Scenario: Resolving companion files with tasks summary
- **WHEN** user opens `projekt-alpha/alpha.md` whose folder contains `projekt-alpha/tasks.json` with 3 open tasks and 2 completed tasks
- **THEN** system reports companion status with folder task list existence and summary counts (3 open, 5 total)

