# Proposal

## Why

Writing free-form Markdown notes (such as meeting notes, brainstorms, or architecture sketches) frequently produces implicit action items that must otherwise be copied manually into the folder's `tasks.json`. Providing a one-click AI task generation button directly in the note's footer bar—backed by a flexible multi-provider AI configuration supporting VS Code LM (GitHub Copilot / VS Code Chat models), local Ollama models, and direct cloud APIs (OpenAI, Anthropic, Google Gemini, OpenAI-compatible endpoints)—lets users turn note content into structured folder tasks immediately regardless of which AI setup they use in VS Code.

## What Changes

- **AI Task Generation Button & Active Model Selector in Footer Bar**:
  - Add an interactive **`Aufgaben generieren`** button (with inline loading state) to `NotesLinksFooter` in the Markdown editor.
  - Add an interactive **AI Model Badge / Selector (`KI: <Active Model>`)** next to the button in the footer bar that displays the currently configured AI model and opens a VS Code QuickPick to switch models or configure providers/API keys.
- **Multi-Provider AI Model Service (`AiModelService`)**:
  - Support **VS Code Language Model API (`vscode.lm`)**: automatically discovers all models registered in VS Code (GitHub Copilot models such as GPT-4o, Claude 3.5/3.7 Sonnet, o3-mini, Gemini, and VS Code BYOK models).
  - Support **Local Ollama**: auto-discovers installed local models via `http://localhost:11434/api/tags` (configurable endpoint) and executes chat completions locally.
  - Support **Direct Cloud APIs (OpenAI, Anthropic, Google Gemini, Custom OpenAI-Compatible)**: stores API keys securely in VS Code `SecretStorage` (`context.secrets`) and allows selecting provider models without requiring GitHub Copilot.
- **Context-Aware Task Extraction into `<folder>/tasks.json`**:
  - Reads the active Markdown note content along with existing tasks in the containing folder's `tasks.json`.
  - Instructs the selected AI model to extract new actionable tasks (`title`, `priority: 'low' | 'medium' | 'high'`, `status: 'todo'`) while avoiding duplicates of existing tasks in that folder.
  - Appends newly extracted tasks to `<folder>/tasks.json`, refreshes the footer companion badge and sidebar tree, and notifies the user.
- **Folder-Aligned Agent Tools**:
  - Align `janus_mutate_tasks` and `janus_read_note_and_companions` with folder-level `tasks.json` files.

## Capabilities

### New Capabilities
- `ai-task-generation`: Multi-provider AI model discovery, selection, secure credential storage, and duplicate-aware extraction of structured tasks from Markdown notes into `<folder>/tasks.json`.

### Modified Capabilities
- `markdown-editor`: Add AI task generation action button, loading state, and active AI model selector badge to the Markdown editor's bottom footer bar (`NotesLinksFooter`).
- `agent-tools`: Update `janus_read_note_and_companions` and `janus_mutate_tasks` to resolve and mutate the containing folder's `tasks.json`.

## Impact

- **UI / Webviews**: `src/webviews/markdown/components/NotesLinksFooter.tsx`, `src/webviews/markdown/MarkdownEditorApp.tsx`
- **Editor & Commands**: `src/editors/markdownEditorProvider.ts`, `src/extension.ts`, `package.json` (configuration settings & commands for selecting/configuring AI models and generating tasks)
- **Services & Agent**: New `src/services/aiModelService.ts` and `src/services/aiTaskGeneratorService.ts`; updates to `src/agent/tools/mutateTasksTool.ts` and `src/agent/tools/readNoteTool.ts`
- **Tests**: Unit tests for `AiModelService`, `AiTaskGeneratorService`, and footer message handling

