# Design

## Context

- The Janus Markdown Editor is a webview (CodeMirror 6) on top of a `TextDocument`. Text flows webview → host through the existing sync. `fix-editor-sync-race` made this path reliable, so new text should enter through the editor, not through host-side `WorkspaceEdit`s.
- The webview has no paste or drop handling apart from CodeMirror's defaults (`dropCursor` is enabled).
- `localResourceRoots` of the editor webview only contains `dist`, so it cannot load images from the notes collection yet. There is no Content-Security-Policy meta tag in the editor HTML.
- Live preview decorations come from a `ViewPlugin` in `livePreview.ts`. CodeMirror only accepts **block** widgets from a `StateField`, not from a view plugin.
- `findLinkOccurrences(text, { includeImages: true })` in `noteLinkService.ts` finds image links with code skipped, but it lives in a file that imports `vscode`. `note-tags` moves it to the `vscode`-free `markdownScan.ts`.

## Goals / Non-Goals

**Goals:**
- Pasting an image is one action, and the result is visible right away.
- No changes to how documents are synchronized.

**Non-Goals:**
- An image management view (unused images, renaming assets).

## Decisions

### 1. Transfer: webview reads the file, host writes it, webview inserts the link

```
paste/drop (webview)
  -> File objects of image type, size checked early (20 MB)
  -> FileReader -> base64
  -> postMessage { type: 'saveImage', requestId, fileName?, mime, data }
host
  -> imageAssetService: validate type/size, build name, avoid collisions
  -> fs.createDirectory(<noteDir>/assets), fs.writeFile
  -> reply { type: 'imageSaved', requestId, relPath } | { type: 'imageRejected', requestId, reason }
webview
  -> insert `![](relPath)` at the remembered position, mapped through any edits made meanwhile
```

The webview remembers each request's insert position and maps it through every transaction until the reply arrives (`ChangeSet.mapPos`), so typing in between does not misplace the link. Several dropped files are sent as separate requests and inserted in drop order, each on its own line.

*Alternative considered:* the host inserts the link with a `WorkspaceEdit`. That would bring back the host-to-webview edit path that caused cursor jumps before.

### 2. `imageAssetService.ts` (host, pure where possible)

- `sanitizeFileName(name)`: replace every character outside `[A-Za-z0-9._-]` with `-`, collapse repeats, trim `-`. Umlauts are replaced too, because the link must work without URL encoding in every Markdown tool.
- `pastedImageName(noteBaseName, mime, now)` → `<sanitized note>-YYYYMMDD-HHmmss.<ext>`, with the extension from the MIME type (`image/png` → `png`, `image/jpeg` → `jpg`, `image/gif`, `image/webp`, `image/svg+xml` → `svg`).
- `uniqueName(dirUri, name)`: stat and append `-2`, `-3` … until the name is free.
- `validateImage(mime, size)`: allowed types and the 20 MB limit, returning a German reason text on failure.

The host validates again even though the webview pre-checks, so the limit can't be bypassed.

### 3. Inline images via a `StateField` of block widgets

`inlineImages.ts` defines a `StateField<DecorationSet>`, recomputed when the document changes. It scans with `findLinkOccurrences(text, { includeImages: true })` and adds, for each image occurrence, a `Decoration.widget({ block: true, side: 1, widget })` at the end of its line. `ImageWidget.eq` compares the resolved `src`, so unchanged images are not reloaded while typing. The widget renders an `<img>` with `max-width: 100%; max-height: 24rem; object-fit: contain`, and on `error` it swaps to the hint text.

The scanner dependency: if `note-tags` has landed, import from `markdownScan.ts`. Otherwise this change performs that move itself (the same pure move, with a re-export from `noteLinkService.ts`), so both orders work.

The link text itself is styled by a separate `ViewPlugin` in the same file (inline decorations may come from a plugin): away from the cursor, a `Decoration.replace` widget shows a caption (image icon + alt text or file name); on the cursor's line, or with `syntaxVisibilityFacet` set to `visible`, a mark (`cm-image-source`) shows the raw text muted and overrides the link colors the Markdown highlighter gives image URLs. This follows how the live preview hides heading and link syntax away from the cursor.

*Alternative considered:* replacing the link text with the image itself. Then there would be no place to click to edit the path, and a missing image would hide the link entirely.

### 4. Resolving `src` in the webview

The host sends `imageBaseUri = webview.asWebviewUri(noteDirUri).toString()` with `init`. The webview resolves:
- relative path → `imageBaseUri + '/' + path` (with `./` stripped, `..` resolved on the URL)
- absolute filesystem path inside the workspace → the host also sends `workspaceRoots: [{ fsPath, webviewUri }]`, and the webview maps by prefix
- `https:` and `data:` → used directly
- anything else → the hint

`localResourceRoots` becomes `dist` plus all notes roots (`getAllNotesRoots`) plus all workspace folders. That way local images load, and nothing outside the workspace is exposed.

## Risks / Trade-offs

- [Large base64 messages (up to ~27 MB for 20 MB)] → Acceptable for an occasional action. The 20 MB limit caps it, and the webview checks the size before reading.
- [Remote `https:` images leak the user's IP to the image host when a note is opened] → Same as any Markdown preview. A setting to block remote images can follow if needed.
- [Images in very long notes] → Widgets are lightweight `<img>` elements, and CodeMirror only renders those in or near the viewport.
- [A pasted image named after the note keeps the old name after a note rename] → The link stays valid (it's relative). Only the file name is stale, which is acceptable.
