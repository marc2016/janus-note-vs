import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import {
  CalendarService,
  extractNoteEventsFromMarkdown,
  normalizeDate,
  cleanEventTitle,
} from '../src/services/calendarService';
import { FolderTasksService } from '../src/services/folderTasksService';

describe('CalendarService and Note Event Extraction', () => {
  const dummyNoteUri = vscode.Uri.file('/workspace/notes/meetings/kickoff.md');
  const dummyRootUri = vscode.Uri.file('/workspace/notes');

  it('normalizes 2-digit and 4-digit dates correctly', () => {
    expect(normalizeDate(26, 10, 24)).toBe('2026-10-24');
    expect(normalizeDate(2026, 5, 3)).toBe('2026-05-03');
    expect(normalizeDate(2026, 13, 1)).toBeNull();
    expect(normalizeDate(2026, 10, 32)).toBeNull();
  });

  it('cleans event titles by removing date tokens, times, and list prefixes', () => {
    const raw = '- 24.10.2026 14:00 Uhr Call mit Anna';
    expect(cleanEventTitle(raw, '24.10.2026', '14:00 Uhr')).toBe('Call mit Anna');

    const iso = '### @2026-10-28 Projekt-Review';
    expect(cleanEventTitle(iso, '@2026-10-28')).toBe('Projekt-Review');
  });

  it('extracts German, ISO dates, and frontmatter dates from markdown content', () => {
    const markdown = `---
date: 2026-10-20
---
# Kickoff Meeting

Here are our next dates:
- 24.10.2026 14:00 Call mit Anna
- @2026-10-28 Projekt-Review
- [ ] 05.11.2026 Release v1.0

\`\`\`typescript
// Code block with date that must be ignored
const example = "2026-12-01";
\`\`\`

End of notes.
`;

    const events = extractNoteEventsFromMarkdown(markdown, dummyNoteUri, dummyRootUri);
    expect(events).toHaveLength(4);

    // 1. Frontmatter
    expect(events[0].date).toBe('2026-10-20');
    expect(events[0].title).toBe('Kickoff Meeting');
    expect(events[0].kind).toBe('note');

    // 2. German date with time
    expect(events[1].date).toBe('2026-10-24');
    expect(events[1].time).toBe('14:00');
    expect(events[1].title).toBe('Call mit Anna');
    expect(events[1].notePath).toBe('meetings/kickoff.md');

    // 3. ISO date
    expect(events[2].date).toBe('2026-10-28');
    expect(events[2].title).toBe('Projekt-Review');

    // 4. German date with checkbox
    expect(events[3].date).toBe('2026-11-05');
    expect(events[3].title).toBe('Release v1.0');
  });

  it('ignores dates inside URLs and ignores code blocks', () => {
    const markdown = `
Check out https://github.com/org/repo/commit/2026-10-24 for details.
\`\`\`
24.10.2026 10:00 Inside Code
\`\`\`
- 25.10.2026 Real Event
`;
    const events = extractNoteEventsFromMarkdown(markdown, dummyNoteUri, dummyRootUri);
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe('2026-10-25');
    expect(events[0].title).toBe('Real Event');
  });

  it('combines markdown note events with task deadlines from tasks.json', async () => {
    const mockFolderTasksService = new FolderTasksService();
    vi.spyOn(mockFolderTasksService, 'loadAllTasks').mockResolvedValue([
      {
        folder: 'projects',
        uri: vscode.Uri.file('/workspace/notes/projects/tasks.json'),
        tasks: [
          {
            id: 'task-1',
            title: 'Pitch Deck fertigstellen',
            completed: false,
            status: 'todo',
            priority: 'high',
            dueDate: '2026-10-24',
            note: 'pitch.md',
          },
          {
            id: 'task-2',
            title: 'Task without due date',
            completed: true,
            status: 'done',
          },
        ],
      },
    ]);

    const service = new CalendarService(mockFolderTasksService);

    vi.spyOn(vscode.workspace.fs, 'readDirectory').mockImplementation(async (uri) => {
      if (uri.fsPath === '/workspace/notes') {
        return [
          ['meetings', vscode.FileType.Directory],
          ['projects', vscode.FileType.Directory],
        ];
      }
      if (uri.fsPath === '/workspace/notes/meetings') {
        return [['kickoff.md', vscode.FileType.File]];
      }
      return [];
    });

    vi.spyOn(vscode.workspace.fs, 'readFile').mockImplementation(async () => {
      return Buffer.from('- 24.10.2026 14:00 Call mit Anna\n- 2026-10-20 Kickoff', 'utf-8');
    });

    const entries = await service.loadAllCalendarEntries(dummyRootUri);
    expect(entries).toHaveLength(3);

    // Sorted chronologically: 2026-10-20, then 2026-10-24 (note), then 2026-10-24 (task or sorted)
    expect(entries[0].date).toBe('2026-10-20');
    expect(entries[0].kind).toBe('note');

    const oct24 = entries.filter((e) => e.date === '2026-10-24');
    expect(oct24).toHaveLength(2);
    expect(oct24.some((e) => e.kind === 'task' && e.title === 'Pitch Deck fertigstellen')).toBe(true);
    expect(oct24.some((e) => e.kind === 'note' && e.time === '14:00')).toBe(true);
  });

  it('emits separate due and scheduled entries for tasks without rolling over past dates', async () => {
    const mockFolderTasksService = new FolderTasksService();
    vi.spyOn(mockFolderTasksService, 'loadAllTasks').mockResolvedValue([
      {
        folder: 'projects',
        uri: vscode.Uri.file('/workspace/notes/projects/tasks.json'),
        tasks: [
          { id: 'due-only', title: 'Nur fällig', completed: false, status: 'todo', dueDate: '2026-11-03' },
          { id: 'sched-only', title: 'Steuer', completed: false, status: 'todo', scheduledDate: '2026-10-30' },
          {
            id: 'both',
            title: 'Bericht schreiben',
            completed: false,
            status: 'todo',
            scheduledDate: '2026-10-30',
            dueDate: '2026-11-03',
          },
          { id: 'invalid', title: 'Ungültig', completed: false, status: 'todo', scheduledDate: 'next week' },
          { id: 'past', title: 'Liegengeblieben', completed: false, status: 'todo', scheduledDate: '2020-01-02' },
        ] as any,
      },
    ]);
    vi.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([]);

    const service = new CalendarService(mockFolderTasksService);
    const entries = await service.loadAllCalendarEntries(dummyRootUri);
    const summary = entries.map((e) => `${e.taskId}:${e.dateKind}:${e.date}`);

    expect(summary).toEqual(
      expect.arrayContaining([
        'due-only:due:2026-11-03',
        'sched-only:scheduled:2026-10-30',
        'both:scheduled:2026-10-30',
        'both:due:2026-11-03',
        'past:scheduled:2020-01-02',
      ])
    );
    expect(entries).toHaveLength(5);
    expect(entries.some((e) => e.taskId === 'invalid')).toBe(false);
    expect(entries.some((e) => e.taskId === 'sched-only' && e.dateKind === 'due')).toBe(false);

    // Ids are unique even when one task appears on two days
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });
});
