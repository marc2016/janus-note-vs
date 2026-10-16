# Proposal

## Why

The current Markdown editor view contains a redundant top application header with "Live Preview" / "Obsidian-Style Raw Sync" badges and an explicit contrast/theme toggle button. This header occupies valuable vertical screen space. Users want maximum vertical editing canvas with a single clean toolbar where the action to open the source document is placed conveniently at the end of the formatting toolbar, and the manual theme toggle is removed in favor of automatic VS Code theme adaptation.

## What Changes

- Remove the top application `<header>` element completely, freeing vertical editing space.
- Move the "Quelltext bearbeiten" (open source document in side editor) action button to the far right / end of the `MarkdownToolbar`.
- Remove the manual "Light / Theme" toggle button entirely, relying cleanly on the existing automatic VS Code theme detection.
- Clean up unused UI components and icons (`Badge`, theme toggle state/handlers, and unused icon imports) from the header.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `markdown-editor`: Update toolbar and editor layout requirements to eliminate the top application header, remove the manual theme toggle button, and position the source document navigation button at the end of the fixed toolbar.

## Impact

- `src/webviews/markdown/MarkdownEditorApp.tsx`: Header component removed, theme toggle button logic removed, `handleOpenSource` passed into or handled via `MarkdownToolbar`.
- `src/webviews/markdown/components/MarkdownToolbar.tsx`: Extended with an optional or required `onOpenSource` prop to render the source document jump button at the end of the toolbar.
