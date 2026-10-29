# Spec Delta

## ADDED Requirements

### Requirement: Frontmatter Title and Aliases in Search
Note search results SHALL use a note's frontmatter `title` as the result title when it has one, falling back to its first `#` heading and then its file name. The frontmatter title and aliases SHALL be scored like the note title when ranking matches.

#### Scenario: Result title from frontmatter
- **WHEN** `2026-10-29-sync.md` has `title: Wöchentlicher Sync` and a first heading `# Sync`, and it matches a search
- **THEN** the result is titled `Wöchentlicher Sync`

#### Scenario: Finding a note by alias
- **WHEN** `rest-schnittstelle.md` has `aliases: [API]`, the word `API` appears nowhere else in it, and the user searches for `API`
- **THEN** `rest-schnittstelle.md` is returned with the weight of a title match
