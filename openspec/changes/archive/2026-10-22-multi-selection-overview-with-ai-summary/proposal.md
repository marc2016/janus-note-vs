# Proposal

## Why

Currently, selecting multiple items in the Janus Notes sidebar is not enabled (`canSelectMany: false`), and users can only inspect individual notes or trigger a folder overview for a single folder. When working across multiple related notes or folders, users need a fast, frictionless way to select multiple items (using Cmd/Ctrl or Shift click) and immediately view an aggregated dashboard with statistics, note previews, and on-demand AI summarization across their custom selection.

## What Changes

- Enable multi-selection (`canSelectMany: true`) in the Janus Notes TreeView (`janus.notesView`).
- Automatically open or update the overview dashboard when 2 or more items are selected in the sidebar (with brief debounce to prevent rapid-fire reloads).
- Extend the overview webview provider and React app to support multi-item selection (`selectionMode: 'folder' | 'multi'`):
  - Aggregated header: count of selected notes, folders, and total tasks across the selection.
  - Interactive notes grid displaying all selected notes (including direct notes from any selected folders).
  - AI summarization tailored to the multi-item selection, with subfolder traversal toggle for any selected folders.
  - Smart persistence: saves generated summaries in the common folder if all selected notes share one, or in the workspace notes root for cross-folder selections.

## Capabilities

### New Capabilities
<!-- No new standalone capabilities; extends folder-overview and notes-sidebar. -->

### Modified Capabilities
- `notes-sidebar`: Enable multi-select in the Notes TreeView and trigger multi-item overview on selection of 2 or more items.
- `folder-overview`: Support multi-item selection mode alongside folder mode, aggregating content and AI synthesis across arbitrary note and folder selections.

## Impact

- `src/extension.ts`: Update `createTreeView` with `canSelectMany: true` and add selection change listener.
- `src/editors/folderOverviewViewProvider.ts`: Generalize data aggregation to accept arrays of URIs / tree items and support selection overview mode.
- `src/services/aiFolderSummaryService.ts`: Support summarizing arbitrary collections of notes and folders.
- `src/webviews/folderOverview/FolderOverviewApp.tsx`: Adapt title, statistics, and persistence behavior for multi-selection contexts.
- Tests in `tests/folderOverviewViewProvider.test.ts`, `tests/aiFolderSummaryService.test.ts`, and `tests/notesTreeDataProvider.test.ts`.

