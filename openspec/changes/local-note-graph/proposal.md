# Proposal

## Why

The note graph always shows the whole collection. With more than a few dozen notes it becomes a dense cloud in which the note you are working on is hard to find, and its neighbourhood is lost among unrelated clusters. The question users ask while writing is local: "what is this note connected to, and what is one step further?" Today they have to find the node by searching, then mentally filter. This was listed as the first non-goal of `add-note-graph-view`.

## What Changes

- The graph panel gets a mode switch, `Ganzes Netzwerk` / `Aktuelle Notiz`. In `Aktuelle Notiz` mode, it shows only the active note and the notes within a chosen number of link steps (`Tiefe` 1, 2 or 3, default 1), following links in both directions.
- The active note is the note in the most recently focused editor (Janus Markdown Editor or text editor) inside the notes collection. While in local mode, the graph re-centres when the user switches to another note. Focusing the graph panel itself keeps the current centre.
- The centre note is visually emphasized and always shown.
- The search field and `Fehlende Notizen anzeigen` still apply in local mode. `Verwaiste Notizen anzeigen` has no effect there, because every shown note is connected to the centre.
- New command `janus.openLocalNoteGraph` (`Janus: Lokales Notiz-Netzwerk öffnen`), also in the editor title bar overflow menu of Markdown notes, opens the panel beside the editor in local mode centred on that note.
- The chosen mode and depth are remembered by the panel.

Non-goals (possible follow-ups): a second, separate local graph panel next to the global one, a local graph inside the editor footer, depth above 3, pinning a centre that ignores editor changes, and following only outgoing or only incoming links.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `note-graph`: new local mode with centre tracking, depth, and the `janus.openLocalNoteGraph` command. The existing graph contents, encoding, interaction, filters and live updates are unchanged in `Ganzes Netzwerk` mode.

## Impact

- `src/editors/noteGraphViewProvider.ts`: tracks the active note (`window.tabGroups.onDidChangeTabs`, `window.onDidChangeActiveTextEditor`), posts `focusNote` messages, opens beside in local mode.
- `src/webviews/noteGraph/`: mode switch and depth select in `NoteGraphApp.tsx`, neighbourhood computation in `graphFilter.ts`, centre emphasis in `NoteGraphCanvas.tsx`.
- `src/extension.ts` and `package.json`: new command and `editor/title` menu entry. `getActiveNoteUri` in `extension.ts` can be reused for the initial centre.
- No new dependencies or settings. The graph data sent to the webview is unchanged, so the neighbourhood is computed client-side.
