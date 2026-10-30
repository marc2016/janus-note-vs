---
name: finish-change
description: Wrap up an implemented OpenSpec change after the user's manual test passed - archive with spec sync, commit, tidy and extend sample/, commit. Use when the user confirms a manual test ("funktioniert", "geht", "sieht gut aus", "klappt") for a change whose only open task is the manual check, or when the user says "finish-change" or "abschließen".
---

Wrap up the change whose manual test the user just confirmed. Run all steps in one go without asking for each one; only stop on the conditions named below. Reply to the user in German.

## 1. Select the change and mark the manual test

- Use the change from the conversation; if unclear, run `openspec list --json` and ask.
- Mark the remaining manual-test task(s) in its `tasks.md` as done. If any other task is still open, stop and tell the user instead of continuing.

## 2. Archive with spec sync

Follow the archive workflow (`.claude/commands/opsx/archive.md`), with "Sync now" as the chosen option - do not ask for it. Rules for the sync, learned the hard way:

- Read each main spec completely **before** opening it for writing (never `open(p, 'w').write(open(p).read() + ...)` - that empties the file first).
- ADDED requirements are appended; MODIFIED requirements replace the requirement with the same name in full; check that the requirement count changed as expected.
- Run `openspec validate --specs --strict` and move the change to `openspec/changes/archive/YYYY-MM-DD-<name>` **only if it reports 0 failed**. Use today's date.
- Check `git diff --stat openspec/specs`: an ADDED-only sync must show insertions only.

## 3. Commit the change

- Run `npm test` first; do not commit on failures.
- Stage only the files of this change (code, tests, main specs, the archive folder) - never `git add -A`. Leave `sample/` and other planned changes out.
- Message: short conventional style (`feat: ...`, `fix: ...`), no `Co-Authored-By` or other trailer. Commit on the current branch (main); no feature branch.

## 4. Tidy and extend `sample/`

- Look at `git status sample` and every diff/new file there.
- Remove leftovers of the user's manual test (test notes, "TEST"/"Hallo" lines, broken duplicate lines, test images, empty `tasks.json`, results of trial AI runs that break the demo state). Ask first only when a change looks like intentional content rather than a test leftover.
- Keep the demo usable: notes that features act on (e.g. `inbox.md`, unsorted daily notes) must stay in their "before" state; tests read `sample/inbox.md`.
- Extend the samples so the new feature can be tried there: add or update a section in `sample/project-plan.md` (the guide) and, where useful, example content in a fitting note.
- Run `npm test`, then commit the sample changes separately as `chore: ...`.

## 5. Report

Summarize briefly in German: archive path and synced specs, both commits, what was removed from and added to `sample/`, and how many commits are not pushed yet. Do not push unless the user asks.
