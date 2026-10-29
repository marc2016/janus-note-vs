# Design

## Context

- `createNoteCommand` ([src/commands/notesFileCommands.ts](../../../src/commands/notesFileCommands.ts)) prompts for a name, rejects existing files, writes `# <title>\n\n`, refreshes the tree and opens the note with `vscode.openWith`.
- Every collection scan already skips names starting with `.` (`findMarkdownNotesInRoot`, link candidates, tree provider, calendar, folder tasks, folder summary). A `.templates` folder is therefore invisible without extra code.
- The tree hides dot folders, so templates can't be edited from the sidebar. That's why `janus.editTemplates` exists.

## Goals / Non-Goals

**Goals:**
- One function, `applyTemplate(text, { title, now })`, that `createNote`, `editTemplates` examples, and `daily-notes` all use.
- No behavior change when no template exists.

**Non-Goals:**
- A template language (conditionals, loops, prompts).

## Decisions

### 1. `noteTemplateService.ts` with pure placeholder replacement

```ts
listTemplates(notesRoot): Promise<{ name: string; uri: Uri }[]>   // *.md directly in .templates, sorted
applyTemplate(text, { title, now }): string                       // pure
ensureTemplatesFolder(notesRoot): Promise<Uri>
createTemplate(notesRoot, name): Promise<Uri | 'exists'>
```

`applyTemplate` uses a single regex, `/\{\{\s*([a-z]+)(?::([^}]*?))?\s*\}\}/gi`, and a lookup: `title`, `date` (with an optional `DD.MM.YYYY` argument), `time`, `weekday`. An unknown name or an unsupported `date:` argument returns the original match unchanged. Dates are formatted by hand from local `Date` fields (as `formatInboxTimestamp` does), and weekday names come from a fixed German array, so the result doesn't depend on the process locale.

*Alternative considered:* `Intl.DateTimeFormat('de-DE')` for weekdays. It depends on the ICU data in the VS Code build. A fixed array is simpler and testable.

### 2. Picker after the name prompt, only if templates exist

The order is name prompt, existence check, then picker, so the user isn't asked to choose a template for a name that's already taken. The picker is a `showQuickPick` with `Leere Notiz` first (description "Nur Titel-Überschrift"), then one item per template. `undefined` (Esc) aborts without creating anything. The template is read at the moment of creation, so edits to it apply immediately.

### 3. Example content for `Neue Vorlage…`

```markdown
---
date: {{date}}
---
# {{title}}

## Notizen

## Aufgaben
- [ ] 
```

It shows two placeholders and the calendar hookup through `date:`, and it is short enough to adapt.

### 4. Root resolution

Templates belong to the primary notes root (`companionManager.getNotesRootUri()`). Included folders don't have their own templates. If no notes root is set, `janus.editTemplates` shows the same "set up a notes folder first" message as other root-dependent commands, and `createNote` skips the picker.

## Risks / Trade-offs

- [Users don't find hidden templates] → `janus.editTemplates` is in the Notes view title bar's overflow menu, and its first use creates the folder with an example.
- [A template whose title heading differs from `# {{title}}`] → Intended. The template decides the structure, and `createNote` only adds the title heading for `Leere Notiz`.
- [Placeholders inside code blocks get replaced too] → Accepted. Templates are authored on purpose, and escaping can be added if someone needs it.
