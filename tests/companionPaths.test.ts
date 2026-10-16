import { describe, it, expect } from 'vitest';
import {
  getCompanionPaths,
  isMarkdownNote,
  isTasksCompanion,
  isChartCompanion,
  getNotePathFromCompanion
} from '../src/companion/companionPaths';

describe('Companion Paths & Pairing', () => {
  it('computes companion paths for a markdown file', () => {
    const paths = getCompanionPaths('/workspace/notes/project.md');
    expect(paths.tasksPath).toBe('/workspace/notes/project.tasks.json');
    expect(paths.chartPath).toBe('/workspace/notes/project.chart.json');
  });

  it('identifies markdown notes and companion files', () => {
    expect(isMarkdownNote('doc.md')).toBe(true);
    expect(isMarkdownNote('doc.markdown')).toBe(true);
    expect(isMarkdownNote('doc.txt')).toBe(false);

    expect(isTasksCompanion('doc.tasks.json')).toBe(true);
    expect(isTasksCompanion('doc.json')).toBe(false);

    expect(isChartCompanion('doc.chart.json')).toBe(true);
    expect(isChartCompanion('doc.tasks.json')).toBe(false);
  });

  it('resolves note path from companion paths', () => {
    expect(getNotePathFromCompanion('/a/b/c.tasks.json')).toBe('/a/b/c.md');
    expect(getNotePathFromCompanion('/a/b/c.chart.json')).toBe('/a/b/c.md');
    expect(getNotePathFromCompanion('/a/b/c.other.json')).toBeNull();
  });
});
