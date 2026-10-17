# Proposal

## Why

Currently, task management in Janus Note uses individual `*.tasks.json` files beside every Markdown note, rendered as a heavy Kanban board. In daily note-taking workflows, users find Kanban boards too cumbersome and individual companion files clutter the directory structure. Users need a fast, streamlined **checklist to check off tasks**, organized **per folder** in a single `tasks.json`, along with an aggregated **virtual global task list** across the entire workspace without creating an extra file in the root.

## What Changes

- **Folder-Level Task Storage**:
  - Tasks are stored in a clean `tasks.json` in each folder, replacing individual `*.tasks.json` companion files per note.
  - Tasks support `id`, `title`, `completed` (boolean), `priority` (`high` | `medium` | `low`), `createdAt`, and an optional `note` reference (linking the task to a specific note in the folder).
- **Checklist Editor (replacing Kanban Board)**:
  - Replaces the multi-column Kanban board with a modern, high-performance **interactive checklist**:
    - Checkboxes `[ ]` / `[x]` with instant toggle and strikethrough.
    - Quick-add input field (press Enter to create next task).
    - Status filters: `Alle`, `Nur Offene`, `Erledigt`.
    - Priority pills and optional note link chips that open the associated Markdown note directly.
- **Virtual Global Task Aggregator**:
  - Dynamically collects tasks from all `tasks.json` files across the `notesRoot` hierarchy into a single unified view.
  - No file is created in the workspace root—it is completely virtual.
  - Checking off or modifying a task in the global list immediately updates the respective folder's `tasks.json` on disk.
  - Supports folder-based grouping (`📁 projekt-alpha`, `📁 sprint-42`).
- **Sidebar Integration**:
  - Adds a persistent pinned item at the top of the Janus Notes tree: `📋 Alle Aufgaben (X offen)`.
  - Renders `📋 Aufgaben (X)` inside each folder item in the tree view.
  - Adds commands: `janus.openAllTasks` and `janus.openFolderTasks`.

## Capabilities

### New Capabilities
- `folder-tasks`: Manages folder-level `tasks.json` storage and provides the virtual global task list aggregator with bi-directional synchronization to folder files.

### Modified Capabilities
- `companion-editors`: Modifies the Tasks Editor provider from a multi-column Kanban Board to an interactive checklist interface with quick-add, filtering, and note navigation.
- `notes-sidebar`: Updates sidebar tree view to include the pinned global tasks item and folder-level task entries, phasing out individual `*.tasks.json` companion tree nodes.

## Impact

- `src/models/tasks.ts`: Updates schema for folder-level task collections with optional `note` reference.
- `src/webviews/tasks/`: Replaces `TaskBoardApp.tsx` with `TaskListApp.tsx` (checklist interface).
- `src/services/` / `src/editors/`: Adds `VirtualTasksProvider` / `folderTasksService.ts` for directory scanning and aggregated task editing.
- `src/ui/notesTreeDataProvider.ts`: Adds global tasks tree item and folder task children.
- `package.json`: Updates commands and editor descriptions (`Janus Task List` instead of `Janus Task Board`).
