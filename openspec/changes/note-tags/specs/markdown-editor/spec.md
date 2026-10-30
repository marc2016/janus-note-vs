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
