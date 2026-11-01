import * as vscode from 'vscode';
import * as path from 'path';

/** What one sort run changed, so it can be undone. Texts are the full file contents read and written. */
export interface InboxSortUndoRecord {
  source: {
    uri: vscode.Uri;
    kind: 'inbox' | 'daily';
    textBefore: string;
    textAfter: string;
    /** Original text of every block written to a target (inbox only). */
    removedBlocks: string[];
    /** Inserted `-> [[target]]` lines (daily note only). */
    links: string[];
  };
  /** One entry per existing note; `sections` are the exact appended strings including their leading separator. */
  appended: Array<{ uri: vscode.Uri; textBefore: string; textAfter: string; sections: string[] }>;
  created: Array<{ uri: vscode.Uri; text: string }>;
  /** Folders the run created, deepest first. */
  createdFolders: vscode.Uri[];
}

export interface UndoReport {
  undone: number;
  /** Notes left unchanged because they were edited after the sort, relative to the notes root when possible. */
  keptNotes: string[];
}

let lastRun: InboxSortUndoRecord | undefined;

export function rememberSortRun(record: InboxSortUndoRecord | undefined): void {
  if (record) {
    lastRun = record;
  }
}

export function hasSortRunToUndo(): boolean {
  return lastRun !== undefined;
}

/** Test hook: forgets the remembered run. */
export function __resetSortUndo(): void {
  lastRun = undefined;
}

function openDocumentFor(uri: vscode.Uri): vscode.TextDocument | undefined {
  const target = path.normalize(uri.fsPath);
  return vscode.workspace.textDocuments.find((doc) => path.normalize(doc.uri.fsPath) === target);
}

/** Reads a note, preferring the text of an open editor (including unsaved changes). */
export async function readNoteText(uri: vscode.Uri): Promise<string | undefined> {
  const doc = openDocumentFor(uri);
  if (doc) {
    return doc.getText();
  }
  try {
    return Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf-8');
  } catch {
    return undefined;
  }
}

/** Writes a note to disk and replaces the text of an open editor, so both show the same content. */
export async function writeNoteText(
  uri: vscode.Uri,
  text: string,
  openDoc: vscode.TextDocument | undefined = openDocumentFor(uri)
): Promise<void> {
  await vscode.workspace.fs.writeFile(uri, Buffer.from(text, 'utf-8'));
  if (openDoc) {
    const currentDocText = openDoc.getText();
    if (currentDocText !== text && typeof openDoc.positionAt === 'function') {
      const fullRange = new vscode.Range(openDoc.positionAt(0), openDoc.positionAt(currentDocText.length));
      const edit = new vscode.WorkspaceEdit();
      edit.replace(openDoc.uri, fullRange, text);
      await vscode.workspace.applyEdit(edit);
    }
  }
}

function removeOnce(text: string, part: string): string | undefined {
  const first = text.indexOf(part);
  if (first === -1 || text.indexOf(part, first + 1) !== -1) {
    return undefined;
  }
  return text.slice(0, first) + text.slice(first + part.length);
}

/** Removes the first `-> [[target]]` line of each link together with the blank line above it. */
function removeLinkLines(text: string, links: string[]): string {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  for (const link of links) {
    const idx = lines.findIndex((line, i) => line === link && i > 0 && lines[i - 1].trim() === '');
    if (idx !== -1) {
      lines.splice(idx - 1, 2);
    }
  }
  return lines.join(eol);
}

async function isEmptyFolder(uri: vscode.Uri): Promise<boolean> {
  try {
    return (await vscode.workspace.fs.readDirectory(uri)).length === 0;
  } catch {
    return false;
  }
}

function displayPath(uri: vscode.Uri, sourceUri: vscode.Uri, kind: 'inbox' | 'daily'): string {
  // The source note lies in the notes root (inbox) or one folder below it (journal)
  const root = kind === 'inbox' ? path.dirname(sourceUri.fsPath) : path.dirname(path.dirname(sourceUri.fsPath));
  return path.relative(root, uri.fsPath).replace(/\\/g, '/');
}

/**
 * Undoes the remembered sort run once. Text written after the sort is never removed: edited notes
 * are kept and reported, and an edited inbox gets the sorted blocks back at its end.
 */
export async function undoLastSortRun(): Promise<UndoReport | undefined> {
  const run = lastRun;
  if (!run) {
    return undefined;
  }
  lastRun = undefined;

  const report: UndoReport = { undone: 0, keptNotes: [] };
  const name = (uri: vscode.Uri) => displayPath(uri, run.source.uri, run.source.kind);

  // Appended sections first: a note created by the run may have received further sections
  for (const note of run.appended) {
    const current = await readNoteText(note.uri);
    if (current === undefined) {
      report.keptNotes.push(name(note.uri));
      continue;
    }
    let restored: string | undefined = current === note.textAfter ? note.textBefore : current;
    if (current !== note.textAfter) {
      for (const section of note.sections) {
        restored = restored === undefined ? undefined : removeOnce(restored, section);
      }
    }
    if (restored === undefined) {
      report.keptNotes.push(name(note.uri));
      continue;
    }
    await writeNoteText(note.uri, restored);
    report.undone += note.sections.length;
  }

  for (const note of run.created) {
    const current = await readNoteText(note.uri);
    if (current === undefined) {
      continue;
    }
    // A created note that also got appended sections is back at its created text by now
    if (current !== note.text) {
      report.keptNotes.push(name(note.uri));
      continue;
    }
    await vscode.workspace.fs.delete(note.uri);
    report.undone += 1;
  }

  for (const folder of run.createdFolders) {
    if (await isEmptyFolder(folder)) {
      await vscode.workspace.fs.delete(folder);
    }
  }

  const { source } = run;
  const currentSource = (await readNoteText(source.uri)) ?? '';
  let restoredSource: string;
  if (currentSource === source.textAfter) {
    restoredSource = source.textBefore;
  } else if (source.kind === 'daily') {
    restoredSource = removeLinkLines(currentSource, source.links);
  } else {
    const kept = currentSource.replace(/\s+$/, '');
    restoredSource = `${[kept, ...source.removedBlocks].join('\n\n')}\n`;
  }
  if (restoredSource !== currentSource) {
    await writeNoteText(source.uri, restoredSource);
  }

  report.keptNotes = [...new Set(report.keptNotes)];
  return report;
}
