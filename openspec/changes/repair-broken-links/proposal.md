# Proposal

## Why

Broken note links are visible in Janus, but only one at a time: a dashed pill in a note's footer, or a ghost node in the graph once `Fehlende Notizen anzeigen` is on. There is no way to see all of them at once, and no way to fix one except finding every linking note by hand and editing it. Typos (`[[kickof]]`), notes that were renamed outside Janus, and "write this later" placeholders pile up unnoticed. `update-links-on-rename` stops new breakage from Janus renames. This change cleans up what is already broken.

## What Changes

- New command `janus.repairBrokenLinks` (`Janus: Defekte Links reparieren`), available from the command palette and the Notes view title bar overflow menu.
- It scans all notes under `janus.notesRoot` and `janus.includeFolders` for note links that do not resolve (the same links the graph shows as ghost nodes) and lists them in a QuickPick, grouped by missing target, with the number of references and the linking notes.
- For a selected missing target the user can:
  - **Notiz anlegen**: create the missing note, which fixes all references at once.
  - **Auf bestehende Notiz umleiten**: pick an existing note (similar names first) and rewrite every reference to point there.
  - **Link entfernen**: replace every reference with its plain visible text.
  - **Verweis öffnen**: open a linking note at the line of the reference.
- After an action, the list is shown again with the remaining broken targets until it is empty or the user closes it.
- Links inside fenced code blocks and inline code are not reported and not changed.

Non-goals (possible follow-ups): broken links to non-note files and images, a permanent problems view or badge with a count in the sidebar, Problems-panel diagnostics, actions from the graph's ghost nodes (the graph spec keeps ghost clicks inert), and automatic fixing without user choice.

## Capabilities

### New Capabilities

- `broken-links`: finding unresolved note links across the collection and repairing them by creating, retargeting or unlinking.

### Modified Capabilities

None.

## Impact

- New service for finding broken links (reuses `resolveOutgoingLink`, `findMarkdownNotesInRoots`, and `findLinkOccurrences` plus the rewrite/apply helpers from `update-links-on-rename`, which should land first).
- New command registration in `src/extension.ts` and contribution in `package.json` (command plus `view/title` menu entry for `janus.notesView`).
- Tests for the service and the command flow.
- No new dependencies or settings.
