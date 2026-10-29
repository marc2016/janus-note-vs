# Spec Delta

## ADDED Requirements

### Requirement: Pasting and Dropping Images
When the user pastes clipboard content containing an image into the Janus Markdown Editor, the system SHALL save the image to the folder `assets` next to the note (creating it if needed) as `<note-name>-YYYYMMDD-HHmmss.<ext>`, using the local time, and insert `![](assets/<file>)` at the cursor. When the user drops one or more image files from the operating system into the editor, the system SHALL save each under its original file name in the same folder and insert one image link per file, each on its own line, at the drop position. File names SHALL be sanitized to letters, digits, `-`, `_` and `.` (other characters replaced by `-`). An existing file SHALL never be overwritten: the system SHALL append `-2`, `-3`, … before the extension. Supported formats SHALL be PNG, JPEG, GIF, WebP and SVG, up to 20 MB per image. For an unsupported format or a larger image, the system SHALL show a message and save and insert nothing for that file. Pasting text and dropping text or non-image files SHALL behave as before.

#### Scenario: Pasting a screenshot
- **WHEN** the note `projects/app/Sprint Review.md` is open, the clipboard contains a PNG image, and the user pastes on 2026-10-29 at 07:12:05
- **THEN** the image is saved as `projects/app/assets/Sprint-Review-20261029-071205.png` and `![](assets/Sprint-Review-20261029-071205.png)` is inserted at the cursor

#### Scenario: Dropping image files
- **WHEN** the user drops `Whiteboard Foto.jpg` and `skizze.svg` into the note `meetings/kickoff.md`
- **THEN** `meetings/assets/Whiteboard-Foto.jpg` and `meetings/assets/skizze.svg` are saved and two lines `![](assets/Whiteboard-Foto.jpg)` and `![](assets/skizze.svg)` are inserted at the drop position

#### Scenario: Name collision
- **WHEN** `meetings/assets/skizze.svg` already exists and the user drops another `skizze.svg` into `meetings/kickoff.md`
- **THEN** the new file is saved as `meetings/assets/skizze-2.svg`, the existing file is unchanged, and `![](assets/skizze-2.svg)` is inserted

#### Scenario: Unsupported or too large file
- **WHEN** the user drops a 25 MB PNG or a `.heic` image
- **THEN** a message explains why the file was not added, and no file is saved and no text is inserted for it

#### Scenario: Pasting text
- **WHEN** the clipboard contains only text and the user pastes
- **THEN** the text is inserted as before and no file is saved

### Requirement: Inline Image Display
The Janus Markdown Editor SHALL display the image of every Markdown image link (`![alt](path)`) below the line containing it, outside fenced code blocks and inline code. Paths relative to the note's folder, absolute paths inside the workspace, and `https:` URLs SHALL be supported. Images SHALL be scaled down to fit the editor width and a maximum height, and keep their aspect ratio. The image link's Markdown text SHALL stay in the document, and displaying images SHALL NOT change the document text. While the cursor is not on the link's line and syntax visibility is not set to always visible, the editor SHALL show the image link as a compact caption with an image icon and the alt text (or the file name without alt text) instead of the raw text. On the cursor's line, or with syntax always visible, the editor SHALL show the raw link text in a muted style without link styling, so it can be edited. When an image cannot be loaded, the editor SHALL show the hint `Bild nicht gefunden: <path>` in its place. Changing or removing the link SHALL update or remove the displayed image.

#### Scenario: Showing a local image
- **WHEN** `meetings/kickoff.md` contains `![Whiteboard](assets/Whiteboard-Foto.jpg)` and the file exists
- **THEN** the image is shown below that line, scaled to the editor width, and the line `![Whiteboard](assets/Whiteboard-Foto.jpg)` is unchanged

#### Scenario: Compact caption for the link line
- **WHEN** the cursor is on another line and a note contains `![](assets/project-plan-20261029-180102.png)`
- **THEN** the editor shows the caption `project-plan-20261029-180102.png` with an image icon above the image, and moving the cursor onto that line shows the raw text `![](assets/project-plan-20261029-180102.png)`

#### Scenario: Missing image
- **WHEN** a note contains `![](assets/fehlt.png)` and the file does not exist
- **THEN** the editor shows `Bild nicht gefunden: assets/fehlt.png` below the line

#### Scenario: Image in a code block
- **WHEN** a note contains `![](assets/bild.png)` inside a fenced code block
- **THEN** no image is shown for it

#### Scenario: Editing the link
- **WHEN** the user changes `![](assets/a.png)` to `![](assets/b.png)`
- **THEN** the editor shows `b.png` instead of `a.png`
