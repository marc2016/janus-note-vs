# Design

## Context

- "Broken" is already defined in two places that agree: `resolveOutgoingLink` returns `exists: false`, and `buildNoteGraph` turns such links into ghost nodes unless the target has a non-Markdown extension ([src/services/noteGraphService.ts](../../../src/services/noteGraphService.ts)). The ghost id is the target without extension, lower-cased, which is also the grouping key this change needs.
- Clicking a missing link in the editor already offers `Erstellen` and creates the note at the resolver's fallback location, next to the linking note ([src/editors/markdownEditorProvider.ts](../../../src/editors/markdownEditorProvider.ts), link click handler).
- Opening a note at a line already exists: `MarkdownEditorProvider.setPendingLineReveal` plus a `revealLine` message to an open panel, followed by `vscode.openWith`.
- `update-links-on-rename` introduces `findLinkOccurrences` (positions, code skipping), the target rewrite helper, and the "WorkspaceEdit, then save documents that were not dirty" apply step. This change builds on all three.

## Goals / Non-Goals

**Goals:**
- One place to see and fix all broken note links, using native VS Code UI.
- The same definition of "broken" as the footer and the graph.

**Non-Goals:**
- A persistent view, badge or diagnostics. The command is on demand.

## Decisions

### 1. QuickPick flow instead of a webview or tree view

```
janus.repairBrokenLinks
        |
        v
  scan --> none? --> "Keine defekten Links gefunden."
        |
        v
  QuickPick: missing targets  (Roadmap - 3 Verweise - plan.md, index.md)
        |
        v
  QuickPick: action
   +-- Notiz anlegen ------------> (name-only? pick folder) -> create, open
   +-- Auf bestehende umleiten --> QuickPick notes (similar first) -> rewrite all
   +-- Link entfernen -----------> replace all with visible text
   +-- Verweis öffnen -----------> QuickPick references -> open at line
        |
        v
  rescan --> back to target list (Esc ends at any step)
```

A QuickPick needs no new webview bundle, works with keyboard only, and fits a task users do occasionally. Rescanning after each action is simple and always correct. A full scan costs about as much as building the graph.

*Alternatives considered:* a tree view in the Janus sidebar (always visible, but needs refresh logic and takes space for something rarely used), and actions on ghost nodes in the graph (the `note-graph` spec explicitly keeps ghost clicks inert, so this would need its own change).

### 2. Service: `findBrokenLinks(roots, primaryRoot)`

A new service returns `BrokenTarget[]`, each with a key (graph ghost id), a display name (the most frequent spelling), and its references `{ sourceUri, line, occurrence }`. It reads every note once, uses `findLinkOccurrences` so code is skipped, resolves with `resolveOutgoingLink` (cached per source folder and target, as in the graph), and skips non-Markdown extensions exactly like `buildNoteGraph`. This is the same filter logic as the graph, so it's extracted into one shared predicate both use.

### 3. Where "Notiz anlegen" creates the note

- Target with a path (`projects/roadmap`): `<notesRoot>/projects/roadmap.md`. The resolver's candidate 2 (relative to the notes root) then resolves it from every linking note, wherever it is.
- Name-only target (`Roadmap`): the user picks a folder of the notes collection, and the folder of the first linking note is preselected. The basename match (candidate 3) then resolves it from every linking note.

This deliberately differs from clicking a single missing link in the editor (which creates the file next to that one note). With several linking notes in different folders, "next to the linking note" is not defined, and the rules above fix every reference at once. The note content is `# <name>\n\n`, as in the editor's create path.

### 4. Retargeting

The note picker lists all notes, ordered by similarity of the basename to the missing target: exact case-insensitive match, then prefix, then substring, then edit distance. Each reference is rewritten with the helper from `update-links-on-rename`:
- Wiki-links get the target note's basename if that resolves uniquely from the source note, otherwise its notes-root-relative path.
- Markdown links get the path relative to the source note's folder, with `.md`.
- Alias, label and suffix are kept. No alias is added to wiki-links that had none.

The same "re-resolve and verify" step as in the rename change makes sure each new target resolves to the picked note.

### 5. Removing a link

Each reference is replaced by its visible text: the alias of a wiki-link if present, otherwise its target text without suffix; the label of a Markdown link.

## Risks / Trade-offs

- [Large collections: a rescan after every action] → Same cost as opening the graph. If it becomes noticeable, rescan only the touched notes. Not done up front.
- [Grouping by lower-cased name merges `Plan` and `plan` from different folders that were meant to be different notes] → Same behavior as the graph's ghost nodes. The reference list in `Verweis öffnen` shows every source, so the user can check before acting.
- [Depends on `update-links-on-rename`] → Implement after it. The scanner and the apply step are the shared pieces.
