# note-graph Specification

## Purpose

Shows all Markdown notes of the Janus notes collection and the links between them as one interactive network graph, so users can see clusters, hubs, and unconnected notes and navigate between them.

## Requirements

### Requirement: Note Graph Panel
The system SHALL provide a webview panel in the editor area that displays a graph of all Markdown notes under the configured `notesRoot` and the folders in `janus.includeFolders`. Only one note graph panel SHALL exist at a time; invoking the command again reveals the existing panel.

#### Scenario: Opening the graph by command
- **WHEN** user runs `Janus: Notiz-Netzwerk öffnen` (`janus.openNoteGraph`)
- **THEN** the system opens a panel titled `Notiz-Netzwerk` showing the graph of all notes

#### Scenario: Opening the graph from the sidebar
- **WHEN** user clicks the `Netzwerk` entry, which is pinned below `Kalender` at the top of the Janus notes sidebar
- **THEN** the system opens or reveals the note graph panel and selects the `Netzwerk` entry in the sidebar

#### Scenario: Sidebar selection follows the panel
- **WHEN** user switches to the note graph panel tab
- **THEN** the `Netzwerk` entry is selected in the Janus notes sidebar

#### Scenario: Revealing an existing panel
- **WHEN** the note graph panel is already open in a background tab and user runs `janus.openNoteGraph`
- **THEN** the existing panel is brought to the front and no second panel is created

#### Scenario: Notes root not initialized
- **WHEN** user runs `janus.openNoteGraph` before a notes root is set up
- **THEN** the system shows a message that the notes root must be set up first and does not open the panel

### Requirement: Graph Contents
The graph SHALL contain one node per Markdown note and one edge per pair of notes connected by at least one resolved wiki-link (`[[...]]`) or Markdown link (`[text](note.md)`). Edges SHALL be directed from the linking note to the linked note; a pair of notes linking to each other SHALL be shown as one bidirectional edge. Links to non-Markdown files, external URLs, and a note's links to itself SHALL NOT produce edges. Links whose target note does not exist SHALL be represented as ghost nodes, which are hidden unless the user enables them.

#### Scenario: Linked notes
- **WHEN** `projects/plan.md` contains `[[architektur]]` twice and `architektur.md` exists
- **THEN** the graph shows one directed edge from `plan` to `architektur`

#### Scenario: Mutual links
- **WHEN** `a.md` links to `b.md` and `b.md` links to `a.md`
- **THEN** the graph shows a single edge between `a` and `b` marked as bidirectional

#### Scenario: Non-note link targets
- **WHEN** a note links to `src/app.ts:42` or `https://example.com`
- **THEN** no node or edge is created for that link

#### Scenario: Unresolved link
- **WHEN** a note contains `[[Noch nicht geschrieben]]` and no matching note exists
- **THEN** a ghost node `Noch nicht geschrieben` with an edge from the linking note exists in the graph data, and it is visible only while `Fehlende Notizen anzeigen` is enabled

#### Scenario: Notes from included folders
- **WHEN** `janus.includeFolders` contains `docs` and `docs/api.md` links to `knowledge/rest.md` in the notes root
- **THEN** both notes appear as nodes connected by an edge

### Requirement: Visual Encoding
Each note node SHALL be sized by its number of distinct linked notes (incoming and outgoing), with a minimum size for notes without links, and colored by the note's top-level folder relative to its root (notes directly in a root share one color). Ghost nodes SHALL be visually distinct (faded or outlined). Edges SHALL be drawn thin and subdued at rest; edge direction SHALL be indicated with small arrow heads on the edges of the hovered node. Node labels (note titles) SHALL be shown once the zoom level is high enough to read them and for the hovered node at any zoom level. Colors SHALL remain legible in both light and dark VS Code themes.

#### Scenario: Hub note
- **WHEN** `index.md` is linked with 10 other notes and `idea.md` with 1
- **THEN** the `index` node is drawn larger than the `idea` node

#### Scenario: Folder colors
- **WHEN** `meetings/kickoff.md` and `meetings/retro.md` and `projects/plan.md` are in the graph
- **THEN** both meeting notes share one color and `plan` has a different color

