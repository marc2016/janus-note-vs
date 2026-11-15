# Spec Delta

## ADDED Requirements

### Requirement: Linked Task Lines Are Not Extracted Again
When extracting tasks from a note with AI, the system SHALL NOT create tasks for linked task lines (as defined in `folder-tasks`). The text of linked task lines SHALL NOT be sent to the model as note content.

#### Scenario: Note with a linked task line
- **WHEN** a note contains `- [ ] Angebot schicken ^t-7f3a9k` and the paragraph `Wir müssen noch die Folien bauen.`, and the user generates tasks with AI
- **THEN** at most a task for the slides is added, and no second task for `Angebot schicken` is created
