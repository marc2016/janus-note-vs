# janus-chat-view Specification

## Purpose
Provides a dedicated, provider-independent AI Chat and Workspace Search WebviewView (`janus.chatView`) inside the Janus Activity Bar sidebar, allowing users to search notes, ask questions, manage tasks, summarize notes/folders, and sort the inbox using any configured Janus AI model (`AiModelService`).

## Requirements

### Requirement: Provider-Independent Sidebar Chat WebviewView
The system SHALL register a WebviewView (`janus.chatView`) inside the Janus Activity Bar sidebar that processes user messages and slash commands using the active AI provider configured in `AiModelService` (VS Code LM, Ollama, OpenAI, Anthropic, Gemini, or Custom) and displays the currently active model in the view header with a shortcut to open Janus Settings (`janus.openSettings`).

#### Scenario: Sending a question in the Janus Sidebar Chat
- **WHEN** the user types a question into the Janus Sidebar Chat and submits it
- **THEN** the view retrieves relevant workspace context via `JanusSearchService`, calls `AiModelService.completePrompt`, and renders the AI response along with clickable source note cards

#### Scenario: Displaying active AI model and opening settings
- **WHEN** the Janus Sidebar Chat view is rendered or the active AI model changes
- **THEN** the header displays the active model label (e.g. `Ollama: llama3.3` or `Gemini: gemini-2.5-flash`) and clicking the model badge opens the Janus Settings Panel (`janus.openSettings`)

### Requirement: Slash Commands and Quick-Action Chips in Sidebar Chat
The system SHALL support `/search`, `/tasks`, `/summarize`, `/inbox`, and `/help` slash commands in the Janus Sidebar Chat both via text input and via one-click quick-command chips above the input box.

#### Scenario: Executing slash commands in Sidebar Chat
- **WHEN** the user clicks a quick-command chip or submits `/search <query>`, `/tasks`, `/summarize [target]`, `/inbox`, or `/help`
- **THEN** the Sidebar Chat executes the corresponding workflow using `JanusSearchService` and `FolderTasksService` and displays the formatted response and contextual action buttons

### Requirement: Interactive Source Note Cards Opening Janus WYSIWYG Editor
The system SHALL render matched workspace notes below search and Q&A responses as clickable source cards displaying the note title, relative path, and snippet preview, opening the note directly in `janus.markdownEditor` when clicked.

#### Scenario: Clicking a source note card in Sidebar Chat
- **WHEN** a search or Q&A response includes matched notes and the user clicks a source note card
- **THEN** the system opens the selected Markdown note directly in the Janus Rich Markdown Editor (`janus.markdownEditor`)

### Requirement: Diagram Change Requests in the Chat
When the user opens the chat from a diagram's `KI` button or the `/ki-diagramm` command, the Janus chat SHALL show a context chip `Diagramm · <note file name>, Zeile <n>` above the input (`Neues Diagramm · …` while the diagram is still the placeholder), with a button to remove it. While the chip is shown, every message that is not a slash command SHALL be sent to the active AI model as a request for that diagram, together with the diagram's current code read from the note at that moment and the note section around it: from the nearest heading above the diagram to the next heading of the same or a higher level, without the diagram itself, limited to a fixed length. For the placeholder, the request SHALL ask the model to create a fitting diagram instead of changing the placeholder. The assistant answer SHALL show a short explanation and the complete new Mermaid code, followed by the actions `Übernehmen` and `Code kopieren`. `Übernehmen` SHALL ask the editor to replace the diagram with that code, opening the note first if it is not open, and SHALL add a short confirmation or the reason why nothing was changed to the chat. `Code kopieren` SHALL copy the code to the clipboard. After a successful `Übernehmen`, later requests SHALL start from the new code. An answer without Mermaid code SHALL be shown without these actions. When the diagram can no longer be found in the note, the chat SHALL say so instead of calling the AI model. Removing the chip SHALL return the chat to its normal behavior.

