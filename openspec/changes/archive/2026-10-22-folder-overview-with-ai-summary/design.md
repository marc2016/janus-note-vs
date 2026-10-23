# Design

## Context

Janus Note uses VS Code Webview panels (`createWebviewPanel`) for rich standalone dashboards such as `GlobalTasksViewProvider` and `CalendarViewProvider`. The sidebar uses `vscode.TreeDataProvider` (`NotesTreeDataProvider`) where items represent folders, notes, and companions.

Currently, clicking a folder in the sidebar only toggles expansion. Adding a folder dashboard gives users an aggregated view of notes, task progress, and AI synthesis without disrupting normal chevron navigation.

See `proposal.md` for motivation and scope boundaries.

## Goals / Non-Goals

**Goals:**
- Provide a clean, modern folder overview webview in the editor area.
- Add an inline `$(dashboard)` action button on folder tree items in the sidebar to open the overview.
- Render interactive note cards showing title, preview snippet, and modification timestamps.
- Aggregate open and completed tasks from the folder's `tasks.json` companion.
- Provide on-demand AI summarization with an optional "Unterordner einbeziehen" toggle.
- Allow users to persist the generated summary directly as a Markdown note (`summary.md` or `uebersicht.md`) or copy it to the clipboard.

**Non-Goals:**
- Replacing the folder tree expansion in the sidebar (clicking the chevron or double-clicking still expands/collapses).
- Automatic periodic AI background generation (summaries are generated strictly on user demand).
- Multi-folder simultaneous batch summaries across disjoint root directories.

## Decisions

### 1. Webview Lifecycle and Panel Reuse
- **Decision**: `FolderOverviewViewProvider` manages an active `vscode.WebviewPanel`. If a user clicks the overview icon for folder A and then folder B, the existing panel is revealed and updated with folder B's data via `postMessage({ type: 'updateFolder', data })`, updating the tab title to `Übersicht: <folderName>`.
- **Rationale**: Avoids cluttering the editor tab bar with multiple duplicate overview tabs while keeping transitions instantaneous.
- **Alternatives considered**: Separate tab per folder. Trade-off: Tab bar clutter when exploring multiple folders in succession.

### 2. Sidebar Inline Action Trigger
- **Decision**: Register command `janus.openFolderOverview` in `package.json` with icon `$(dashboard)` and contribute to `view/item/context` with `when: "view == janus.notesExplorer && (viewItem == janusFolder || viewItem == janusLinkedFolder)"` and `group: "inline"`.
- **Rationale**: VS Code renders inline context commands on hover directly next to the tree item label, leaving primary row click behavior standard.
- **Alternatives considered**: Overriding `FolderTreeItem.command`. Trade-off: Would hijack normal click-to-expand in the tree view.

### 3. AI Summarization Architecture
- **Decision**: Create `AiFolderSummaryService` that uses `AiModelService`. It scans the folder (and optionally subfolders if `includeSubfolders: true`), reads note contents (with truncation caps per note to prevent context window overflow), and prompts the active AI model using a structured German system prompt focusing on key themes, milestones, and open questions.
- **Rationale**: Leverages existing multi-provider support (`vscode-lm`, `ollama`, `openai`, `anthropic`, `gemini`, `custom`) seamlessly without duplicating provider logic.
- **Alternatives considered**: Client-side LLM calls inside the webview. Trade-off: Insecure and would bypass VS Code Language Model API and existing API keys configured in Janus Note.

### 4. Summary Persistence Workflow
- **Decision**: When the user clicks "Als Notiz speichern", the webview posts a message `{ type: 'saveSummaryAsNote', folderUri, summaryContent }`. The extension host writes the note as `summary.md` (or `summary-1.md` if existing) with a metadata header and timestamp, and opens it via `vscode.commands.executeCommand('vscode.openWith', newNoteUri, 'janus.markdownEditor')`.
- **Rationale**: Keeps the overview temporary by default as requested by the user, while making persistence a frictionless one-click action.

### 5. Webview Build Pipeline
- **Decision**: Build `src/webviews/folderOverview/index.tsx` into `dist/webviews/folderOverview.js` using `esbuild.js` and style with existing Tailwind CSS tokens.
- **Rationale**: Matches the existing architecture of `calendar`, `tasks`, and `chart` webviews.

## Risks / Trade-offs

- **[Risk] Large folders with dozens of notes could exceed token limits** → **Mitigation**: `AiFolderSummaryService` extracts headings, first paragraphs, and task items up to a reasonable cap (e.g. 1500 characters per note or 20 total notes), prioritizing recently modified notes.
- **[Risk] Subfolders might contain non-note binaries or git directories** → **Mitigation**: Reuse existing `isMarkdownNote` filter and ignore `.git`, `node_modules`, and hidden directories.
- **[Risk] User closes tab while AI generation is in progress** → **Mitigation**: Pass `vscode.CancellationTokenSource` linked to webview panel disposal.

