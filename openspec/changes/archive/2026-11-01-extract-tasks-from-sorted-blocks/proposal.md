# Proposal

## Why

Inbox entries often contain to-dos ("APNs-Zertifikat bis Donnerstag erneuern"). Today the user sorts the inbox and then has to open every target note and run "Aufgaben generieren" there. Doing both in one step saves those extra runs and catches tasks right when the thought is filed away.

## What Changes

- New setting `janus.ai.inboxSortExtractTasks` (default `false`): after a sort run has written its blocks, the AI also extracts tasks from exactly those blocks.
- The sort preview gets a row "Aufgaben aus einsortierten Abschnitten erzeugen", preselected from the setting. Toggling it there affects only this run. In direct mode the setting applies.
- Tasks land in the `tasks.json` of the **target note's** folder, linked to the target note, with the same fields, date handling and duplicate check (against that folder's tasks) as "Aufgaben generieren". One AI request covers all written blocks of a run.
- Works for `inbox.md` and daily notes alike.
- The result message adds the number of created tasks. If task extraction fails, the sorted notes stay as written and the message says that no tasks were created.
- "Rückgängig" also removes the tasks the run created, unless they were changed since; a `tasks.json` created by the run is deleted when it is empty again.
- The Settings Panel gets a checkbox for the new setting.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `ai-inbox-sorting`: new requirement for extracting tasks from sorted blocks (setting, preview row, target folder, failure handling); the undo requirement additionally covers created tasks.
- `settings-panel`: the AI behavior requirement also covers toggling `janus.ai.inboxSortExtractTasks`.

## Impact

- `src/services/aiTaskGeneratorService.ts`: new method for extracting tasks from several blocks with their target notes in one request.
- `src/services/aiInboxSorterService.ts`: preview row, calling the extraction after writing, result fields.
- `src/services/inboxSortUndo.ts`: record and undo created tasks.
- `src/editors/markdownEditorProvider.ts` (`showInboxSortResult`): task count / failure hint.
- `package.json`, `src/editors/settingsViewProvider.ts`, `src/webviews/settings/SettingsApp.tsx`: setting and checkbox.
- Tests and sample guide.
