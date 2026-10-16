import * as path from 'path';

export interface CompanionPaths {
  notePath: string;
  tasksPath: string;
  chartPath: string;
}

export function getCompanionPaths(notePath: string): CompanionPaths {
  const ext = path.extname(notePath);
  const basePath = ext ? notePath.slice(0, -ext.length) : notePath;

  return {
    notePath,
    tasksPath: `${basePath}.tasks.json`,
    chartPath: `${basePath}.chart.json`,
  };
}

export function isMarkdownNote(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.md' || ext === '.markdown';
}

export function isTasksCompanion(filePath: string): boolean {
  return filePath.endsWith('.tasks.json');
}

export function isChartCompanion(filePath: string): boolean {
  return filePath.endsWith('.chart.json');
}

export function getNotePathFromCompanion(companionPath: string): string | null {
  if (isTasksCompanion(companionPath)) {
    return companionPath.replace(/\.tasks\.json$/, '.md');
  }
  if (isChartCompanion(companionPath)) {
    return companionPath.replace(/\.chart\.json$/, '.md');
  }
  return null;
}
