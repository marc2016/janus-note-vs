import * as vscode from 'vscode';
import * as path from 'path';

export class DiffContentProvider implements vscode.TextDocumentContentProvider {
  public static readonly scheme = 'janus-proposed';
  private contents = new Map<string, string>();
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChange = this._onDidChange.event;

  public setContent(uri: vscode.Uri, text: string): void {
    this.contents.set(uri.toString(), text);
    this._onDidChange.fire(uri);
  }

  public clearContent(uri: vscode.Uri): void {
    this.contents.delete(uri.toString());
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contents.get(uri.toString()) || '';
  }
}

export class NoteDiffViewer {
  constructor(private contentProvider: DiffContentProvider) {}

  /**
   * Displays a side-by-side diff between the current note and proposed changes,
   * asking the user for confirmation before applying.
   */
  async proposeNoteModification(
    noteUri: vscode.Uri,
    proposedContent: string,
    reason?: string
  ): Promise<boolean> {
    const proposedUri = vscode.Uri.from({
      scheme: DiffContentProvider.scheme,
      path: noteUri.path,
      query: `t=${Date.now()}`,
    });

    this.contentProvider.setContent(proposedUri, proposedContent);

    const title = `Janus Proposal: ${path.basename(noteUri.fsPath)} (Preview)`;

    // Open diff editor
    await vscode.commands.executeCommand('vscode.diff', noteUri, proposedUri, title, {
      preview: true,
    });

    const promptMessage = reason
      ? `Janus proposes changes: "${reason}". Apply to note?`
      : `Apply proposed changes to ${path.basename(noteUri.fsPath)}?`;

    const choice = await vscode.window.showInformationMessage(promptMessage, 'Apply Changes', 'Discard');

    if (choice === 'Apply Changes') {
      const doc = await vscode.workspace.openTextDocument(noteUri);
      const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));

      const edit = new vscode.WorkspaceEdit();
      edit.replace(noteUri, fullRange, proposedContent);
      const success = await vscode.workspace.applyEdit(edit);

      this.contentProvider.clearContent(proposedUri);
      return success;
    }

    this.contentProvider.clearContent(proposedUri);
    return false;
  }
}
