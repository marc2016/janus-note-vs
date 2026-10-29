# Spec Delta

## ADDED Requirements

### Requirement: AI Diagram Slash Command
The slash command menu of the Janus Markdown Editor SHALL offer `/ki-diagramm` with the description `Diagramm mit KI erstellen`. Choosing it SHALL replace the typed command with a placeholder Mermaid block on its own lines (`graph TD` with a single node `Neues Diagramm`), which is valid Mermaid and is rendered like any other diagram, and SHALL then open the Janus chat with this block as diagram context, as the `KI` button does. The existing `/chart` command SHALL stay unchanged.

#### Scenario: Inserting a diagram with AI
- **WHEN** the cursor is in an empty line 20 of `plan.md` and the user chooses `/ki-diagramm`
- **THEN** a Mermaid block with the node `Neues Diagramm` is inserted starting at line 20, and the Janus chat opens with the chip `Neues Diagramm · plan.md, Zeile 20`

#### Scenario: Command typed inside a line
- **WHEN** the user types `/ki-diagramm` after other text on a line and chooses it
- **THEN** the placeholder block starts on the next line, and the text before the command stays unchanged

#### Scenario: Not applying a proposal
- **WHEN** the user closes the chip without applying a proposal
- **THEN** the placeholder block stays in the note and can be removed with `Cmd+Z`
