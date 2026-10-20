# ai-note-search Specification

## Purpose

Provides workspace-wide search, relevance ranking, and snippet extraction across Markdown notes and folder `tasks.json` companions inside the configured Janus notes root so AI chat and tools can retrieve grounded context.

## Requirements

### Requirement: Workspace Note and Task Search
The system SHALL search across all Markdown notes (`.md`, `.markdown`) and folder task companions (`tasks.json`) within the configured Janus notes root (`notesRoot`), ranking matches by relevance and extracting contextual snippets.

#### Scenario: Matching notes by title, path, heading, and body keywords
- **WHEN** a search query such as `"Q3 Budget"` is executed against the notes root
- **THEN** the system scans Markdown notes under `notesRoot`, scores matches with higher weight on note title, relative path, and Markdown headings than body text, and returns ranked note matches with contextual text snippets

#### Scenario: Matching tasks across folders
- **WHEN** a search query matches task titles or notes inside folder `tasks.json` files
- **THEN** the search result includes the matching tasks along with their folder path, completion status, priority, and `tasks.json` URI

#### Scenario: Empty or broad query fallback
- **WHEN** a search query has no specific keyword matches or is empty
- **THEN** the system returns a bounded overview of available notes and open tasks in the workspace so the AI assistant can still answer structural questions

### Requirement: Folder and Note Context Aggregation for Summarization
The system SHALL resolve a target note or folder path (relative to `notesRoot` or from the active editor) and aggregate the Markdown content and associated folder tasks for summarization.

#### Scenario: Aggregating all notes and tasks in a project folder
- **WHEN** context aggregation is requested for a folder path such as `projects/App-Launch`
- **THEN** the system collects all Markdown notes and the `tasks.json` companion inside that folder and returns their structured content

