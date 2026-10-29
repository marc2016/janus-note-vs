# Spec Delta

## ADDED Requirements

### Requirement: Frontmatter Titles as Node Labels
A note node's label SHALL be the note's frontmatter `title` when it has one, and its file name without extension otherwise. The graph's search field SHALL match the frontmatter title and aliases in addition to the file name and relative path. Wiki-links that resolve via an alias SHALL produce edges like any other resolved link.

#### Scenario: Label from frontmatter title
- **WHEN** `2026-10-29-sync.md` has `title: Wöchentlicher Sync`
- **THEN** its node is labeled `Wöchentlicher Sync`

#### Scenario: Searching by alias
- **WHEN** `rest-schnittstelle.md` has `aliases: [API]` and the user types `api` into the graph's search field
- **THEN** the `rest-schnittstelle` node is shown

#### Scenario: Edge via alias
- **WHEN** `rest-schnittstelle.md` has `aliases: [API]` and `plan.md` contains `[[API]]`
- **THEN** the graph shows an edge from `plan` to `rest-schnittstelle` and no ghost node `API`
