# Spec Delta

## ADDED Requirements

### Requirement: Tag Filter
The graph panel SHALL provide a tag selector listing `Alle Tags` and every tag of the notes collection, sorted alphabetically. When a tag is selected, the graph SHALL show only notes that carry that tag (as defined in `note-tags`), together with the edges among them. Ghost nodes SHALL be hidden while a tag is selected. The tag filter SHALL combine with the search field and the toggles, and the selection SHALL be kept when the panel is hidden and shown again.

#### Scenario: Filtering by tag
- **WHEN** `plan.md` and `kickoff.md` contain `#backend`, `retro.md` does not, and the user selects `backend`
- **THEN** only `plan` and `kickoff` and the edges between them are shown

#### Scenario: Parent tag selection
- **WHEN** a note contains `#projekt/alpha` and the user selects `projekt`
- **THEN** that note is shown

#### Scenario: Combining with search
- **WHEN** the user selects `backend` and types `plan` into the search field
- **THEN** only notes that carry `backend` and whose title or path contains `plan` are shown

#### Scenario: Resetting the filter
- **WHEN** the user selects `Alle Tags`
- **THEN** the graph shows all notes again, subject to the other filters
