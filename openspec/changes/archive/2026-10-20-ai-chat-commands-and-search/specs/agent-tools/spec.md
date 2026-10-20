# Spec Delta

## MODIFIED Requirements

### Requirement: Chat Participant Registration
The system SHALL register the `@janus` chat participant in the VS Code Chat panel with support for slash commands (`/help`, `/search`, `/tasks`, `/summarize`, `/inbox`) and multi-turn Language Model tool execution, delegating prompt processing to the active VS Code Language Model or the configured Janus AI provider fallback.

#### Scenario: User queries @janus with an open note
- **WHEN** user sends `@janus organize my tasks` with `project.md` active
- **THEN** `@janus` receives the request with current note path context, invokes available Janus tools when requested by the model, feeds tool results back to the model, and streams the final answer

## ADDED Requirements

### Requirement: Language Model Tool for Searching Notes and Tasks
The system SHALL provide a tool `janus_search_notes` that searches all Markdown notes and folder `tasks.json` files in the Janus notes root by query string and returns ranked note snippets and matching tasks.

#### Scenario: Language model invokes janus_search_notes
- **WHEN** a Language Model calls `janus_search_notes` with a search query (e.g. `"Kickoff Entscheidungen"`)
- **THEN** the tool returns a JSON payload containing the top matching notes (title, relative path, URI, snippet) and matching tasks across the workspace

### Requirement: Chat Slash Command for Searching Notes (/search)
The system SHALL support the `/search` slash command on `@janus` to answer user questions based on workspace notes and tasks and render action buttons to open matching notes directly in the Janus Rich Markdown Editor.

#### Scenario: Searching notes via @janus /search
- **WHEN** user sends `@janus /search Wo steht etwas zum Q3 Budget?`
- **THEN** `@janus` searches the notes root, synthesizes an answer based on the matched notes and tasks, and includes clickable buttons that open each referenced note in `janus.markdownEditor`

### Requirement: Chat Slash Command for Task Management (/tasks)
The system SHALL support the `/tasks` slash command on `@janus` to list, filter, or answer questions about open and completed tasks across folders, and offer task extraction for the active note.

#### Scenario: Querying open tasks via @janus /tasks
- **WHEN** user sends `@janus /tasks Welche Aufgaben sind noch offen?`
- **THEN** `@janus` loads all folder `tasks.json` companions, summarizes the open tasks grouped by folder/priority, and provides a button to open the Global Tasks view (`janus.openAllTasks`) or folder tasks

### Requirement: Chat Slash Command for Summarizing Notes and Folders (/summarize)
The system SHALL support the `/summarize` slash command on `@janus` to summarize either the active Markdown note or a specified note/folder path within `notesRoot`.

#### Scenario: Summarizing active note or folder via @janus /summarize
- **WHEN** user sends `@janus /summarize` with an open note or `@janus /summarize projects/App-Launch`
- **THEN** `@janus` reads the target note(s) and associated folder tasks and streams a structured summary with key points and open action items

### Requirement: Chat Slash Command for Inbox Assistance (/inbox)
The system SHALL support the `/inbox` slash command on `@janus` to inspect `inbox.md` content and provide a direct action button to sort inbox entries via AI (`janus.sortInbox`).

#### Scenario: Inspecting inbox via @janus /inbox
- **WHEN** user sends `@janus /inbox`
- **THEN** `@janus` reads `<notesRoot>/inbox.md`, summarizes the unsortierten thoughts/sections, and renders a button triggering `janus.sortInbox`

### Requirement: Chat Slash Command for Command Overview (/help)
The system SHALL support the `/help` slash command on `@janus` to display a clear overview of all available `@janus` slash commands, usage examples, and quick-access buttons.

#### Scenario: Listing available commands via @janus /help
- **WHEN** user sends `@janus /help`
- **THEN** `@janus` responds immediately with a structured Markdown overview listing `/search`, `/tasks`, `/summarize`, `/inbox`, and `/help` along with example prompts and quick-action buttons

