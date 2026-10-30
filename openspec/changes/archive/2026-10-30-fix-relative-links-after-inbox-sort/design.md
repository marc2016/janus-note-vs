# Design

## Context

- Blocks are written in `AiInboxSorterService` after the "consumed" check against the current inbox (see the archived `deterministic-inbox-sorting` change). Appends go through `formatAppendedInboxSection(title, text)`; creates build `# <title>\n\n<text>`. Both receive the block text unchanged.
- `inbox.md` always lives directly in the notes root (`<notesRoot>/inbox.md`), so "relative to the folder of `inbox.md`" equals "relative to the notes root".
- `update-links-on-rename` introduces `findLinkOccurrences` (target ranges, code skipping) and a pure path recomputation helper. This change builds on both.

## Goals / Non-Goals

**Goals:**
- Paths in a moved block keep pointing to the same file for every Markdown tool, not only for Janus's resolver.

**Non-Goals:**
- Using Janus's full `resolveOutgoingLink` fallback chain. A link counts as "resolving from `inbox.md`" only via plain relative resolution (`path.resolve(inboxDir, target)` exists), because that is what other tools do and what the rewrite has to preserve.

## Decisions

### 1. Rewrite the block text before formatting, as a pure function

A pure function `rewriteRelativePaths(text, fromDir, toDir, exists)` returns the block text with rewritten targets. `exists` is injected (backed by `workspace.fs.stat`, cached per run) so the function is unit-testable without the file system. It is called once per executable block, right before `formatAppendedInboxSection` or the create template, with `fromDir = notesRoot` and `toDir = dirname(targetUri)`.

Rewriting before formatting keeps the heading logic untouched. A block's own leading heading never contains link targets that need rewriting in practice, and if it does, the rewrite applies there too, which is correct.

*Alternative considered:* rewrite after formatting the whole section. Rejected: the timestamp heading is generated text and should not go through the scanner.

### 2. Include images in the occurrence scanner via an option

`findLinkOccurrences` from `update-links-on-rename` excludes images to match `extractDocumentLinks`. It gets an `includeImages` option, which this change enables. Inline HTML (`<img src="...">`) is not rewritten. It is rare in the inbox and would need a separate parser.

### 3. Only the path part changes

The occurrence range covers just the path (without `#anchor`, `#L42`, `:42` or `"title"`). The new path is `path.posix.relative(toDir, resolvedAbs)`. If `fromDir === toDir` the function returns the text unchanged without scanning. A `./` prefix is not reintroduced: `./knowledge/plan.md` becomes `../knowledge/plan.md`, as in the spec.

### 4. Cleanup and preview are unaffected

The "consumed" matching compares the original block text with the current inbox, so it keeps using the un-rewritten text. The preview keeps showing the original block. Only the text written to the target note is rewritten.

## Risks / Trade-offs

- [`update-links-on-rename` not merged yet] → Implement this change after it. If needed, the scanner can be pulled forward on its own as the first task here.
- [A relative link was meant to point at a file that only exists next to the target note] → Such a link was already broken in `inbox.md` and, per the spec, is left unchanged, so it may start working in the target note. That matches what a user writing it would expect.
- [Many links in one block cause many `stat` calls] → Cache existence checks per run and resolved path.
