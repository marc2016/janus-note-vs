# Tasks

## 1. VS Code Configuration & Settings Contribution

- [x] 1.1 Add `janus.notesRoot` configuration property and description to `package.json` under `contributes.configuration`
- [x] 1.2 Implement notes root resolution helper methods (`getNotesRootUri`, `isUnderNotesRoot`, `resolveRelativeNotesPath`) in `src/companion/companionManager.ts` and verify with unit tests

## 2. Explorer Context Menu & Commands

- [x] 2.1 Register `janus.setNotesRoot` and `janus.resetNotesRoot` commands with explorer context menu contributions in `package.json` and `src/extension.ts`
- [x] 2.2 Implement command handlers to compute relative folder path and update workspace configuration target, verifying via unit tests
- [x] 2.3 When setting notes root, inspect directory for non-note files and prompt user to create a dedicated subfolder (default `notes`), verified with unit tests

## 3. Dynamic Configuration Listening & Verification

- [x] 3.1 Subscribe to `vscode.workspace.onDidChangeConfiguration` to update `CompanionManager` and refresh CodeLens upon settings changes
- [x] 3.2 Run unit tests (`npm test`) and verify all tests pass without regressions
- [x] 3.3 Run full build (`npm run build`) and verify compilation succeeds