#### Scenario: Requesting a change
- **WHEN** the chip for the diagram in `project-plan.md` is shown and the user sends `Füge nach Notizen einen Schritt Kalender hinzu`
- **THEN** the AI model receives the diagram's current code and the request, and the answer shows the new Mermaid code with the actions `Übernehmen` and `Code kopieren`

#### Scenario: Refining over several messages
- **WHEN** the user applied a proposal and then sends `Und jetzt von oben nach unten`
- **THEN** the AI model receives the applied code as the current code

#### Scenario: Reporting the result
- **WHEN** the user clicks `Übernehmen` and the editor replaced the diagram
- **THEN** the chat shows `Diagramm übernommen.`; when the editor refused, the chat shows the reason instead

#### Scenario: Answer without code
- **WHEN** the AI model answers with a question instead of Mermaid code
- **THEN** the answer is shown without `Übernehmen` and `Code kopieren`

#### Scenario: Diagram removed from the note
- **WHEN** the chip is shown, the user deleted the diagram from the note and sends a request
- **THEN** the chat says the diagram can no longer be found and does not call the AI model

#### Scenario: Removing the context
- **WHEN** the user removes the chip and sends a question
- **THEN** the question is answered as a normal chat message without diagram context

#### Scenario: Note section as context
- **WHEN** the diagram is under `## Inbox-Workflow` with the text `Gedanken landen in der Inbox und werden einsortiert`, followed by `## Tagesnotizen`
- **THEN** the AI model receives the `## Inbox-Workflow` section text without the diagram and without the `## Tagesnotizen` section

#### Scenario: Creating a new diagram
- **WHEN** the chip shows `Neues Diagramm` and the user sends `Mach daraus ein Ablaufdiagramm`
- **THEN** the AI model is asked to create a diagram from the request and the note section, and after `Übernehmen` the chip reads `Diagramm · …`

### Requirement: Selected Text in the Chat
When the user chooses `Zusammenfassen` for a selection in the editor, the Janus chat SHALL open with the context chip `Auswahl · <note file name>, Zeilen <a>–<b>` (with a button to remove it) and SHALL immediately send the selected text to the active AI model with a request for a short summary in German, without the user typing a message. While this chip is shown, every message that is not a slash command SHALL be sent as a request about the same selected text, together with the previous summary. Each answer SHALL be followed by the actions `Darunter einfügen` and `Kopieren`. `Darunter einfügen` SHALL ask the editor to insert the answer after the selected text as a `> [!NOTE]` callout starting with `**Zusammenfassung:**`, and SHALL add `Zusammenfassung eingefügt.` or the reason why nothing was inserted to the chat. `Kopieren` SHALL copy the answer to the clipboard. When the user chooses `Diagramm erstellen` for a selection, the chat SHALL immediately, without the user typing a message, request a diagram made from the selected text, and every diagram request for it SHALL send the selected text instead of the note section around the diagram.

#### Scenario: Summarizing a selection
- **WHEN** the user selects lines 12 to 15 of `plan.md` and clicks `Zusammenfassen`
- **THEN** the chat shows the chip `Auswahl · plan.md, Zeilen 12–15` and, without further input, an answer with a summary and the actions `Darunter einfügen` and `Kopieren`

#### Scenario: Refining the summary
- **WHEN** the summary is shown and the user sends `Als Stichpunkte`
- **THEN** the AI model receives the selected text, the previous summary and the request, and the new answer again has both actions

#### Scenario: Inserting and reporting
- **WHEN** the user clicks `Darunter einfügen` and the editor inserted the summary
- **THEN** the chat shows `Zusammenfassung eingefügt.`; when the editor refused, the chat shows the reason instead

#### Scenario: Diagram from a selection
- **WHEN** the user chooses `Diagramm erstellen` for a selected paragraph
- **THEN** without further input the AI model receives the selected paragraph instead of the note section, and the answer shows a diagram of its content with `Übernehmen` and `Code kopieren`

#### Scenario: Refining a diagram from a selection
- **WHEN** that diagram answer is shown and the user sends `Als Ablauf von oben nach unten`
- **THEN** the AI model again receives the selected paragraph as context
