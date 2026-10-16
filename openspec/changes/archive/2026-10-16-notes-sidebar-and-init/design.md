# Design

## Context

See `proposal.md` for background and motivation. Janus Note currently provides `CompanionManager` which handles resolving `janus.notesRoot` (defaulting to the workspace root if unset) and discovering attached companion files (`*.tasks.json`, `*.chart.json`). However, navigation has relied solely on the generic VS Code file explorer and CodeLens annotations.

This change introduces a dedicated `TreeDataProvider` in a custom Activity Bar view container, backed by VS Code's `viewsWelcome` mechanism for onboarding and folder initialization.

## Goals / Non-Goals

**Goals:**
- Provide a clear, isolated visual hierarchy in the Activity Bar showing exclusively Markdown notes and folders under `janus.notesRoot`.
- Nest companion files as interactive, clickable child items under their respective `.md` notes.
- Guide users through initialization with context-aware Welcome Views based on directory hygiene (clean vs. containing non-note code/files).
- Automate first-time setup via `janus.initNotesRoot` (creating `inbox.md`, updating initialization state, opening the note).

**Non-Goals:**
- Implementing a custom filesystem virtual provider (standard `vscode.workspace.fs` is used).
- Full-text search inside the TreeView (VS Code built-in search or separate panel handles searching).
- Drag-and-drop note reordering in this initial iteration.

## Decisions

### 1. ViewContainer and TreeDataProvider Architecture
- **View Container**: Added to `package.json` under `contributes.viewsContainers.activitybar` with ID `janus-notes`, titled "Janus Note", with an SVG icon.
- **View**: Contributed under `janus-notes` with ID `janus.notesView`.
- **TreeDataProvider**: `NotesTreeDataProvider` implements `vscode.TreeDataProvider<NotesTreeItem>`.
  - Item Types:
    - `FolderItem`: Represents a directory within `notesRoot`. Expandable.
    - `NoteItem`: Represents a `.md` note. Expandable only if companion files exist (`tasksExist || chartExist`). Clicking the item executes `vscode.open` with the note's URI.
    - `CompanionItem`: Child item representing a companion. Clicking executes `vscode.openWith` specifying `janus.tasksEditor` or `janus.chartEditor`.
- **Tree Population**: Lazy-loaded in `getChildren(element)`. If `element` is undefined, reads `notesRoot` directory. If `element` is a `FolderItem`, reads subfolder entries. If `element` is a `NoteItem`, queries `CompanionManager.getCompanionStatus(noteUri)` to return companion child nodes.

### 2. Initialization & Context Keys
- A new configuration property `janus.initialized` (boolean, default: `false`) in `package.json`.
- Two context keys managed by the extension via `vscode.commands.executeCommand('setContext', ...)`:
  - `janus.isInitialized`: Evaluated on startup and config change. True if `janus.initialized` is `true` OR if markdown notes already exist in `notesRoot`.
  - `janus.hasNonNoteFiles`: True if `notesRoot` contains non-note files (source files, packages, binaries) at its top level, reusing the filter from `notesRootCommands.ts`.
- `viewsWelcome` contributions in `package.json`:
  1. `when: "!janus.isInitialized && janus.hasNonNoteFiles"`: Warning about existing project files with actions `[ Notizen-Ordner festlegen ](command:janus.setNotesRoot)` and `[ Trotzdem hier initialisieren ](command:janus.initNotesRoot)`.
  2. `when: "!janus.isInitialized && !janus.hasNonNoteFiles"`: Clean welcome with `[ Notizen initialisieren ](command:janus.initNotesRoot)`.

### 3. Initialization Flow (`janus.initNotesRoot`)
- Resolves the target `notesRoot` URI using `CompanionManager.getNotesRootUri()`.
- Checks if `inbox.md` exists:
  - If missing, writes an initial welcome Markdown file (`# Inbox\n\nWelcome to your Janus Notes!\n`).
- Updates `janus.initialized` in workspace configuration to `true`.
- Sets context `janus.isInitialized` to `true`.
- Refreshes `NotesTreeDataProvider`.
- Opens `inbox.md` in the active editor.

## Risks / Trade-offs

- **[Risk] Directory scanning performance in large workspaces**
  → *Mitigation*: Only direct top-level entries of `notesRoot` are inspected to determine `hasNonNoteFiles`. Tree items are loaded lazily on expand.
- **[Risk] Companion discovery overhead**
  → *Mitigation*: `getCompanionStatus` is only evaluated when rendering or expanding individual note nodes, and files are watched via the existing `CompanionWatcher` which triggers tree refreshes.
- **[Risk] Existing users with notes being prompted to initialize**
  → *Mitigation*: Initialization detection automatically considers the folder initialized if existing markdown notes are detected in `notesRoot`, ensuring a smooth transition without mandatory manual re-initialization.
