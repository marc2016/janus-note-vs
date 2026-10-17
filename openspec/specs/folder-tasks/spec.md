# folder-tasks Specification

## Purpose

Provides directory-scoped task storage via `tasks.json` and a virtual aggregated global task list across the entire Janus notes workspace without requiring root files.

## Requirements

### Requirement: Directory-Scoped Task Storage
The system SHALL store and manage task items within a `tasks.json` file in each folder of the notes collection, supporting task completion states, priorities, creation dates, and optional associations with notes.

#### Scenario: Storing tasks in a directory tasks.json
- **WHEN** user creates or updates a task in a folder
- **THEN** system persists the task array in `<folder>/tasks.json` with unique ID, title, completed status, priority, and optional note reference

### Requirement: Virtual Global Task List Aggregation
The system SHALL dynamically discover all `tasks.json` files across the active notes root and aggregate their tasks into a single virtual collection without creating a physical file in the root.

#### Scenario: Aggregating tasks across all subdirectories
- **WHEN** user opens the global task list
- **THEN** system scans all subdirectories in `janus.notesRoot`, collects all tasks, and groups them by their containing folder

### Requirement: Bi-directional Synchronization of Global Tasks
The system SHALL immediately reflect any task mutation performed in the virtual global task list back to the corresponding folder's `tasks.json` file on disk.

#### Scenario: Toggling a task in the global list
- **WHEN** user toggles a task belonging to `project-a` in the virtual global task list
- **THEN** system updates the task's completion state directly in `project-a/tasks.json` and notifies registered watchers

