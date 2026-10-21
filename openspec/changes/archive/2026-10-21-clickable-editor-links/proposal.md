# Proposal: Clickable Inline Links in Markdown Editor

## Why

While Janus Note supports wiki-links and markdown links in document storage and lists them in the bottom footer bar, links inside the Live Preview editor text itself are currently plain, non-clickable text. Enabling direct clicking on inline links (`[[Note]]`, `[Link](target)`, and `https://...`) combined with mode-aware syntax concealing allows effortless document-to-document navigation and fluid knowledge browsing directly within notes.

## What Changes

- Render inline wiki-links (`[[Target]]`, `[[Target|Alias]]`) and markdown links (`[Label](target)`, external URLs) as interactive clickable links in the Live Preview editor.
- Clicking an inline link directly (without requiring `Cmd`/`Ctrl` keys) opens the target document (note, companion, image, PDF) or launches external URLs in the default browser.
- Hide link delimiters (`[[` and `]]`, `[` and `](...)`) according to the active syntax visibility mode:
  - In `auto` mode: hide brackets when cursor is outside the link; reveal raw syntax when cursor moves into the link for seamless editing.
  - In `visible` mode: keep all link markers visible.
  - In `hidden` mode: keep link markers concealed.
- If a clicked note does not exist yet, prompt the user with a confirmation notification dialog (*"Notiz '[Name]' existiert nicht. Jetzt erstellen?"*) before creating and opening the new note file.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `markdown-editor`: Add requirement for interactive clickable links with mode-dependent syntax concealing and missing note creation confirmation.

## Impact

- **Affected Code**:
  - `src/webviews/markdown/extensions/livePreview.ts`: Add link decoration parsing, class styling (`cm-link-text`, `cursor: pointer`), and mode-aware delimiter concealment.
  - `src/webviews/markdown/MarkdownEditorApp.tsx`: Handle link click events dispatched from the CodeMirror editor DOM and post `openLink` messages to the extension host.
  - `src/editors/markdownEditorProvider.ts`: Handle `openLink` with missing-note verification; if target note does not exist, display confirmation dialog to create and open it.
- **Dependencies**: Uses existing VS Code workspace and CodeMirror 6 APIs; no new npm packages required.

