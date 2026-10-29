# Proposal

## Why

Every new note in Janus starts as `# <name>` and nothing else. Notes of the same kind (meeting notes, project briefs, retros) get the same structure retyped by hand each time, or copied from an older note and cleaned up. That is slow and makes notes of one kind drift apart, which also hurts inbox sorting and task generation, since both work better on consistently structured notes. Templates are also the building block for `daily-notes`, which needs a configurable starting content for each day's note.

## What Changes

- Markdown files in `<notesRoot>/.templates/` are note templates. The folder is hidden, so templates do not appear as notes in the sidebar, graph, search, calendar or tags (dot folders are already skipped by every scan).
- `janus.createNote` shows a picker after the name prompt when at least one template exists: `Leere Notiz` (today's behavior) plus one entry per template. Without templates, nothing changes.
- The new note gets the template's content with placeholders replaced: `{{title}}` (the entered note name), `{{date}}` (`YYYY-MM-DD`), `{{date:DD.MM.YYYY}}` (German date), `{{time}}` (`HH:mm`) and `{{weekday}}` (German weekday name). Unknown placeholders are left as they are.
- New command `janus.editTemplates` (`Janus: Vorlagen bearbeiten`) lists the templates to open them in the Janus Markdown Editor, and offers `Neue Vorlage…`, which creates `.templates/` if needed and a new template with example content.
- Template content is copied as-is apart from placeholders, including frontmatter. A template with `date: {{date}}` therefore puts new notes into the calendar.

Non-goals (possible follow-ups): templates per folder, a cursor placeholder, arbitrary date format strings beyond the two listed, templates for task companions, and template variables entered through prompts.

## Capabilities

### New Capabilities

- `note-templates`: template storage, placeholder replacement, and the template editing command.

### Modified Capabilities

- `notes-sidebar`: "Create Note Action" offers templates when they exist.

## Impact

- New `src/services/noteTemplateService.ts` (listing templates, applying placeholders, creating the template folder and example template).
- `src/commands/notesFileCommands.ts` (`createNoteCommand` picker step).
- `src/extension.ts` and `package.json` (new command `janus.editTemplates`, also in the Notes view title overflow menu).
- `daily-notes` uses `applyTemplate` from this change.
- No new dependencies or settings.
