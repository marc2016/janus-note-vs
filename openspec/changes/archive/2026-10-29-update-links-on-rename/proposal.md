# Proposal

## Why

Renaming a note or folder in the Janus sidebar only renames the files on disk (plus companion files). Every `[[Note]]` or `[text](path/note.md)` pointing to the renamed note silently breaks: the footer marks it as missing, the graph turns it into a ghost node, and backlinks disappear. Renaming is the most common way users restructure their notes, so this is the main way they lose links today, and they usually only notice much later.

## What Changes

- Renaming a note via `janus.renameItem` rewrites every link in the collection (notes root and `janus.includeFolders`) that pointed to the old note so it points to the new name.
- Renaming a folder via `janus.renameItem` rewrites every link whose target note lives inside that folder.
- Only links that actually resolved to the renamed note (or a note inside the renamed folder) before the rename are touched. Links that were already broken, or that pointed to a different note with the same name, stay unchanged.
- The rewritten link keeps its form: link type (wiki or Markdown), alias or label, `#anchor` / `#L42` / `:42` suffix, presence or absence of the `.md` extension, and relative vs. root-relative path style.
- Links inside fenced code blocks and inline code are never changed.
- Open editors receive the changes as regular document edits, so unsaved user input is not overwritten.
- After the rename, the user sees how many links in how many notes were updated.

Non-goals (possible follow-ups): renames and moves done in the VS Code Explorer or outside VS Code, drag-and-drop moves in the sidebar (not supported today), updating link labels that repeat the old note name as plain text, and a setting to turn the behavior off.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `note-linking`: new requirement for rewriting incoming links when a note or folder is renamed.
- `notes-sidebar`: the rename requirement now also keeps links to the renamed item synchronized, not just companion files.

## Impact

- `src/commands/notesFileCommands.ts`: `renameItemCommand` collects affected links before the rename and applies the rewrites after it.
- `src/services/noteLinkService.ts`: needs link occurrences with positions (today `extractDocumentLinks` returns deduplicated targets without offsets) and a code-aware scan.
- New link rewriting module (pure functions, unit-testable).
- Tests: `tests/notesFileCommands.test.ts`, `tests/noteLinkService.test.ts`, new tests for the rewriter.
- No new dependencies, no new settings.
