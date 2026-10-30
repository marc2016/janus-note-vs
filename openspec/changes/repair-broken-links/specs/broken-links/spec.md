# Spec Delta

## Purpose

Lets users find every unresolved note link across the Janus notes collection in one place and repair it by creating the missing note, pointing the references to an existing note, or removing the link.

## ADDED Requirements

### Requirement: Broken Link Discovery
The system SHALL provide the command `janus.repairBrokenLinks` (title `Janus: Defekte Links reparieren`), available in the command palette and in the overflow menu of the Notes view title bar. It SHALL scan all Markdown notes under `janus.notesRoot` and all directories in `janus.includeFolders` for wiki-links and Markdown links to notes that do not resolve to an existing file, using the same resolution as the note footer and the note graph. Links to external URLs, anchor-only links, links whose target has a non-Markdown file extension, and links inside fenced code blocks or inline code spans SHALL NOT be reported.

#### Scenario: Finding broken links
- **WHEN** `plan.md` contains `[[kickof]]` and `[Ideen](ideen.md)`, neither `kickof.md` nor `ideen.md` exists, and the user runs `janus.repairBrokenLinks`
- **THEN** both `kickof` and `ideen` are listed as missing targets

#### Scenario: Ignored links
- **WHEN** a note contains `[Docs](https://example.com)`, `[Oben](#oben)`, `[Diagramm](diagramm.png)` pointing to a missing PNG, and `[[kickof]]` inside a fenced code block
- **THEN** none of these links is listed

#### Scenario: No broken links
- **WHEN** every note link in the collection resolves and the user runs `janus.repairBrokenLinks`
- **THEN** the user is informed that no broken links were found and no list is shown

### Requirement: Grouped Broken Link List
The system SHALL list missing targets in a selectable list with one entry per missing target, grouping references whose target text is equal ignoring case and the `.md` extension. Each entry SHALL show the missing target, the number of references, and the linking notes. Entries SHALL be sorted by number of references, highest first.

#### Scenario: Grouping references to the same target
- **WHEN** `plan.md` contains `[[Roadmap]]` twice and `index.md` contains `[Roadmap](roadmap.md)`, and no `roadmap.md` exists
- **THEN** the list shows one entry `Roadmap` with 3 references from `plan.md` and `index.md`

### Requirement: Repair Actions for a Missing Target
After the user selects a missing target, the system SHALL offer the actions `Notiz anlegen`, `Auf bestehende Notiz umleiten`, `Link entfernen`, and `Verweis öffnen`. Each action except `Verweis öffnen` SHALL apply to all references of that target. Rewrites SHALL change only the affected links, keep each link's type, label or alias, and `#anchor`, `#L42` or `:42` suffix, and SHALL be applied to open documents as document edits without discarding unsaved changes. After an action completes, the system SHALL show the list again with the remaining missing targets, or inform the user when none are left.

#### Scenario: Creating a missing note with a path target
- **WHEN** the missing target is `projects/roadmap` and the user chooses `Notiz anlegen`
- **THEN** `<notesRoot>/projects/roadmap.md` is created with the heading `# roadmap`, it is opened in the Janus Markdown Editor, and no linking note is changed

#### Scenario: Creating a missing note with a name-only target
- **WHEN** the missing target is `Roadmap` and the user chooses `Notiz anlegen`
- **THEN** the user picks a folder of the notes collection, `Roadmap.md` is created there with the heading `# Roadmap`, it is opened in the Janus Markdown Editor, and all references to `Roadmap` resolve to it

#### Scenario: Retargeting to an existing note
- **WHEN** the missing target is `kickof`, the user chooses `Auf bestehende Notiz umleiten`, and picks `meetings/kickoff.md`, which the list shows near the top because its name is similar
- **THEN** `[[kickof]]` becomes a wiki-link and `[Start](kickof.md#agenda)` becomes a Markdown link that resolve to `meetings/kickoff.md`, with the label `Start` and the suffix `#agenda` kept

#### Scenario: Removing a link
- **WHEN** the missing target is `ideen`, references are `[[ideen]]`, `[[ideen|Ideensammlung]]` and `[Ideen-Liste](ideen.md)`, and the user chooses `Link entfernen`
- **THEN** they are replaced by the plain texts `ideen`, `Ideensammlung` and `Ideen-Liste`

#### Scenario: Opening a reference
- **WHEN** the user chooses `Verweis öffnen` and picks the reference in `plan.md`, line 12
- **THEN** `plan.md` opens in the Janus Markdown Editor with line 12 highlighted, and no file is changed

#### Scenario: Unsaved changes in a linking note
- **WHEN** a note that references the selected target is open with unsaved changes and the user chooses `Link entfernen`
- **THEN** the references in the open document are replaced and the user's unsaved changes are kept

#### Scenario: Continuing with the remaining targets
- **WHEN** the list shows three missing targets and the user repairs one of them
- **THEN** the list is shown again with the two remaining targets
