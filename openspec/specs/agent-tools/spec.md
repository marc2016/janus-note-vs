# agent-tools Specification

## Purpose

Exposes Janus Note features to VS Code Language Models and Copilot Chat through the `@janus` chat participant and typed VS Code Language Model Tools (`vscode.lm.registerTool`).

## Requirements

### Requirement: Chat Participant Registration
The system SHALL register the `@janus` chat participant in the VS Code Chat panel with support for slash commands (`/help`, `/search`, `/tasks`, `/summarize`, `/inbox`) and multi-turn Language Model tool execution, delegating prompt processing to the active VS Code Language Model or the configured Janus AI provider fallback.

#### Scenario: User queries @janus with an open note
- **WHEN** user sends `@janus organize my tasks` with `project.md` active
- **THEN** `@janus` receives the request with current note path context, invokes available Janus tools when requested by the model, feeds tool results back to the model, and streams the final answer

### Requirement: Language Model Tool for Reading Notes and Companions
The system SHALL provide a tool `janus_read_note_and_companions` that returns the textual content of a Markdown note and the parsed data of the containing folder's `tasks.json` and the note's `*.chart.json` companion file.

#### Scenario: Reading existing note and companions
- **WHEN** a Language Model calls `janus_read_note_and_companions` with a valid note path
- **THEN** the tool returns the note's Markdown text along with parsed contents of the containing folder's `tasks.json` and `<note>.chart.json` if present

### Requirement: Language Model Tool for Mutating Tasks
The system SHALL provide a tool `janus_mutate_tasks` that updates, adds, or checks off tasks in a folder's `tasks.json` companion file, enforcing strict schema validation. The tool's published input schema SHALL describe the optional task fields `priority` (`low`, `medium`, `high`), `dueDate` and `scheduledDate` (`YYYY-MM-DD`), and `note`, so language models can set them.

#### Scenario: Valid task mutation
- **WHEN** a Language Model calls `janus_mutate_tasks` with valid task item updates for a note or folder
- **THEN** the tool validates the input against the task schema, updates `<folder>/tasks.json` on disk, and returns a confirmation result

#### Scenario: Setting task dates through the tool
- **WHEN** a Language Model calls `janus_mutate_tasks` with action `update` and a task carrying `scheduledDate: "2026-11-03"`
- **THEN** the task in `<folder>/tasks.json` has that `scheduledDate` and its other fields are unchanged

#### Scenario: Invalid schema rejected
- **WHEN** a Language Model passes malformed task payload to `janus_mutate_tasks`
- **THEN** the tool returns a descriptive schema validation error without writing corrupted data to disk

### Requirement: Language Model Tool for Mutating Diagrams
The system SHALL provide a tool `janus_mutate_chart` that creates or updates a `*.chart.json` companion file with a valid diagram definition.

#### Scenario: Updating diagram companion
- **WHEN** a Language Model calls `janus_mutate_chart` with diagram syntax (e.g. Mermaid flowchart code)
- **THEN** the tool writes the validated chart companion file and returns success

### Requirement: Note Modification Diff Preview and Approval
The system SHALL support safe Markdown updates by allowing the agent or tool to present proposed modifications via VS Code's native diff editor before applying changes.

#### Scenario: Proposing changes to Markdown note
- **WHEN** the agent proposes textual updates to `notes.md`
- **THEN** the system generates a diff preview in the editor allowing the user to review and confirm changes prior to writing to the document

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
