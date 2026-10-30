# Proposal

## Why

Inbox sorting moves each block verbatim from `<notesRoot>/inbox.md` into a note one or more folders deeper (e.g. `projects/app/launch.md`). Relative paths in the block were written against the notes root, so after the move they point somewhere else:

- Images (`![Skizze](assets/skizze.png)`) are resolved relative to the note by the editor and the PDF export, so they break immediately.
- Markdown links (`[Plan](knowledge/plan.md)`) still work in Janus only because its resolver falls back to the notes root. In standard Markdown tools (VS Code preview, GitHub, other editors) they are broken, and in Janus they silently resolve to a different file when one with the same relative path exists next to the target note.

This was an explicit non-goal of `deterministic-inbox-sorting` and is the remaining way sorting can damage content.

## What Changes

- When a block is written into its target note, relative targets of Markdown links and images that resolved to an existing file from `inbox.md` are rewritten so they resolve to the same file from the target note's folder.
- Wiki-links, external URLs, anchors-only links (`#section`), absolute paths, and links that did not resolve from `inbox.md` are left unchanged.
- Links inside fenced code blocks and inline code are left unchanged.
- The rewrite changes only the path part; label, alt text, title, anchor and line suffix stay as they are.
- The "verbatim" guarantee is narrowed accordingly: apart from the defined headings, the only change to a block's text is this path rewrite.
- `inbox.md` cleanup is unaffected: blocks that stay in the inbox keep their original text.

Non-goals: rewriting links in other notes that point to text inside `inbox.md` (anchors to inbox sections), moving image files along with the block, and URL-encoded or `<angle bracket>` targets (consistent with `update-links-on-rename`).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-inbox-sorting`: "Verbatim Transfer of Inbox Blocks" allows exactly one additional change, the rewrite of relative link and image paths, and a new requirement defines that rewrite.

## Impact

- `src/services/aiInboxSorterService.ts`: the write step (`formatAppendedInboxSection` and the create branch) passes block text through the path rewrite first.
- Reuses the link occurrence scanner and path recomputation from `update-links-on-rename` (with images included), so that change should land first.
- Tests: `tests/aiInboxSorting.test.ts`.
- No new dependencies or settings.