#### Scenario: Labels at low zoom
- **WHEN** the graph is zoomed out so that nodes are small
- **THEN** labels are hidden except for the hovered node

### Requirement: Graph Interaction
The graph SHALL support zooming, panning, and dragging nodes. Hovering a node SHALL highlight the node, its direct neighbours, and the edges between them, and fade all other nodes and edges. Clicking a note node SHALL open that note in the Janus Markdown Editor. Clicking a ghost node SHALL NOT create or open a file.

#### Scenario: Hover highlights neighbours
- **WHEN** user hovers the `plan` node, which is linked to `architektur` and `kickoff`
- **THEN** `plan`, `architektur`, `kickoff`, and their connecting edges stay fully visible and all other nodes and edges are faded

#### Scenario: Opening a note from the graph
- **WHEN** user clicks the `architektur` node
- **THEN** `architektur.md` opens in the Janus Markdown Editor

#### Scenario: Clicking a ghost node
- **WHEN** user clicks a ghost node
- **THEN** no file is created or opened

### Requirement: Graph Filters
The panel SHALL provide a search field and two toggles. The search field SHALL show only notes whose title or relative path contains the search text (case-insensitive) together with the edges among them. The `Verwaiste Notizen anzeigen` toggle (on by default) SHALL control whether notes without any edges are shown. The `Fehlende Notizen anzeigen` toggle (off by default) SHALL control whether ghost nodes are shown. The panel SHALL show the number of visible notes and links.

#### Scenario: Searching
- **WHEN** user types `launch` into the search field
- **THEN** only notes whose title or path contains `launch` and the edges among them are shown

#### Scenario: Hiding orphans
- **WHEN** user turns off `Verwaiste Notizen anzeigen`
- **THEN** notes without any edges are removed from the view

#### Scenario: Empty result
- **WHEN** the filters leave no note visible
- **THEN** the panel shows a hint that no notes match instead of an empty canvas

### Requirement: Live Graph Updates
While the panel is open, the system SHALL rebuild the graph when a Markdown note under the notes roots is created, changed on disk, deleted, or renamed, and when `janus.notesRoot` or `janus.includeFolders` changes. Bursts of changes SHALL be coalesced into a single rebuild. A rebuild SHALL keep the current zoom, pan, filters, and the positions of nodes that still exist.

#### Scenario: New link appears
- **WHEN** the panel is open and user saves `plan.md` with a new link to `budget.md`
- **THEN** within a few seconds the graph shows an edge from `plan` to `budget` without resetting the view

#### Scenario: Note deleted
- **WHEN** the panel is open and `idea.md` is deleted
- **THEN** the `idea` node and its edges disappear from the graph

#### Scenario: Panel closed
- **WHEN** the note graph panel is closed
- **THEN** the system stops rebuilding the graph on file changes

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

### Requirement: Folder Nodes
The note graph SHALL show each folder that at least one note links to as a folder node, visually distinct from note nodes (shape and icon) and labeled with the folder name. Each linking note SHALL have an edge to the folder node. Folders that no note links to SHALL NOT appear. Clicking a folder node SHALL open the Folder Overview for that folder, and the graph search SHALL also match folder names and paths. The graph SHALL NOT draw edges from a folder to the notes it contains.

#### Scenario: Linked folder in the graph
- **WHEN** `project-plan.md` and `kickoff.md` link to `projects/App-Launch/`
- **THEN** the graph shows a folder node `App-Launch` with edges from `project-plan` and `kickoff`

#### Scenario: Unlinked folders stay hidden
- **WHEN** no note links to `knowledge/`
- **THEN** the graph shows no folder node for `knowledge`

#### Scenario: Opening a folder from the graph
- **WHEN** the user clicks the folder node `App-Launch`
- **THEN** the Folder Overview for `projects/App-Launch` opens

#### Scenario: Searching folders
- **WHEN** the user searches `App-Launch` in the graph
- **THEN** the folder node `App-Launch` is among the matches

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
