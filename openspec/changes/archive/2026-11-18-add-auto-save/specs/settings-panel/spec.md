# Spec Delta

## ADDED Requirements

### Requirement: Auto-Save Controls in Settings Panel
The Settings Panel SHALL show the current `janus.autoSave` mode as a selection of `Aus`, `Nach Verzögerung` and `Bei Fokuswechsel`, and the current `janus.autoSaveDelay` in milliseconds. Changing either SHALL update the configuration immediately. The delay input SHALL be disabled unless the mode is `afterDelay`, and values below `250` SHALL be stored as `250`.

#### Scenario: Showing the stored auto-save settings
- **WHEN** the user opens the Settings Panel without having changed the auto-save settings
- **THEN** the panel shows `Nach Verzögerung` and a delay of `1000`

#### Scenario: Turning auto-save off
- **WHEN** the user selects `Aus` in the Settings Panel
- **THEN** `janus.autoSave` is `off` in configuration, the delay input is disabled, and open notes are no longer saved automatically

#### Scenario: Changing the delay
- **WHEN** the mode is `Nach Verzögerung` and the user enters `3000` as delay
- **THEN** `janus.autoSaveDelay` is `3000` in configuration and open notes save three seconds after the last edit

#### Scenario: Delay below the minimum
- **WHEN** the user enters `100` as delay
- **THEN** `janus.autoSaveDelay` is stored as `250` and the panel shows `250`

#### Scenario: Setting changed outside the panel
- **WHEN** the Settings Panel is open and the user changes `janus.autoSave` in VS Code's settings
- **THEN** the panel shows the new mode after it is opened again or refreshed
