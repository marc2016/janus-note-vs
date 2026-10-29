# Spec Delta

## ADDED Requirements

### Requirement: Alias Link Resolution
A wiki-link (`[[...]]`) whose target does not resolve to a note by path or by file name SHALL resolve to the note whose frontmatter lists the target as an alias, compared case-insensitively and ignoring any `#anchor`, `#L42` or `:42` suffix. When several notes list the same alias, the first one in the notes collection's scan order SHALL win. Markdown links (`[text](target.md)`) SHALL NOT resolve via aliases. Alias resolution SHALL apply wherever Janus resolves note links, including the footer's outgoing links, backlinks, the note graph, and clicking a link in the editor.

#### Scenario: Resolving a link via an alias
- **WHEN** `knowledge/rest-schnittstelle.md` has `aliases: [API]` and `plan.md` contains `[[API]]`
- **THEN** the link resolves to `knowledge/rest-schnittstelle.md`: the footer of `plan.md` shows it as an existing link, and clicking it opens that note

#### Scenario: File names win over aliases
- **WHEN** `api.md` exists, `rest-schnittstelle.md` has `aliases: [API]`, and a note contains `[[API]]`
- **THEN** the link resolves to `api.md`

#### Scenario: Alias with a line suffix
- **WHEN** `rest-schnittstelle.md` has `aliases: [API]` and a note contains `[[api#L12]]`
- **THEN** the link resolves to `rest-schnittstelle.md` with line 12 as its target line

#### Scenario: Backlinks via alias
- **WHEN** `rest-schnittstelle.md` has `aliases: [API]`, `plan.md` contains `[[API]]` on line 4, and the user opens `rest-schnittstelle.md`
- **THEN** `plan.md` is listed as a backlink with origin line 4

#### Scenario: Markdown links ignore aliases
- **WHEN** `rest-schnittstelle.md` has `aliases: [API]` and a note contains `[API](API.md)` and no `API.md` exists
- **THEN** the link does not resolve

#### Scenario: Renaming a note keeps alias links
- **WHEN** `rest-schnittstelle.md` has `aliases: [API]`, `plan.md` contains `[[API]]`, and `rest-schnittstelle.md` is renamed to `rest.md` in the Janus sidebar
- **THEN** `plan.md` still contains `[[API]]` and the link resolves to `rest.md`

### Requirement: Titles and Aliases in Link Autocomplete
The inline link autocomplete SHALL also match a note's frontmatter title and aliases against the typed query. A candidate matched via an alias SHALL be shown with the alias and the note's path, and selecting it SHALL insert `[[<alias>]]`. A candidate matched via the title or file name SHALL insert the same link as today.

#### Scenario: Finding a note by alias
- **WHEN** `knowledge/rest-schnittstelle.md` has `aliases: [API]` and the user types `[[AP` in the editor
- **THEN** the autocomplete list contains an entry `API` with the path `knowledge/rest-schnittstelle.md`, and selecting it inserts `[[API]]`

#### Scenario: Finding a note by title
- **WHEN** `2026-10-29-sync.md` has `title: Wöchentlicher Sync` and the user types `[[Wöch`
- **THEN** the autocomplete list contains that note, and selecting it inserts the same link as selecting it by file name
