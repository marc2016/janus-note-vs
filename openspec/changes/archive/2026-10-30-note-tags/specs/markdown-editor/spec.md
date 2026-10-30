# Spec Delta

## ADDED Requirements

### Requirement: Tag Highlighting
The Markdown editor's live preview SHALL display every inline tag (as defined in `note-tags`) with a distinct, subtle tag style that is legible in light and dark themes. The highlighting SHALL NOT change the document text, and text that is not a tag (headings, code, links, frontmatter) SHALL NOT be highlighted.

#### Scenario: Highlighting a tag
- **WHEN** a note contains `Thema #backend` and is open in the Janus Markdown Editor
- **THEN** `#backend` is displayed with the tag style and the document text is unchanged

#### Scenario: No highlighting in code or headings
- **WHEN** a note contains `# Überschrift` and `` `#backend` ``
- **THEN** neither is displayed with the tag style

### Requirement: Tag Suggestions While Typing
As soon as the user types `#` at the start of a line or after whitespace in the Janus Markdown Editor, the editor SHALL show a suggestion list of the existing tags of the notes collection that match the tag characters typed after it, each with its number of notes, more frequently used tags first among equally good matches. Choosing a suggestion SHALL replace the typed text with `#` and the tag. A following space or second `#` (heading) SHALL close the list. No suggestions SHALL be shown for a `#` inside a word, inside code, or inside the frontmatter block.

#### Scenario: Suggesting tags
- **WHEN** the collection has the tags `backend` (3 notes) and `budget` (1 note) and the user types `#b`
- **THEN** the suggestion list shows `#backend` with `3 Notizen` before `#budget` with `1 Notiz`

#### Scenario: Suggestions right after `#`
- **WHEN** the user types a lone `#` after a space
- **THEN** the suggestion list shows all existing tags, most used first

#### Scenario: No suggestions for headings and code
- **WHEN** the user types `# ` or `##` at the start of a line, or `#b` inside an inline code span
- **THEN** no tag suggestions are shown

