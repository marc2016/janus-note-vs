# Spec Delta

## ADDED Requirements

### Requirement: Image Asset Folders in the Notes View
The Notes view SHALL show a folder named `assets` as an image folder: with a media icon, listing the PNG, JPEG, GIF, WebP and SVG files it contains, and without a folder tasks entry (`Aufgaben`). Clicking an image SHALL open it in VS Code's image preview. Other files in the folder SHALL NOT be listed. The Notes view SHALL refresh after an image was saved from the editor.

#### Scenario: Images in the assets folder
- **WHEN** `meetings/assets/` contains `Whiteboard-Foto.jpg`, `skizze.svg` and `notiz.txt`
- **THEN** the Notes view shows `meetings/assets` with a media icon and the entries `skizze.svg` and `Whiteboard-Foto.jpg`, and no `Aufgaben` entry

#### Scenario: Opening an image
- **WHEN** the user clicks `skizze.svg` in the Notes view
- **THEN** the image opens in VS Code's image preview

#### Scenario: New image appears
- **WHEN** the user pastes an image into a note
- **THEN** the saved image appears in the note's `assets` folder in the Notes view without a manual refresh
