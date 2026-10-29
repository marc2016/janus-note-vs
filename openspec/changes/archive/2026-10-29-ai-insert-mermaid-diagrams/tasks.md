# Tasks

## 1. Helpers

- [x] 1.1 Add `MERMAID_PLACEHOLDER` and `sectionAround(text, blockFrom, blockTo, maxChars)` to `src/services/markdownScan.ts`; verify with unit tests for a section bounded by headings of the same and a higher level, a nested sub-heading staying inside, no heading above, frontmatter dropped, the block removed, and the length cap

## 2. Slash command

- [x] 2.1 Add `/ki-diagramm` to `slashCommands.ts` (placeholder block on its own lines, cursor after it, `onAiDiagram(blockFrom)`) and wire `onAiDiagram` in `MarkdownEditorApp.tsx` to `editDiagramWithAi`; verify with tests for "Inserting a diagram with AI" (block text and position) and "Command typed inside a line", and that `/chart` is unchanged
- [x] 2.2 Let `editDiagramWithAi` in `MarkdownEditorProvider` wait briefly for the inserted block to reach the document; verify with a test where the document text contains the block only after a short delay

## 3. Chat

- [x] 3.1 In `ChatViewProvider`, add the section to the prompt, use the create-prompt and the `Neues Diagramm` label for the placeholder, and re-send the label after a successful `Übernehmen`; verify with tests for "Note section as context" and "Creating a new diagram", and that the existing diagram tests still pass

## 4. Wrap-up

- [x] 4.1 Run `npm test`, `npm run compile` and `npm run build` and verify all succeed
- [x] 4.2 Manually check: under a heading with some text, type `/ki-diagramm`, ask "Mach daraus ein Ablaufdiagramm", apply; type `/ki-diagramm` after text on a line; remove the chip and undo the placeholder with `Cmd+Z`; use `KI` on an existing diagram and check the answer uses the surrounding text
