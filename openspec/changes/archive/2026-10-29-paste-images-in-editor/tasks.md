# Tasks

## 1. Host: image assets

- [x] 1.1 Create `src/services/imageAssetService.ts` with `sanitizeFileName`, `pastedImageName`, `uniqueName` and `validateImage`; verify with unit tests for sanitizing (`Sprint Review` → `Sprint-Review`, umlauts, repeated separators), MIME-to-extension mapping, the collision scenario (`skizze-2.svg`) and the type/size rejection scenario
- [x] 1.2 Handle `saveImage` in `MarkdownEditorProvider` (validate, create `<noteDir>/assets`, write, reply `imageSaved`/`imageRejected`, show the rejection message); verify with tests in `tests/markdownEditor.test.ts` for the pasting, dropping and rejected cases (no file written)
- [x] 1.3 Extend `localResourceRoots` with all notes roots and workspace folders, and send `imageBaseUri` and `workspaceRoots` with `init`; verify with a test of the webview options and the init message

## 2. Webview: paste and drop

- [x] 2.1 Add `src/webviews/markdown/extensions/imagePaste.ts` (paste and drop handlers for image files only, size pre-check, base64 via `FileReader`, request ids, position mapping through transactions, insertion one link per line) and register it in `MarkdownEditorApp.tsx`; verify with unit tests that an image paste posts `saveImage`, a text paste is left to CodeMirror, and a reply inserts the link at the mapped position after intermediate typing

## 3. Webview: inline images

- [x] 3.1 Ensure the image-aware link scanner is importable from the webview (`markdownScan.ts`, moving it if `note-tags` has not done so yet); verify `tests/linkOccurrences.test.ts` passes unchanged
- [x] 3.2 Add `src/webviews/markdown/extensions/inlineImages.ts` (`StateField` of block widgets, `src` resolution, `ImageWidget.eq`, error hint) with styles in `globals.css`, and register it; verify with tests for the local-image, missing-image, code-block and editing-the-link scenarios

- [x] 3.3 Add the caption/raw styling `ViewPlugin` for image links in `inlineImages.ts` (caption widget away from the cursor, muted raw text on the cursor's line or in `visible` mode), with styles in `globals.css`; verify with decoration tests for "Compact caption for the link line" and the `visible` mode

- [x] 3.4 Show `assets` folders in the Notes view as image folders (media icon, image files only, click opens the image, no `Aufgaben` entry) and refresh the tree after saving an image; verify with a test in `tests/notesTreeDataProvider.test.ts` for "Images in the assets folder" and "Opening an image"

## 4. Wrap-up

- [x] 4.1 Run `npm test`, `npm run compile` and `npm run build` and verify all succeed
- [x] 4.2 Manually paste a screenshot, drop two images from Finder, open a note with a missing image, and check that the PDF export of the note still shows the pasted images
