# Spec Delta

## ADDED Requirements

### Requirement: Tag Filter and Scoring in Search
A search query word starting with `#` SHALL be treated as a tag filter: only notes that carry that tag (as defined in `note-tags`) SHALL be returned, and the word SHALL NOT be scored as a keyword. Several tag filters SHALL all have to match. When a query consists only of tag filters, all matching notes SHALL be returned, ordered by title. Other query words that equal one of a note's tags SHALL add the same weight as a heading match. Task search is not affected by tag filters.

#### Scenario: Restricting search to a tag
- **WHEN** `plan.md` contains `#backend` and the word `Deployment`, `retro.md` contains `Deployment` but no tag, and the user searches for `#backend Deployment`
- **THEN** only `plan.md` is returned

#### Scenario: Tag-only query
- **WHEN** the user searches for `#backend` and three notes carry `backend`
- **THEN** exactly those three notes are returned, ordered by title

#### Scenario: Keyword matching a tag
- **WHEN** `plan.md` has the tag `budget` without the word `budget` in its text, and the user searches for `budget`
- **THEN** `plan.md` is returned with the weight of a heading match

#### Scenario: Search from the chat
- **WHEN** the user sends `/search #backend` in the Janus Sidebar Chat
- **THEN** the source cards show only notes that carry `backend`
