# Tasks

## 1. Template service

- [x] 1.1 Create `src/services/noteTemplateService.ts` with the pure `applyTemplate(text, { title, now })`; verify with unit tests for both scenarios of "Placeholder Replacement" (all placeholders, case-insensitive names, spaces inside braces, unknown placeholders and unsupported `date:` formats kept, frontmatter copied)
- [x] 1.2 Add `listTemplates(notesRoot)` (only `*.md` directly in `.templates`, sorted by name), `ensureTemplatesFolder` and `createTemplate` (example content, `'exists'` without overwriting); verify with unit tests for the listing and name-already-taken scenarios

## 2. Create note with templates

- [x] 2.1 Add the picker step to `createNoteCommand` after the existence check (only when templates exist, `Leere Notiz` first, Esc aborts) and write the applied template content; verify with tests in `tests/notesFileCommands.test.ts` for the from-template, empty-note, no-templates and cancel scenarios

## 3. Edit templates command

- [x] 3.1 Register `janus.editTemplates` in `src/extension.ts` (template list plus `Neue Vorlage…`, open in the Janus Markdown Editor, notes-root check) and contribute it in `package.json` with a `view/title` overflow entry for `janus.notesView`; verify with tests for the opening, first-template and name-taken scenarios

## 4. Wrap-up

- [x] 4.1 Verify with a test that a note in `.templates` is not returned by `findMarkdownNotesInRoot` and not shown by the tree provider (templates stay out of the collection)
- [x] 4.2 Run `npm test`, `npm run compile` and `npm run build` and verify all succeed; manually create a template via `Janus: Vorlagen bearbeiten`, then create a note from it in the sidebar and check the filled-in placeholders
