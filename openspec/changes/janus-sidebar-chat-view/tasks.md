# Tasks

## 1. Extension Manifest & Build Setup

- [ ] 1.1 Register `janus.chatView` (`"type": "webview"`, `"name": "KI & Suche"`) under `contributes.views.janus-notes` and `janus.focusChatView` command in `package.json`, and add `chat: 'src/webviews/chat/index.tsx'` to `esbuild.js`, verifying manifest structure

## 2. Backend `ChatViewProvider` (`src/editors/chatViewProvider.ts`)

- [ ] 2.1 Implement `ChatViewProvider` (`vscode.WebviewViewProvider`) in `src/editors/chatViewProvider.ts` with active AI model state updates, `/search`, `/tasks`, `/summarize`, `/inbox`, and `/help` slash command handling, RAG-augmented free-form Q&A via `JanusSearchService` and `AiModelService`, and action execution (`openNote` in `janus.markdownEditor`, `openAllTasks`, `openFolderTasks`, `generateTasksFromNote`, `sortInbox`, `openSettings`), verifying with unit tests in `tests/chatViewProvider.test.ts`

## 3. Frontend Sidebar Chat React Webview (`src/webviews/chat/`)

- [ ] 3.1 Create `src/webviews/chat/JanusChatApp.tsx` and `src/webviews/chat/index.tsx` featuring the active model badge header (clicking opens Janus Settings), clear-chat button, quick-command chips (`/search`, `/tasks`, `/summarize`, `/inbox`, `/help`), chat message list, clickable source note cards, action buttons, and prompt input
- [ ] 3.2 Register `ChatViewProvider` (`vscode.window.registerWebviewViewProvider`) and `janus.focusChatView` in `src/extension.ts`, and verify with `npm test` and `npm run build`

