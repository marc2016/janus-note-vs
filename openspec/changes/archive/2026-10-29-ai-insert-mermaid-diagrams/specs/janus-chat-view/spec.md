# Spec Delta

## MODIFIED Requirements

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

