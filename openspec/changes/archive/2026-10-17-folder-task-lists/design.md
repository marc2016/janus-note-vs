# Design

## Context

See [proposal.md](file:///Users/marclammers/sources/janus-note-vs/openspec/changes/folder-task-lists/proposal.md) for background and motivation. Currently, `TasksEditorProvider` renders a 3-column Kanban board for `*.tasks.json` companions. This design specifies how tasks are stored on a directory level in `tasks.json`, how the editor is rebuilt as an interactive checklist, and how a virtual global aggregator collects tasks across all folders without root storage.

## Goals / Non-Goals

**Goals:**
- Replace the multi-column Kanban board with a fast, modern interactive checklist webview (`TaskListApp.tsx`).
- Store tasks inside a directory-level `tasks.json` file.
- Support optional note associations (`note: "architektur.md"`) within folder tasks.
- Provide a virtual global tasks view aggregating all `tasks.json` files in the workspace with folder grouping.
- Ensure changes in the virtual view write directly to the respective folder's `tasks.json`.
- Add pinned sidebar entries for global tasks and folder tasks.

**Non-Goals:**
- Complex Gantt charts or multi-user assignment workflows.
- Creating an aggregated physical file in the root directory.

## Decisions

### 1. Data Model (`src/models/tasks.ts`)
- Schema updated for folder-level tasks:
  ```ts
  export interface TaskItem {
    id: string;
    title: string;
    completed: boolean;
    status: 'todo' | 'done';
    priority: 'low' | 'medium' | 'high';
    note?: string; // relative filename within the same folder, e.g. "meeting.md"
    createdAt: string;
    folder?: string; // attached in virtual global view
    folderUri?: string; // attached in virtual global view
  }
  ```
- The JSON file format is:
  ```json
  {
    "version": 1,
    "tasks": [ ... ]
  }
  ```

### 2. Checklist Webview UI (`src/webviews/tasks/TaskListApp.tsx`)
- Replaces `TaskBoardApp.tsx`.
- Core UI elements:
  - Header with title, open/completed counter, and filter pills (`Alle`, `Nur Offene`, `Erledigt`).
  - Search / quick filter bar.
  - Quick-add input field at top: typing task title + pressing Enter creates task and resets input for rapid entry.
  - Task item row:
    - Checkbox `[ ]` / `[x]` with immediate visual strikethrough.
    - Editable task title.
    - Priority pill (`high` red, `medium` amber, `low` slate).
    - Note reference chip (if `note` is present): clicking it sends an `openNote` message to the host.
    - Delete button (on hover).
  - Virtual Mode: Renders collapsible folder sections (`📁 projekt-alpha (2)`, `📁 sprint-42 (1)`).

### 3. Folder Tasks Service (`src/services/folderTasksService.ts`)
- Manages folder-level operations:
  - `findFolderTasksFiles(notesRootUri: vscode.Uri): Promise<vscode.Uri[]>`
  - `loadFolderTasks(tasksUri: vscode.Uri): Promise<TaskItem[]>`
  - `loadAllTasks(notesRootUri: vscode.Uri): Promise<{ folder: string; uri: vscode.Uri; tasks: TaskItem[] }[]>`
  - `updateTaskInFolder(tasksUri: vscode.Uri, updatedTask: TaskItem): Promise<void>`
  - `addTaskToFolder(tasksUri: vscode.Uri, task: Partial<TaskItem>): Promise<TaskItem>`
  - `countTotalOpenTasks(notesRootUri: vscode.Uri): Promise<number>`

### 4. Virtual Global Tasks View Panel
- Registered under command `janus.openAllTasks`.
- Creates a dedicated `WebviewPanel` titled "Alle Aufgaben (Workspace)".
- Communicates via PostMessage (`initGlobalTasks`, `toggleTask`, `createTask`, `deleteTask`, `openNote`).
- Edits dispatch directly to the containing folder's `tasks.json` file via `folderTasksService`.

### 5. Sidebar Tree View Integration (`src/ui/notesTreeDataProvider.ts`)
- **Pinned Top Item**: `AllTasksTreeItem`:
  - Placed at the very top of `janus.notesView`.
  - Icon: `checklist`.
  - Label: `Alle Aufgaben`.
  - Description: `(X offen)`.
  - Command: `janus.openAllTasks`.
- **Folder Tasks Child**:
  - Folders with `tasks.json` reveal a child item:
    - Label: `Aufgaben`.
    - Description: `(X offen)`.
    - Command: `vscode.openWith` pointing to `folder/tasks.json` with `janus.tasksEditor`.

## Risks / Trade-offs

- **[Risk] Disk synchronization during rapid task toggling in global view**
  → *Mitigation*: Debounce writes per file and maintain atomic reads/writes with error handling.
- **[Risk] Stale counts in the sidebar**
  → *Mitigation*: Register file watcher on `**/tasks.json` in `CompanionWatcher` to automatically trigger tree refresh when any task file is saved or modified.
