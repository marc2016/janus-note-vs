# Proposal

## Why

Janus Note's core concept pairs human-readable Markdown notes with machine-operable, schema-validated companion files (`*.tasks.json`, `*.chart.json`) so that AI agents and humans can collaborate without corrupting Markdown prose. Originally developed as a standalone Tauri desktop application, porting this workflow into a native VS Code extension allows developers to use their existing editor, file workspace, and native Language Models (GitHub Copilot, Claude 3.5 Sonnet, GPT-4o via `vscode.lm`) without managing third-party API keys or switching between separate desktop applications.

## What Changes

- **Extension Scaffolding & Manifest**: Set up a TypeScript-based VS Code extension with standard packaging, build tooling (esbuild/vite), and configuration.
- **Companion File Linking & Discovery**: Automatically detect and pair active Markdown files with companion data files (`<name>.tasks.json`, `<name>.chart.json`) with live filesystem watching and CodeLens shortcuts directly in Markdown editors.
- **Visual Companion Editors**:
  - Custom Webview Editor for `*.tasks.json` providing an interactive Task Board (Kanban / Checklist view) with bidirectional syncing between GUI and JSON.
  - Custom Webview Editor / Preview for `*.chart.json` rendering interactive diagrams (Mermaid / flowchart) with live updates.
- **VS Code Chat Participant & Language Model Tools**:
  - Register `@janus` chat participant in VS Code Chat.
  - Register Language Model Tools (`vscode.lm.registerTool`) allowing `@janus` and other VS Code agents to inspect notes, mutate companion JSON files with schema validation, and propose note modifications via VS Code native diff reviews.

## Capabilities

### New Capabilities
- `companion-manager`: Detection, association, filesystem watching, and CodeLens navigation between Markdown notes and companion files (`*.tasks.json`, `*.chart.json`).
- `companion-editors`: Interactive Webview Custom Editors for visual task boards (`*.tasks.json`) and diagram visualizers (`*.chart.json`).
- `agent-tools`: Registration of the `@janus` VS Code Chat participant and typed Language Model Tools (`vscode.lm.registerTool`) for reading notes, mutating task companions, mutating diagram companions, and previewing diffs.

### Modified Capabilities
None (initial specification for `janus-note-vs`).

## Impact
- New VS Code extension project structure with TypeScript, VS Code API (`@types/vscode`), and webview bundle pipelines.
- Contributes extension points to `package.json`: `chatParticipants`, `languageModelTools`, `customEditors`, and `commands`.
- Relies on VS Code 1.90+ Language Model APIs (`vscode.lm`, `vscode.chat`).
