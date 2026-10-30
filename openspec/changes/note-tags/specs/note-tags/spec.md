# Spec Delta

## Purpose

Lets users group notes across folders by topic with inline `#tags` and frontmatter tags, and gives other Janus features a shared definition of which notes carry which tags.

## ADDED Requirements

### Requirement: Inline Tag Recognition
The system SHALL recognize an inline tag as `#` followed by one or more letters (of any language), digits, `_`, `-` or `/`, containing at least one letter, where the `#` is at the start of a line or follows a whitespace character. A trailing `/` or `-` SHALL NOT be part of the tag. The system SHALL NOT recognize tags inside fenced code blocks, inline code spans, wiki-links, Markdown links, or a note's frontmatter block. A Markdown heading marker (`#` followed by a space) is not a tag.

#### Scenario: Tags in text
- **WHEN** a note contains `Besprechung zu #backend und #projekt/alpha.`
- **THEN** the note's inline tags are `backend` and `projekt/alpha`

#### Scenario: Non-tags
- **WHEN** a note contains `# Überschrift`, `Issue #42`, `[Abschnitt](plan.md#ziele)`, `[[plan#L3]]`, `https://example.com/#anker`, `Farbe&#35;` and `` `#code` ``
- **THEN** the note has no inline tags

#### Scenario: Tags in code blocks and frontmatter
- **WHEN** a note has a frontmatter block containing `# Kommentar #intern` and a fenced code block containing `#backend`
- **THEN** neither `intern` nor `backend` is an inline tag of the note

#### Scenario: Umlauts and trailing punctuation
- **WHEN** a note contains `#Übergabe, #ideen-` and `#2026-planung`
- **THEN** the note's inline tags are `Übergabe`, `ideen` and `2026-planung`

### Requirement: Note Tag Set
A note's tags SHALL be the union of its inline tags and the tags from its frontmatter `tags` key. Tags SHALL be compared case-insensitively. For display, the system SHALL use the spelling that occurs most often across the collection, and the alphabetically first spelling on a tie. A note carries a tag `t` if it has `t` itself or any tag starting with `t/`.

#### Scenario: Frontmatter and inline tags combined
- **WHEN** a note has `tags: [backend]` in its frontmatter and `#Budget` in its text
- **THEN** the note carries the tags `backend` and `Budget`

#### Scenario: Case-insensitive tags
- **WHEN** one note contains `#Backend` and two notes contain `#backend`
- **THEN** all three notes carry the same tag, displayed as `backend`

#### Scenario: Parent tags
- **WHEN** a note contains `#projekt/alpha` and no other tag
- **THEN** the note carries `projekt/alpha` and also counts as carrying `projekt`
