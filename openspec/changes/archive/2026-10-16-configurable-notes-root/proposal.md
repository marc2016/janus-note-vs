# Proposal

## Why

In many multi-purpose repositories and projects, Markdown notes and documentation do not live at the root of the workspace, but rather in a dedicated subfolder such as `notes/`, `docs/notes/`, or `knowledge-base/`. Currently, Janus Note assumes the workspace root is the notes container. Users need a clean, native way to select and configure a root directory within their open workspace via VS Code settings (`janus.notesRoot`), including convenient context menu commands in the File Explorer.

## What Changes

- Add a new VS Code setting `janus.notesRoot` (string, default `""` for workspace root) with automatic live reload on configuration change.
- Add an Explorer context menu action on folders: *"Janus: Als Notizen-Ordner festlegen"* (`janus.setNotesRoot`) and a command to reset to workspace root (`janus.resetNotesRoot`).
- Update `CompanionManager` and path resolution to resolve notes and companion files within the configured notes root.
- Update agent tools (`@janus`, `ReadNoteTool`) to scope notes resolution and relative paths to the configured notes root.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `companion-manager`: Adds requirement for configurable notes root via VS Code settings and Explorer context menu commands, scoping note and companion discovery to the configured folder.

## Impact

- **Configuration**: Contributes `janus.notesRoot` to `package.json` under `contributes.configuration`.
- **Commands & Menus**: Contributes `janus.setNotesRoot` and `janus.resetNotesRoot` to `package.json` under `contributes.commands` and `contributes.menus` (`explorer/context`).
- **Core Services**: Extends `CompanionManager` and `companionPaths.ts` with root directory resolution and configuration change listening.
