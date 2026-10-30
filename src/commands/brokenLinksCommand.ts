import * as vscode from 'vscode';
import * as path from 'path';
import { CompanionManager } from '../companion/companionManager';
import {
  BrokenTarget,
  createMissingNote,
  missingNoteLocation,
  rankNotesBySimilarity,
  referencingNotes,
  removeBrokenLinks,
  retargetBrokenLinks,
  scanBrokenLinks,
} from '../services/brokenLinkService';
import { reportLinkUpdates } from '../services/linkRewriteService';
import { ghostKeyForTarget } from '../services/noteGraphService';

type RepairAction = 'create' | 'retarget' | 'remove' | 'open';

function relativeTo(root: vscode.Uri | undefined, uri: vscode.Uri): string {
  if (!root) return path.basename(uri.fsPath);
  const rel = path.relative(root.fsPath, uri.fsPath);
  return rel.startsWith('..') || path.isAbsolute(rel) ? uri.fsPath : rel.split(path.sep).join('/');
}

function references(count: number): string {
  return count === 1 ? '1 Verweis' : `${count} Verweise`;
}

async function pickFolder(
  notes: vscode.Uri[],
  roots: vscode.Uri[],
  primaryRoot: vscode.Uri,
  preferred: vscode.Uri | undefined
): Promise<vscode.Uri | undefined> {
  const folders = new Map<string, vscode.Uri>();
  for (const root of roots) folders.set(root.fsPath, root);
  for (const note of notes) {
    const dir = path.dirname(note.fsPath);
    if (!folders.has(dir)) folders.set(dir, vscode.Uri.file(dir));
  }
  const ordered = [...folders.values()].sort((a, b) => a.fsPath.localeCompare(b.fsPath));
  if (preferred) {
    const idx = ordered.findIndex((f) => f.fsPath === preferred.fsPath);
    if (idx > 0) ordered.unshift(...ordered.splice(idx, 1));
  }
  const picked = await vscode.window.showQuickPick(
    ordered.map((folder) => ({
      label: relativeTo(primaryRoot, folder) || path.basename(folder.fsPath),
      description: folder.fsPath === preferred?.fsPath ? 'Ordner der verlinkenden Notiz' : undefined,
      folder,
    })),
    { title: 'Notiz anlegen', placeHolder: 'In welchem Ordner soll die Notiz angelegt werden?' }
  );
  return picked?.folder;
}

/** Lets the user pick the note to point a missing target to; similar names first. */
async function pickTargetNote(
  target: BrokenTarget,
  notes: vscode.Uri[],
  primaryRoot: vscode.Uri | undefined
): Promise<vscode.Uri | undefined> {
  const picked = await vscode.window.showQuickPick(
    rankNotesBySimilarity(target.name, notes).map((uri) => ({
      label: path.basename(uri.fsPath).replace(/\.(md|markdown)$/i, ''),
      description: relativeTo(primaryRoot, uri),
      uri,
    })),
    { title: `„${target.name}“ umleiten`, placeHolder: 'Ziel-Notiz auswählen', matchOnDescription: true }
  );
  return picked?.uri;
}

/**
 * Retargets or removes the broken links to `linkTarget` in one note, e.g. after clicking a
 * missing link in the editor. Other notes linking to the same target stay unchanged.
 */
export async function repairLinkInNote(
  companionManager: CompanionManager,
  noteUri: vscode.Uri,
  linkTarget: string,
  action: 'retarget' | 'remove'
): Promise<void> {
  const primaryRoot = companionManager.getNotesRootUri(noteUri);
  const roots = companionManager.getAllNotesRoots(noteUri);
  const scan = await scanBrokenLinks(roots.length > 0 ? roots : primaryRoot ? [primaryRoot] : [], primaryRoot);
  const key = ghostKeyForTarget(linkTarget);
  const found = scan.targets.find((t) => t.key === key);
  const refs = found?.references.filter((r) => r.sourceUri.fsPath === noteUri.fsPath) ?? [];
  if (!found || refs.length === 0) {
    void vscode.window.showInformationMessage('Der Link ist nicht mehr defekt.');
    return;
  }
  const target: BrokenTarget = { ...found, references: refs };

  if (action === 'remove') {
    reportLinkUpdates(await removeBrokenLinks(target), 0);
    return;
  }
  const targetNote = await pickTargetNote(target, scan.notes, primaryRoot);
  if (!targetNote) return;
  const { result, skipped } = await retargetBrokenLinks(target, targetNote, scan, primaryRoot);
  reportLinkUpdates(result, skipped);
}

