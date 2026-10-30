# Spec Delta

## ADDED Requirements

### Requirement: Local Graph Mode
The graph panel SHALL provide a mode switch with the options `Ganzes Netzwerk` (default) and `Aktuelle Notiz`, and, while `Aktuelle Notiz` is selected, a `Tiefe` selector with the values 1, 2 and 3 (default 1). In `Aktuelle Notiz` mode, the graph SHALL show only the centre note and the notes reachable from it in at most `Tiefe` steps along edges in either direction, together with the edges among the shown nodes. The centre note SHALL always be shown and SHALL be visually emphasized. The search field and `Fehlende Notizen anzeigen` SHALL further filter the shown nodes, except that the centre note SHALL stay visible. `Verwaiste Notizen anzeigen` SHALL have no effect in this mode. The panel SHALL remember the selected mode and depth when it is hidden and shown again.

#### Scenario: Direct neighbours
- **WHEN** `plan` links to `architektur`, `kickoff` links to `plan`, `architektur` links to `api`, the centre is `plan`, and `Tiefe` is 1
- **THEN** the graph shows `plan`, `architektur` and `kickoff` and the edges among them, and not `api`

#### Scenario: Two steps
- **WHEN** the same notes exist and the user selects `Tiefe` 2
- **THEN** the graph also shows `api` and the edge from `architektur` to `api`

#### Scenario: Centre note without links
- **WHEN** the centre note has no edges
- **THEN** the graph shows only the centre note, emphasized

#### Scenario: Search keeps the centre
- **WHEN** the centre is `plan`, its neighbours are `architektur` and `kickoff`, and the user types `kick` into the search field
- **THEN** the graph shows `plan` and `kickoff` and the edge between them

#### Scenario: Ghost neighbours
- **WHEN** the centre note links to a missing note and `Fehlende Notizen anzeigen` is off
- **THEN** the ghost node is not shown, and turning the toggle on shows it

#### Scenario: Switching back to the whole graph
- **WHEN** the user selects `Ganzes Netzwerk`
- **THEN** the graph shows all notes again, subject to the existing filters

### Requirement: Local Graph Centre Tracking
In `Aktuelle Notiz` mode, the centre SHALL be the Markdown note under `janus.notesRoot` or `janus.includeFolders` that was most recently active in an editor (the Janus Markdown Editor or a text editor). When the user activates an editor with another such note, the graph SHALL re-centre on it. Activating the graph panel, another webview, or a file outside the notes collection SHALL NOT change the centre. If no note has been active yet, the panel SHALL show the hint `Öffne eine Notiz, um ihre Umgebung zu sehen.` instead of a graph. Clicking a note node in local mode SHALL open that note, which then becomes the centre.

#### Scenario: Following the editor
- **WHEN** local mode is active with centre `plan`, and the user switches to the editor tab of `kickoff.md`
- **THEN** the graph re-centres on `kickoff`

#### Scenario: Focusing the graph panel
- **WHEN** local mode is active with centre `plan`, and the user clicks into the graph panel
- **THEN** the centre stays `plan`

#### Scenario: File outside the notes collection
- **WHEN** local mode is active with centre `plan`, and the user opens `src/extension.ts`
- **THEN** the centre stays `plan`

#### Scenario: No active note
- **WHEN** the user switches to `Aktuelle Notiz` and no note has been open in an editor since the panel opened
- **THEN** the panel shows `Öffne eine Notiz, um ihre Umgebung zu sehen.`

#### Scenario: Navigating through the local graph
- **WHEN** local mode is active with centre `plan`, and the user clicks the `architektur` node
- **THEN** `architektur.md` opens in the Janus Markdown Editor and the graph re-centres on `architektur`

### Requirement: Open Local Graph Command
The system SHALL provide the command `janus.openLocalNoteGraph` (title `Janus: Lokales Notiz-Netzwerk öffnen`), available in the command palette and in the editor title bar overflow menu of Markdown notes. It SHALL open the graph panel beside the active editor, or reveal the existing panel, switch it to `Aktuelle Notiz` mode, and centre it on the active note. The same notes-root check as for `janus.openNoteGraph` SHALL apply.

#### Scenario: Opening from a note
- **WHEN** `plan.md` is open in the Janus Markdown Editor and the user runs `Janus: Lokales Notiz-Netzwerk öffnen`
- **THEN** the graph panel opens beside the editor in `Aktuelle Notiz` mode centred on `plan`

#### Scenario: Existing panel in whole-graph mode
- **WHEN** the graph panel is open in `Ganzes Netzwerk` mode and the user runs the command from `kickoff.md`
- **THEN** the existing panel is revealed, switches to `Aktuelle Notiz` mode, and centres on `kickoff`, and no second panel is created
