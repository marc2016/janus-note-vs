# Proposal

## Why

Screenshots and photos are a normal part of notes (a whiteboard after a meeting, an error dialog, a sketch). In the Janus Markdown Editor today, pasting an image does nothing useful. Users have to save the file somewhere by hand, work out the relative path, and type `![](...)`. Even then the editor only shows the Markdown text, not the image, so it's hard to see what a note contains. The PDF export already renders local images, so the gap is only in the editor.

## What Changes

- **Paste:** pasting an image from the clipboard (`Cmd+V` / `Ctrl+V`) into the Janus Markdown Editor saves it to an `assets` folder next to the note as `<note-name>-YYYYMMDD-HHmmss.<ext>` and inserts `![](assets/<file>)` at the cursor.
- **Drop:** dropping image files from the operating system into the editor saves each under its own (sanitized) file name in the same `assets` folder and inserts one image link per file at the drop position.
- File names never overwrite an existing file (a `-2`, `-3` … suffix is added). Names are sanitized so the inserted link needs no URL encoding.
- Supported formats: PNG, JPEG, GIF, WebP and SVG, up to 20 MB per image. Larger or unsupported files are rejected with a message and nothing is inserted.
- **Inline display:** the editor shows each image of a Markdown image link (`![alt](path)`) below its line, for paths relative to the note, absolute paths inside the workspace, and `https:` URLs. The link line collapses to a small caption (alt text or file name) while the cursor is elsewhere, and shows the raw, editable Markdown text when the cursor is on it. A missing image shows a short `Bild nicht gefunden` hint instead.
- Plain-text paste and dropping text or non-image files behave as today.

Non-goals (possible follow-ups): resizing images in the editor, alt-text prompts, deleting the image file when its link is removed, linking images dropped from the VS Code Explorer instead of copying them, paste of HTML with embedded images, and inline display of wiki-style image embeds (`![[bild.png]]`).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `markdown-editor`: new requirements for pasting and dropping images, and for displaying images inline.
- `notes-sidebar`: `assets` folders list their images and have no folder tasks entry.

## Impact

- Webview: new extension `src/webviews/markdown/extensions/imagePaste.ts` (paste/drop handling, base64 transfer, insertion) and `inlineImages.ts` (block widgets), registered in `MarkdownEditorApp.tsx`; styles in `globals.css`.
- Host: `src/editors/markdownEditorProvider.ts` handles `saveImage`, sends an image base URI with `init`, and extends `localResourceRoots` to the notes roots and workspace folders so local images can load.
- New `src/services/imageAssetService.ts` (file naming, collision handling, size and type checks), unit-testable.
- `fix-relative-links-after-inbox-sort` already covers `assets/` links when blocks move. Note and folder renames keep working because the links are relative to the note.
- No new dependencies or settings.
