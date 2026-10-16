# Design

## Context

See `proposal.md` for motivation.

In VS Code extensions, workspace-specific configurations are canonically stored in `.vscode/settings.json` and managed via `vscode.workspace.getConfiguration('janus')`. Currently, `CompanionManager` and path utilities treat notes purely by file-system adjacency without an explicit notes root boundary.

## Goals / Non-Goals

**Goals:**
- Provide `janus.notesRoot` setting in `package.json` under `contributes.configuration`.
- Provide an Explorer context menu action (`janus.setNotesRoot`) on folders and a command palette command to reset to workspace root (`janus.resetNotesRoot`).
- Support live configuration updates via `vscode.workspace.onDidChangeConfiguration`.
- Expose notes root resolution helper methods (`getNotesRootUri()`, `isUnderNotesRoot(uri)`) in `CompanionManager`.

**Non-Goals:**
- Indexing folders outside of the currently open VS Code workspace.

## Decisions

### 1. VS Code Settings Schema
- **Decision**: Define `janus.notesRoot` as a resource-scoped string setting defaulting to `""` (workspace root).
- **Rationale**: Follows standard VS Code conventions, works with `.vscode/settings.json`, and allows team members to share the configuration in source control.

### 2. Context Menu & Explorer Integration
- **Decision**: Register command `janus.setNotesRoot` with menu entry in `explorer/context` when `explorerResourceIsFolder` is true.
- **Rationale**: Allows one-click configuration directly from the File Explorer without manually opening settings.

### 3. Dynamic Configuration Handling
- **Decision**: Subscribe to `vscode.workspace.onDidChangeConfiguration` inside `extension.ts` or `CompanionManager`. When `e.affectsConfiguration('janus.notesRoot')` fires, re-evaluate the active notes root and refresh CodeLens and watcher providers.
- **Rationale**: Eliminates the need to reload the window when changing the notes folder.

## Risks / Trade-offs

- **[Risk]** A configured relative path might not exist or might point to an invalid folder.
  → **Mitigation**: Verify folder existence with `vscode.workspace.fs.stat()`; if the folder cannot be found, fall back gracefully to the workspace root and show an informative warning message.
