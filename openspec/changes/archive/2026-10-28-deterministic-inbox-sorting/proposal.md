# Proposal

## Why

Inbox sorting currently lets the AI both split `inbox.md` and rewrite each section, then cleans the inbox up by exact string matching on the AI's `sourceText`. This can lose data: when every proposal is selected, `inbox.md` is reset to `# Inbox` even if the AI skipped a section. It can also duplicate entries, because a slightly paraphrased `sourceText` no longer matches the inbox. On top of that, the AI picks targets from file paths alone, so it often appends to the wrong note or creates a duplicate one.

## What Changes

- The inbox is split into blocks deterministically in code, not by the AI. Each `##`-or-deeper heading starts a block; without headings, blank-line-separated paragraphs become blocks.
- The AI only assigns blocks: it returns `{block, title, action, targetRelativePath}` per block and no longer returns `content` or `sourceText`.
- The original block text is moved verbatim into the target note. The AI can no longer reword or shorten user text.
- Blocks the AI did not assign always stay in `inbox.md`. The inbox is reset to `# Inbox` only when every block was actually sorted.
- Cleanup works per block against the inbox's state at write time. A block the user edited while the AI was running is neither written nor removed.
- The prompt includes each existing note's title and `##` headings, not just its path, so the AI can pick better append targets.
- The default welcome paragraph is detected robustly (any paragraph starting with "Willkommen in deinen Janus Notes!"), so the longer variant used in `sample/inbox.md` is no longer sent to the AI as content.
- The success message reports how many blocks stayed in the inbox.

Non-goals (possible follow-ups): editing targets in the preview, undoing a sort run, rewriting relative Markdown links after a move, extracting tasks from sorted blocks, and including `includeFolders` as targets.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-inbox-sorting`:
  - Splitting becomes deterministic, and the AI assigns blocks instead of rewriting them.
  - Note headings are added as classification context.
  - Content is transferred verbatim.
  - Cleanup keeps unassigned and concurrently edited blocks.
  - Welcome-text detection covers all default variants.

## Impact

- `src/services/aiInboxSorterService.ts`: new block splitter, new response schema and parser, prompt rewrite, note-outline collection, and a rewritten write and cleanup flow.
- `src/extension.ts` and `src/editors/markdownEditorProvider.ts`: the result message mentions the blocks that stayed in the inbox.
- `tests/aiInboxSorting.test.ts`: tests are updated for the new AI response format, with new cases for splitting, data-loss protection and concurrent edits.
- No new dependencies and no settings changes. `janus.ai.inboxSortConfirm` behaves as before.
