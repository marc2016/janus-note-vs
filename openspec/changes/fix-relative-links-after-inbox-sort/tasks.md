# Tasks

## 1. Prerequisites

- [ ] 1.1 Confirm `findLinkOccurrences` and the path recomputation helper from `update-links-on-rename` are available (or implement the scanner first per that change's tasks 1.1–1.2); verify their unit tests pass with `npm test`
- [ ] 1.2 Add an `includeImages` option to `findLinkOccurrences` that also returns `![alt](path)` occurrences with their path range; verify with unit tests for an image with and without a `"title"`

## 2. Rewrite function

- [ ] 2.1 Implement `rewriteRelativePaths(text, fromDir, toDir, exists)` that rewrites only relative, existing targets of Markdown links and images, keeps label, alt text, title and suffix, and returns the text unchanged when `fromDir === toDir`; verify with unit tests for each scenario of "Relative Path Rewrite for Moved Inbox Blocks" (image, anchor plus title, `./` prefix, wiki/external/anchor-only, unresolved, code, root target)
- [ ] 2.2 Add a test asserting that every character outside rewritten path ranges is identical to the input; verify it passes for a block mixing headings, lists, code and links

## 3. Inbox sorter integration

- [ ] 3.1 In `AiInboxSorterService`, pass each executable block's text through `rewriteRelativePaths` (with a per-run cached `exists` backed by `workspace.fs.stat`) before the append and create branches; verify with tests in `tests/aiInboxSorting.test.ts` that an appended and a created note contain the rewritten paths
- [ ] 3.2 Verify with a test that blocks left in `inbox.md` and the cleanup matching use the original text (the unassigned-block scenario)
- [ ] 3.3 Run `npm test` and `npm run compile` and verify both succeed; manually sort a block with an image from `assets/` into `projects/<x>/<y>.md` and check the image renders in the Janus editor and in the PDF export
