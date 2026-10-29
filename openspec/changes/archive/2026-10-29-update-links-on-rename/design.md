# Design

## Context

- `renameItemCommand` ([src/commands/notesFileCommands.ts](../../../src/commands/notesFileCommands.ts)) renames via `vscode.workspace.fs.rename` and then renames companion files. It does not touch any note content. `workspace.fs.rename` does not fire `onWillRenameFiles`/`onDidRenameFiles`, so neither VS Code's built-in Markdown link updater nor any listener reacts today.
- Link resolution lives in `resolveOutgoingLink` ([src/services/noteLinkService.ts](../../../src/services/noteLinkService.ts)). It tries, in order: the path relative to the source note's folder, relative to the primary notes root, relative to the workspace folder, and finally a basename match across all notes. The footer and the graph both use it, so "resolves to" in the spec means exactly this function.
  The rename planner uses an in-memory resolver with the same candidate order over the scanned note list (`resolveNotePath` in `linkRewriteService.ts`). It also reports *which* candidate matched, which the rewrite needs, and can resolve against the simulated post-rename note list for verification. Both are impossible with the file-system-based `resolveOutgoingLink`. For links to notes the result is the same.
- `extractDocumentLinks` returns deduplicated targets without positions and does not skip code. The graph and footer depend on that behavior, so it stays as it is.

## Goals / Non-Goals

**Goals:**
- A link that resolved to note X before a rename resolves to X (under its new path) afterwards, with the smallest possible textual change.
- Same resolution semantics as the footer and the graph. No second, diverging resolver.

**Non-Goals:**
- Reacting to renames from the Explorer or other extensions (`onWillRenameFiles`).
- Repairing links that were already broken (see `repair-broken-links`).

## Decisions

### 1. Plan before the rename, apply after it

The rename command first builds a **rewrite plan** while the old files still exist, then renames, then applies the plan.

```
collect notes (all roots)
      |
      v
for each note, each link occurrence outside code:
  resolve with resolveOutgoingLink (pre-rename state)
  affected? (target == renamed note, or inside renamed folder)
      |
      v
plan: Map<sourcePathAfterRename, Map<originalTarget, newTarget>>
      |
      v
fs.rename (+ companions)  -- fails? --> stop, no edits
      |
      v
apply plan to current text of each source (open document or file)
```

The plan stores *target strings*, not offsets. When applying it, each affected file is re-read (from the open `TextDocument` if there is one) and re-scanned, and every occurrence whose target equals a planned original target is replaced. This keeps edits correct even if the document changed between planning and applying, and it handles the renamed note itself (and notes inside a renamed folder) by using their new URIs.

*Alternative considered:* compute offsets up front and apply them blindly. Rejected because open documents can change while the input box is shown, and moved files have new URIs.

### 2. New occurrence scanner instead of changing `extractDocumentLinks`

A new pure function (e.g. `findLinkOccurrences(text)`) returns every wiki-link and Markdown link with the offset range of its *target part*, skipping fenced code blocks (```` ``` ```` and `~~~`) and inline code spans. Images (`![...](...)`) are excluded, matching `extractDocumentLinks`. The parsing of anchors and line suffixes reuses `parseLinkTargetAndLine`.

*Alternative considered:* extend `extractDocumentLinks` with offsets and code skipping. Rejected for this change because it would silently change footer, backlink, and graph behavior. Unifying both can be a later cleanup.

### 3. Rewriting a target: keep the form, then verify

For an affected occurrence the new target is built from the original one:

| Original target | Rule |
|---|---|
| basename only (`kickoff`, `kickoff.md`) | replace the basename; folder renames leave it alone |
| path (`../meetings/kickoff.md`, `projects/alpha/plan`) | recompute the path in the same base it resolved against (source folder, notes root, or workspace folder), from the source note's *new* location |

Always kept: link type, alias / label, the suffix after the path (`#anchor`, `#L42`, `:42`), `./` prefix, presence or absence of the `.md` extension, and `/` as separator.

Then the candidate is **verified**: it is resolved with `resolveOutgoingLink` against the post-rename note list (the pre-rename list with old paths mapped to new ones). If it does not resolve to the renamed note (the "ambiguous basename" scenario), it falls back to a notes-root-relative path, which wins in candidate 2 of the resolver. If that still does not resolve, the occurrence is left unchanged and counted as skipped.

Rewrites that produce the identical string (for example relative links between notes inside the same renamed folder) are dropped from the plan.

### 4. Applying edits

Replacements in **open documents** go into one `vscode.WorkspaceEdit` and are applied with `workspace.applyEdit`. Documents that were not dirty before are saved afterwards so the change is on disk, the graph watcher and backlinks see it, and the editor does not show a dirty state the user did not cause. Dirty documents stay dirty: the user's changes plus the link edit, which the user saves as usual. **Notes that are not open** have no unsaved state to protect and are written directly with `fs.writeFile`, which avoids opening every affected note as a document.

*Alternative considered:* write all files directly with `fs.writeFile` like the inbox sorter. Rejected for open documents because it would overwrite unsaved changes.

### 5. No setting, one notification

The behavior is always on. When at least one link was rewritten, an information message reports `N Links in M Notizen aktualisiert`. When some occurrences had to be skipped, the message says so. A setting can be added later if someone needs to turn it off.

## Risks / Trade-offs

- [Large collections: every rename reads all notes] → Same cost as building the graph. Resolution results are cached per (source folder, target), as in `buildNoteGraph`.
- [Case-insensitive file systems: `[[Plan]]` resolves to `plan.md`] → Compare resolved paths case-insensitively (as the graph does) and keep the original link's casing style only where the basename is unchanged.
- [URL-encoded targets (`my%20note.md`) or `<angle bracket>` targets] → The current resolver does not decode them, so they never resolve and are never rewritten. This is consistent with today's behavior and is listed as a follow-up.
- [A save fails or a file is read-only] → Collect the failures and show a warning naming the notes that could not be updated. The rename itself is not rolled back.
- [Undo] → Edits in open documents can be undone per document. There is no single "undo rename" action, which is acceptable for now.