/**
 * `janus.repairBrokenLinks`: lists missing link targets and repairs the picked one by creating,
 * retargeting, unlinking or opening a reference. Repeats until nothing is left or Esc.
 */
export async function repairBrokenLinksCommand(companionManager: CompanionManager): Promise<void> {
  const primaryRoot = companionManager.getNotesRootUri();
  const roots = companionManager.getAllNotesRoots();
  if (!primaryRoot || roots.length === 0) {
    void vscode.window.showWarningMessage('Kein Notizen-Ordner konfiguriert.');
    return;
  }

  for (let round = 0; ; round++) {
    const scan = await scanBrokenLinks(roots, primaryRoot);
    if (scan.targets.length === 0) {
      void vscode.window.showInformationMessage(
        round === 0 ? 'Keine defekten Links gefunden.' : 'Alle defekten Links sind repariert.'
      );
      return;
    }

    const targetPick = await vscode.window.showQuickPick(
      scan.targets.map((target) => ({
        label: target.name,
        description: references(target.references.length),
        detail: referencingNotes(target)
          .map((uri) => relativeTo(primaryRoot, uri))
          .join(', '),
        target,
      })),
      { title: 'Defekte Links reparieren', placeHolder: 'Fehlendes Ziel auswählen', matchOnDetail: true }
    );
    if (!targetPick) return;
    const target: BrokenTarget = targetPick.target;

    const actionPick = await vscode.window.showQuickPick(
      [
        { label: '$(new-file) Notiz anlegen', action: 'create' as RepairAction },
        { label: '$(arrow-right) Auf bestehende Notiz umleiten', action: 'retarget' as RepairAction },
        { label: '$(close) Link entfernen', action: 'remove' as RepairAction, description: 'Nur der Text bleibt stehen' },
        { label: '$(go-to-file) Verweis öffnen', action: 'open' as RepairAction },
      ],
      { title: `„${target.name}“ – ${references(target.references.length)}`, placeHolder: 'Was soll passieren?' }
    );
    if (!actionPick) return;

    switch (actionPick.action) {
      case 'create': {
        let noteUri = missingNoteLocation(target, primaryRoot);
        if (!noteUri) {
          const firstSource = target.references[0]?.sourceUri;
          const folder = await pickFolder(
            scan.notes,
            roots,
            primaryRoot,
            firstSource ? vscode.Uri.file(path.dirname(firstSource.fsPath)) : undefined
          );
          if (!folder) return;
          noteUri = missingNoteLocation(target, primaryRoot, folder)!;
        }
        await createMissingNote(noteUri);
        await vscode.commands.executeCommand('vscode.openWith', noteUri, 'janus.markdownEditor');
        break;
      }
      case 'retarget': {
        const noteUri = await pickTargetNote(target, scan.notes, primaryRoot);
        if (!noteUri) return;
        const { result, skipped } = await retargetBrokenLinks(target, noteUri, scan, primaryRoot);
        reportLinkUpdates(result, skipped);
        break;
      }
      case 'remove': {
        reportLinkUpdates(await removeBrokenLinks(target), 0);
        break;
      }
      case 'open': {
        const refPick = await vscode.window.showQuickPick(
          target.references.map((ref) => ({
            label: relativeTo(primaryRoot, ref.sourceUri),
            description: `Zeile ${ref.line}`,
            ref,
          })),
          { title: `Verweise auf „${target.name}“`, placeHolder: 'Verweis öffnen' }
        );
        if (!refPick) return;
        await vscode.commands.executeCommand('janus.openNoteAtLine', refPick.ref.sourceUri, refPick.ref.line);
        break;
      }
    }
  }
}
