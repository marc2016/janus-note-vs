# Spec Delta

## MODIFIED Requirements

### Requirement: Wiki-Link and Markdown Link Parsing
The system SHALL parse outgoing references from Markdown document text, recognizing wiki-style links (`[[Note Name]]`, `[[note.md]]`, `[[note#L42]]`, `[[note:42]]`) and standard Markdown links (`[Title](target.md)` or `[Title](target.ts:42)`), preserving optional line number targets specified via colon suffix (`:line`) or hash anchor (`#Lline`).

#### Scenario: Parsing wiki-links in note text
- **WHEN** a note containing `[[Meeting-Notes]]` and `[Design](specs/design.md)` is opened or modified
- **THEN** system extracts both references as outgoing links associated with the source note

#### Scenario: Parsing link with line target
- **WHEN** a note contains `[[src/auth/login.ts:42]]` or `[Login](src/auth/login.ts#L42)`
- **THEN** the system extracts the target path (`src/auth/login.ts`) and identifies target line `42`

### Requirement: Bi-directional Backlink Indexing
The system SHALL identify all notes across the active `notesRoot` and all directories configured in `janus.includeFolders` that reference the current note, record the 1-based source line number where each reference occurs, and expose them as backlinks.

#### Scenario: Discovering backlinks to active note
- **WHEN** Note B contains a link to Note A (`[[Note A]]`) and user opens Note A
- **THEN** system identifies Note B as an incoming backlink for Note A

#### Scenario: Backlink discovery from linked folder to vault note
- **WHEN** a note in a linked folder (e.g. `docs/api.md`) contains a link `[[Meeting-Notes]]` to a note in the vault
- **THEN** opening `Meeting-Notes.md` lists `docs/api.md` as an incoming backlink

#### Scenario: Backlink discovery between two linked folders
- **WHEN** a note in `docs/` references a note in `specs/`
- **THEN** the system exposes the cross-folder reference in the backlinks list

#### Scenario: Recording origin line number of backlink
- **WHEN** Note B references Note A on line 15 (`15: Referenz zu [[Note A]]`)
- **THEN** the backlink entry for Note B includes line number `15` as its origin location

