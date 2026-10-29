# Spec Delta

## ADDED Requirements

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
