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

### Requirement: Frontmatter Title and Aliases in Search
Note search results SHALL use a note's frontmatter `title` as the result title when it has one, falling back to its first `#` heading and then its file name. The frontmatter title and aliases SHALL be scored like the note title when ranking matches.

#### Scenario: Result title from frontmatter
- **WHEN** `2026-10-29-sync.md` has `title: Wöchentlicher Sync` and a first heading `# Sync`, and it matches a search
- **THEN** the result is titled `Wöchentlicher Sync`

#### Scenario: Finding a note by alias
- **WHEN** `rest-schnittstelle.md` has `aliases: [API]`, the word `API` appears nowhere else in it, and the user searches for `API`
- **THEN** `rest-schnittstelle.md` is returned with the weight of a title match

### Requirement: Tag Filter and Scoring in Search
A search query word starting with `#` SHALL be treated as a tag filter: only notes that carry that tag (as defined in `note-tags`) SHALL be returned, and the word SHALL NOT be scored as a keyword. Several tag filters SHALL all have to match. When a query consists only of tag filters, all matching notes SHALL be returned, ordered by title. Other query words that equal one of a note's tags SHALL add the same weight as a heading match. Task search is not affected by tag filters.

#### Scenario: Restricting search to a tag
- **WHEN** `plan.md` contains `#backend` and the word `Deployment`, `retro.md` contains `Deployment` but no tag, and the user searches for `#backend Deployment`
- **THEN** only `plan.md` is returned

#### Scenario: Tag-only query
- **WHEN** the user searches for `#backend` and three notes carry `backend`
- **THEN** exactly those three notes are returned, ordered by title

#### Scenario: Keyword matching a tag
- **WHEN** `plan.md` has the tag `budget` without the word `budget` in its text, and the user searches for `budget`
- **THEN** `plan.md` is returned with the weight of a heading match

#### Scenario: Search from the chat
- **WHEN** the user sends `/search #backend` in the Janus Sidebar Chat
- **THEN** the source cards show only notes that carry `backend`
