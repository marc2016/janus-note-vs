# Spec Delta

## ADDED Requirements

### Requirement: Mermaid Diagrams in the Editor
The Janus Markdown Editor SHALL render every fenced code block with the language `mermaid` as a diagram, using colors that match the current VS Code theme (light or dark). Each rendered block SHALL offer a toggle between `Diagramm` and `Code`. In `Diagramm` view, the block's code lines SHALL be hidden and only the diagram SHALL be shown. In `Code` view, the code SHALL be shown and editable, and the diagram SHALL be shown below it as a preview that updates after the code changes; the code and the preview SHALL be shown in one shared frame. Blocks SHALL start in `Diagramm` view, or in `Code` view when syntax visibility is set to always visible. The toggle state SHALL apply to one block and last while the note is open, and SHALL NOT change the document text. When the cursor moves into a block in `Diagramm` view by keyboard or search, the block SHALL switch to `Code` view. When the code contains a syntax error, the editor SHALL show the Mermaid error message below the code instead of a diagram, and the block SHALL be shown in `Code` view. Notes without Mermaid blocks SHALL not load the diagram renderer.

#### Scenario: Diagram instead of code
- **WHEN** a note contains a block ```` ```mermaid ```` with `graph TD; A-->B;` and the user opens it
- **THEN** the editor shows the diagram with the nodes `A` and `B` and a `Code` toggle, and the code lines are not shown

#### Scenario: Editing the diagram code
- **WHEN** the user clicks `Code` and changes `A-->B` to `A-->C`
- **THEN** the code is shown and editable, the preview below it shows the nodes `A` and `C` shortly after typing, and clicking `Diagramm` collapses the code again

#### Scenario: Keyboard navigation into a collapsed block
- **WHEN** a block is in `Diagramm` view and the user moves the cursor into it with the arrow keys
- **THEN** the block switches to `Code` view

#### Scenario: Syntax error
- **WHEN** a Mermaid block contains `graph TD; A-->` 
- **THEN** the editor shows the code with the Mermaid error message below it and no diagram

#### Scenario: Toggle is not saved
- **WHEN** the user switches a block to `Code`, closes the note and opens it again
- **THEN** the block is shown in `Diagramm` view and the file content is unchanged

#### Scenario: Other code blocks
- **WHEN** a note contains a ```` ```js ```` block or a Mermaid example inside a ```` ```md ```` block
- **THEN** these blocks are shown as code and no diagram is rendered
