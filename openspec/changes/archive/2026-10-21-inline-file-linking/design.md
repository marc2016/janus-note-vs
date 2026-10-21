# Design: Inline File and Note Linking

## Context

See [proposal.md](proposal.md) for motivation.

The Janus Markdown Editor operates inside a VS Code Custom Text Editor webview using CodeMirror 6. While `note-linking` already supports parsing wiki-links (`[[...]]`) and standard markdown links (`[...]`), authoring new links inline currently has no autocomplete assistance. The only interactive mechanism is the footer bar's "Link hinzufügen" button, which opens a VS Code QuickPick and appends the link at the very end of the document.

## Goals / Non-Goals

**Goals:**
- Provide real-time inline autocompletion inside CodeMirror 6 triggered by typing `[[`.
- Provide slash commands (`/link`, `/verlinken`, `/note`) that insert `[[` and trigger the autocomplete popup.
- Provide `Cmd+K` / `Ctrl+K` keybinding: wrap active selection in `[[...]]`, or insert `[[` and open completion if collapsed.
- Provide a link button (`$(link)`) on `MarkdownToolbar.tsx`.
- Include Markdown notes and other relevant file types (task boards, images, PDFs, diagrams) with distinct type icons and relative folder paths.
- Complete selections into standard `[[Target]]` wiki-links at the cursor.

**Non-Goals:**
- Fetching or resolving external HTTP/HTTPS web links.
- Indexing or scanning files outside the configured `janus.notesRoot`.

## Decisions

### 1. Candidate Provider in Extension Host & Webview Sync
- **Decision**: `MarkdownEditorProvider` scans `janus.notesRoot` for Markdown notes, companion task boards (`*.tasks.json`), diagrams (`*.chart.json`), images (`*.png`, `*.jpg`, `*.svg`, `*.gif`), and documents (`*.pdf`).
- **Data Structure**:
  ```ts
  export interface LinkCandidate {
    label: string;          // e.g. "Projekt-Alpha" or "diagram.png"
    insertText: string;     // e.g. "Projekt-Alpha" or "assets/diagram.png"
    relPath: string;        // e.g. "projects/alpha.md"
    fileType: 'note' | 'task' | 'chart' | 'image' | 'pdf' | 'file';
  }
  ```
- **Transmission**: Sent via postMessage during webview initialization (`init`) and whenever companion/file change events occur.
- **Rationale**: Local in-memory filtering inside the webview guarantees 0ms typing latency and prevents UI stutter while typing inside the editor.

### 2. CodeMirror 6 Autocompletion Source
- **Decision**: Implement `linkAutocompleteSource(candidates: LinkCandidate[])` using `@codemirror/autocomplete`.
  - Matches `context.matchBefore(/\[\[([^\]]*)$/)`.
  - Returns completions where `apply` replaces from the opening `[[` up to the cursor with `[[${candidate.insertText}]]`.
  - Annotates completion items with appropriate icons (e.g. `📄`, `📋`, `🖼️`, `📑`).
- **Rationale**: Direct CodeMirror extension integrates natively with existing slash command autocompletion and follows active VS Code editor theme styling.

### 3. Unified Trigger Actions (Slash Commands, Shortcut, Toolbar)
- **Slash Commands**: Add `/link`, `/verlinken`, and `/note` to `COMMANDS` in `slashCommands.ts`. When chosen, `apply` inserts `[[` and triggers CodeMirror's `startCompletion(view)`.
- **Keyboard Shortcut**: Register `Cmd+K` (macOS) / `Ctrl+K` (Windows/Linux) in the editor keymap. If text is selected (`from !== to`), wrap selection in `[[` and `]]`. If collapsed, insert `[[` and start autocompletion.
- **Toolbar Action**: Add a link button (`$(link)`) to `MarkdownToolbar.tsx` that dispatches the same `Cmd+K` action.

### 4. Insertion Format
- For Markdown notes: `[[NoteName]]` (omitting `.md` extension, matching Janus backlink convention).
- For non-note files (images, PDFs, companions): `[[relative/path/to/file.ext]]`.

## Risks / Trade-offs

- **[Risk] High file count in large workspaces causing performance degradation**
  - **Mitigation**: Cache file candidate lists per `notesRootUri` in `CompanionManager`, only invalidating on file watcher events.
- **[Risk] Conflict with existing slash commands autocomplete**
  - **Mitigation**: Slash commands match `/`, whereas link completions match `[[`. Both sources can be combined in `autocompletion({ override: [slashCommandSource, linkAutocompleteSource] })` without interference.
- **[Risk] Trailing brackets insertion duplication**
  - **Mitigation**: `context.matchBefore` matches the exact range from `[[` to cursor, replacing the entire prefix with the closed `[[Target]]` syntax.

