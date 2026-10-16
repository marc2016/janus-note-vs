# Proposal

## Why

Currently, Janus Note operates primarily via editor CodeLenses and context menu commands within the standard VS Code Explorer. Users working in larger code repositories or wishing to use Janus Note as a dedicated notebook have no dedicated UI surface that focuses strictly on their notes. Furthermore, there is no guided onboarding to initialize a note collection or warning when the configured root folder is cluttered with non-note project files.

A dedicated Janus Activity Bar sidebar with a TreeView restricted to the configured `notesRoot`, accompanied by an initialization flow and welcome states, turns Janus Note into a focused, first-class note-taking environment inside VS Code.

## What Changes

- Add a dedicated Activity Bar view container (`janus-notes`) featuring the Janus icon.
- Add a custom TreeView (`janus.notesView`) inside the view container that displays only Markdown notes (`.md`) and subfolders under the configured `janus.notesRoot`.
- Render attached companion files (`*.tasks.json`, `*.chart.json`) as collapsible child items directly under their respective parent Markdown notes in the TreeView. Clicking a note opens the Markdown editor, while clicking a companion item opens its specialized visual editor (Task Board or Diagram View).
- Introduce an initialization state (`janus.initialized` setting or workspace state):
  - When uninitialized and the target folder contains non-note files (e.g. source code, project assets), display an informative Welcome View explaining that project files exist and providing buttons to either choose a dedicated subfolder or initialize anyway.
  - When uninitialized and clean (or empty), display a Welcome View with an "Init" action.
- Introduce the command `janus.initNotesRoot`:
  - Creates a default `inbox.md` note if not already present.
  - Sets the workspace to initialized.
  - Opens `inbox.md` in the editor.
  - Refreshes the sidebar into the active note tree view.

## Capabilities

### New Capabilities
- `notes-sidebar`: Provides a dedicated Activity Bar ViewContainer, a note-focused TreeView with expandable companion children, and an initialization workflow with context-sensitive Welcome Views for onboarding.

### Modified Capabilities
<!-- None -->

## Impact

- `package.json`: Contributes new viewContainers, views, viewsWelcome, and commands (`janus.initNotesRoot`).
- Extension architecture: Adds a TreeDataProvider implementation (`NotesTreeDataProvider`), tree item models, and context key updates (`janus.isInitialized`, `janus.hasNonNoteFiles`).
- Workspace settings: Extends configuration schema with `janus.initialized`.
