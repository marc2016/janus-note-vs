# Proposal

## Why

Currently, Janus Note requires an initialized "Janus Vault" structure (`meetings/`, `projects/`, `knowledge/`, `inbox.md`, with pinned tasks and calendar items) to display notes in the sidebar. When opening a workspace without an initialized vault, the sidebar is blocked by a welcome banner and users cannot browse their existing project Markdown files without initializing an opinionated structure into their repository.

Users need a flexible way to add and view regular workspace folders (such as `docs/` or `specs/`) in the Janus sidebar as pure Markdown trees—without forcing the Janus Vault structure, companion tasks, calendar entries, or inbox requirements into those folders.

## What Changes

- Introduce `janus.includeFolders` configuration setting (array of folder paths relative to workspace root) to specify additional folders to display in the Janus Notes sidebar.
- Add `janus.addLinkedFolder` command accessible via the sidebar title bar (`+` icon) and the VS Code Explorer context menu ("Zu Janus Notizen hinzufügen") to link any workspace folder into the sidebar.
- Add `janus.removeLinkedFolder` command on linked folder items in the tree view ("Aus Janus Notizen entfernen") to unlink them from the sidebar.
- Update `NotesTreeDataProvider` to render linked folders as top-level folder items. In linked folders, only actual subdirectories and markdown files (`*.md`, `*.markdown`) are displayed; pinned tasks, calendar entries, and default vault folder requirements (`meetings/`, `projects/`, `knowledge/`, `inbox.md`) are omitted.
- Update `findMarkdownNotesInRoot` and `findLinkCandidatesInRoot` in `noteLinking` and `noteLinkService` to discover notes across both the primary `notesRoot` and all linked folders, enabling seamless cross-linking and autocomplete (`[[...]]`) across all included folders.
- Update the sidebar Welcome View to offer linking an existing folder (`Vorhandenen Ordner verknüpfen`) alongside the vault bootstrap action.

## Capabilities

### Modified Capabilities

- `notes-sidebar`: Support displaying linked markdown folders alongside or independently of the Janus Vault, adding/removing linked folders via commands, and keeping linked folders pure without pinned tasks or calendar items.
- `companion-manager`: Support discovering and scoping notes across both `notesRoot` and all configured `includeFolders`.
- `note-linking`: Include notes from all linked folders in link candidate autocomplete and outgoing/backlink resolution.

## Impact

- `package.json`: New configuration property `janus.includeFolders`, new commands (`janus.addLinkedFolder`, `janus.removeLinkedFolder`), and updated menus/viewsWelcome.
- `src/ui/notesTreeDataProvider.ts`: Enhanced root rendering to support multi-root / linked folder tree items.
- `src/commands/notesRootCommands.ts`: Commands for adding/removing linked folders and updating context keys.
- `src/companion/companionManager.ts`: Multi-folder root resolution and scope checking.
- `src/companion/noteLinking.ts` & `src/services/noteLinkService.ts`: Multi-folder note discovery and cross-folder link matching.

