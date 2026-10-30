# Spec Delta

## ADDED Requirements

### Requirement: Correct Navigation Around Resizing Widgets
When an inline image, a Mermaid diagram or its error message changes its size after it was first displayed (for example when an image finishes loading, a diagram finishes rendering, the theme changes or the editor width changes), the Janus Markdown Editor SHALL update its layout so that clicking a line places the cursor in that line and the arrow keys move the cursor to the visually adjacent line, everywhere in the note.

#### Scenario: Clicking below an image after it loaded
- **WHEN** a note shows an image that loads after the note was opened, and the user clicks a line below the image
- **THEN** the cursor is placed in the clicked line

#### Scenario: Arrow keys below a diagram
- **WHEN** a Mermaid diagram above the cursor finished rendering and the user presses `ArrowUp` repeatedly
- **THEN** the cursor moves one line up per key press and reaches the lines above the diagram, not the top of the note

#### Scenario: Width change
- **WHEN** the editor becomes narrower so that an image or diagram is scaled down
- **THEN** clicking lines below it still places the cursor in the clicked line
