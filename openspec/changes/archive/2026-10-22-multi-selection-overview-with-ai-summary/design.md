# Design

## Context

Janus Note uses `NotesTreeDataProvider` rendered in a custom VS Code TreeView (`janus.notesView`). Recently, `FolderOverviewViewProvider` and its associated React webview app (`FolderOverviewApp.tsx`) were introduced to provide an aggregated central overview for a single folder with stats, note cards, tasks, and on-demand AI summarization.

Currently, the TreeView configures `canSelectMany: false` (default), preventing multi-item selection. When users want to synthesize, compare, or review multiple notes across one or more folders simultaneously, they have to navigate individually.

See `proposal.md` for motivation and scope boundaries.

## Goals / Non-Goals

**Goals:**
- Enable multi-selection in `janus.notesView` (`canSelectMany: true`).
- Automatically open or update the Overview panel when 2 or more items are selected in the sidebar, with debouncing to prevent UI thrashing during Shift/Cmd clicking.
- Support arbitrary combinations of selected notes and folders in the overview dashboard.
- Provide on-demand AI summarization targeting the multi-selection.
- Save generated summaries intelligently: in the common parent folder if all items reside in one folder, or in the workspace notes root for cross-folder selections.

**Non-Goals:**
- Changing single-click behavior for single items (clicking one note continues standard selection / opening; expanding folders remains via chevron).
- Batch drag-and-drop file operations.

## Decisions

### 1. TreeView Multi-Selection & Debounced Listener
- **Decision**: Set `canSelectMany: true` when creating `notesTreeView`. Listen to `notesTreeView.onDidChangeSelection` with a debounce timer (~200ms). When `e.selection.length >= 2`, call `folderOverviewViewProvider.openSelection(e.selection)`.
- **Rationale**: VS Code fires `onDidChangeSelection` on every single click in a Shift-selection range. Debouncing ensures smooth interaction without repeatedly rebuilding and posting webview data.
- **Alternatives considered**: Triggering via a context menu command only. Trade-off: Less fluid than automatic opening upon selection.

### 2. Generalizing Overview Data Model
- **Decision**: Extend `FolderOverviewData` with:
  - `mode: 'folder' | 'multi'`
  - `title: string` (e.g. `Übersicht: Auswahl (3 Elemente)`)
  - `selectedCount: number`
  - `canIncludeSubfolders: boolean` (true if at least one selected item is a folder)
  - `defaultSaveLocation: string` (resolved directory URI for persistence)
- **Rationale**: Reuses 100% of the UI components in `FolderOverviewApp.tsx` (header, stats pills, task summary, note cards, and AI summarization) without creating a duplicate webview bundle.

### 3. Multi-Item Note & Task Ingestion in `AiFolderSummaryService`
- **Decision**: Add `generateSelectionSummary(items: Array<{ uri: vscode.Uri, isFolder: boolean }>, options: { includeSubfolders?: boolean })` to `AiFolderSummaryService`.
  - For each note item: directly read and truncate.
  - For each folder item: discover notes within that folder (recursively if `includeSubfolders: true`).
  - Collect `tasks.json` from each unique folder represented in the selection.
- **Rationale**: Keeps provider logic focused on view management while centralizing note discovery and AI prompting in the service layer.

### 4. Smart Persistence Strategy
- **Decision**: When the user clicks "Als Notiz speichern":
  - If all selected items share the same parent directory: save as `<folder>/summary.md`.
  - If selected items span multiple different directories: save as `<notesRoot>/summary.md`.
  - Increment filename if collision exists (`summary-1.md`, etc.).
- **Rationale**: Prevents arbitrary placement while keeping cross-folder synthesis easily accessible at the vault root.

## Risks / Trade-offs

- **[Risk] Rapid clicking in sidebar could trigger multiple panel reveals** → **Mitigation**: 200ms debounce timer on `onDidChangeSelection`, cancelled and reset on each incoming event.
- **[Risk] Large multi-selection (e.g. selecting multiple folders) could discover dozens of notes** → **Mitigation**: Maintain existing truncation limit (e.g. 30 notes max, 1500 chars per note) in `AiFolderSummaryService`.
- **[Risk] Single-click editor navigation could conflict with multi-selection** → **Mitigation**: Only trigger overview if `e.selection.length >= 2`. When `length < 2`, the event is ignored by the multi-selection listener.

