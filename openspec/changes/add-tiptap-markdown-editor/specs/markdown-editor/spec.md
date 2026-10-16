# Spec Delta: Markdown Editor

## Purpose

Provides a visual WYSIWYG editing environment for Markdown notes using TipTap and a fixed toolbar, ensuring all content is transparently persisted as standard CommonMark / GitHub Flavored Markdown.

## ADDED Requirements

### Requirement: Visual Markdown Editing
The system SHALL provide a Custom Text Editor (`janus.markdownEditor`) for `*.md` files that renders standard Markdown in a rich, content-editable visual view powered by TipTap and `tiptap-markdown`.

#### Scenario: Opening a Markdown note in the visual editor
- **WHEN** user opens a `*.md` document with `janus.markdownEditor`
- **THEN** the editor renders headings, lists, inline formatting, code blocks, and blockquotes visually without displaying raw markdown symbols

#### Scenario: Preserving raw markdown on disk
- **WHEN** content is edited in the visual editor
- **THEN** changes are serialized to disk as clean GitHub Flavored Markdown (GFM) without proprietary tags or HTML wrapping

### Requirement: Fixed Formatting Toolbar
The system SHALL display a pinned, fixed formatting toolbar at the top of the editor view featuring controls for headings, inline marks, lists, block elements, and history.

#### Scenario: Applying text formatting via toolbar
- **WHEN** user selects text and clicks a formatting button (e.g. Bold, Italic, Heading 2)
- **THEN** the selected text is formatted accordingly and the button reflects the active state

#### Scenario: Task list item insertion and toggle
- **WHEN** user clicks the task list button or checks/unchecks an interactive task checkbox
- **THEN** the item toggles visual checkbox state and updates the underlying markdown as `- [ ]` or `- [x]`

### Requirement: Bidirectional Real-time Synchronization
The system SHALL synchronize document changes bidirectionally between the visual editor and the underlying VS Code TextDocument in real time.

#### Scenario: External file edit synchronization
- **WHEN** the underlying markdown file is edited externally or in a side-by-side split editor
- **THEN** the visual TipTap editor updates its content to match without disrupting the user's cursor position unnecessarily

#### Scenario: Visual editor typing persistence
- **WHEN** user types or edits content within the visual editor
- **THEN** the editor updates the VS Code TextDocument via a WorkspaceEdit within a debounced interval

### Requirement: Split View Code Navigation
The system SHALL provide an action in the editor header to open the raw source document in a split editor beside the visual view.

#### Scenario: Opening source code beside
- **WHEN** user clicks "Quelltext bearbeiten" in the header
- **THEN** VS Code opens the markdown note in a secondary text editor column (`ViewColumn.Beside`)

### Requirement: CodeLens Note Shortcut
The system SHALL display a CodeLens shortcut at the top of markdown documents allowing fast access to the visual editor.

#### Scenario: Clicking CodeLens shortcut
- **WHEN** user clicks the `$(edit) Rich Editor` CodeLens at the top of a `.md` note
- **THEN** VS Code reopens or displays the document in `janus.markdownEditor`
