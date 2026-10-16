# Tasks

## 1. Project Scaffolding & Build Pipeline

- [x] 1.1 Initialize `package.json`, `tsconfig.json`, and VS Code extension manifest with required contribution points (`customEditors`, `chatParticipants`, `languageModelTools`, `commands`) and verify `npm run compile` executes without error.
- [x] 1.2 Configure `esbuild` build scripts for compiling the extension host entry point and webview client assets and verify bundle outputs in `dist/`.

## 2. Data Models & Companion Manager

- [x] 2.1 Define Zod schemas and TypeScript types for `*.tasks.json` and `*.chart.json` companion files and verify schema unit tests pass.
- [x] 2.2 Implement `CompanionManager` service for locating, pairing, and creating companion files next to Markdown notes and verify file pairing tests pass.
- [x] 2.3 Implement `CodeLensProvider` for Markdown notes displaying companion file counts and navigation links and verify CodeLens resolves on Markdown documents.
- [x] 2.4 Add `vscode.workspace.createFileSystemWatcher` to monitor companion file changes on disk and verify change events update active editor states.

## 3. Visual Companion Custom Editors

- [x] 3.1 Implement `TasksEditorProvider` conforming to `vscode.CustomTextEditorProvider` for `*.tasks.json` and verify opening a tasks companion opens the custom webview.
- [x] 3.2 Build the Task Board Webview UI (Kanban / checklist) with task completion toggles, creation, and deletion, and verify document edits trigger VS Code dirty indicators and undo stack support.
- [x] 3.3 Implement `ChartEditorProvider` conforming to `vscode.CustomTextEditorProvider` for `*.chart.json` with Mermaid diagram rendering and verify diagram preview renders accurately.

## 4. Language Model Tools & Chat Participant

- [x] 4.1 Implement `janus_read_note_and_companions` via `vscode.lm.registerTool` and verify it returns note content and companion JSON data.
- [x] 4.2 Implement `janus_mutate_tasks` via `vscode.lm.registerTool` with Zod schema validation and verify valid task mutations persist to disk while invalid mutations are rejected.
- [x] 4.3 Implement `janus_mutate_chart` via `vscode.lm.registerTool` with diagram syntax validation and verify diagram file mutations persist to disk.
- [x] 4.4 Implement note modification diff review using `vscode.diff` allowing users to preview and accept proposed text changes before writing to disk.
- [x] 4.5 Register the `@janus` chat participant via `vscode.chat.createChatParticipant`, configuring the system prompt with active note context and tool execution, and verify chat responses stream in VS Code Chat.

## 5. End-to-End Verification & Packaging

- [x] 5.1 Run all unit tests for companion discovery, schema validation, and tool execution and verify 100% test pass rate.
- [x] 5.2 Validate extension packaging with `npm run package` or `vsce package --dry-run` and verify manifest validation succeeds.
