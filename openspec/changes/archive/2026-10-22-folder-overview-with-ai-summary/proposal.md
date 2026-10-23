# Proposal

## Why

Currently, selecting or interacting with a folder in the Janus Notes sidebar only toggles its tree expansion (`collapsed` / `expanded`). Users working in folders that contain multiple project notes, tasks, and diagrams have no central dashboard or aggregate view of that folder's contents and progress.

Providing a dedicated central **Folder Overview** dashboard with an inline trigger in the sidebar and on-demand AI summarization allows users to quickly review notes, track task statuses, and synthesize the folder's entire knowledge base into actionable executive summaries.

## What Changes

- Add an inline action icon `$(dashboard)` on hover for folder items (`janusFolder` and `janusLinkedFolder`) in the Notes sidebar TreeView that triggers `janus.openFolderOverview`.
- Introduce a new central editor Webview panel (`FolderOverviewViewProvider` with viewType `janus.folderOverview`) displaying:
  - Folder header with name, relative path breadcrumbs, quick statistics (note counts, task progress, attached diagrams), and quick actions (`+ Neue Notiz`, `Aufgaben öffnen`).
  - Interactive notes grid/list displaying each Markdown note in the folder with title, snippet preview, modification date, and direct click-to-open.
  - Folder tasks card showing progress and task statuses from `tasks.json`.
  - AI Summary card featuring an on-demand "Ordner zusammenfassen" button with an optional "Unterordner einbeziehen" toggle.
  - Post-generation actions: displaying the generated summary temporarily, with buttons to "Als Notiz speichern" (e.g. `summary.md` or `uebersicht.md`) and "In Zwischenablage kopieren".
- Introduce `AiFolderSummaryService` to ingest notes from the targeted folder (and optionally subfolders) and stream/generate structured summaries using the user's active AI model.

## Capabilities

### New Capabilities
- `folder-overview`: Provides an interactive folder dashboard webview in the editor area with note cards, task progress summaries, and AI-powered synthesis of folder notes with an option to persist the summary as a Markdown note.

### Modified Capabilities
- `notes-sidebar`: Adds an inline dashboard trigger command on folder tree items in the sidebar to open the folder overview without altering default chevron expand/collapse behavior.

## Impact

- `package.json`: Registers `janus.openFolderOverview` command and `view/item/context` menu contribution with `group: "inline"`.
- `src/ui/notesTreeDataProvider.ts`: Configures context values and command handling for folder tree items.
- `src/editors/folderOverviewViewProvider.ts`: New Webview panel provider.
- `src/services/aiFolderSummaryService.ts`: New AI folder synthesis service.
- `src/webviews/folderOverview/`: New React webview application and bundle built via `esbuild.js`.
- Existing note editing, linking, and task management remain unaffected.

