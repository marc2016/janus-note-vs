import * as vscode from 'vscode';

/**
 * The editor webview (CodeMirror) always works with `\n` line breaks, while a TextDocument keeps
 * the line endings of the file (possibly `\r\n`). Texts crossing the host <-> webview boundary
 * are normalized, so both sides compare and position text in the same coordinate space.
 */
export function toWebviewText(documentText: string): string {
  return documentText.replace(/\r\n?/g, '\n');
}

/** Converts webview text (`\n`) to the line endings of the document. */
export function toDocumentText(webviewText: string, eol: vscode.EndOfLine | undefined): string {
  return eol === vscode.EndOfLine.CRLF ? webviewText.replace(/\n/g, '\r\n') : webviewText;
}

/**
 * Per-panel bookkeeping for editor <-> TextDocument synchronization on the host side.
 *
 * - Remembers the text just applied from the webview so the resulting document change
 *   is not echoed back (the webview already has it).
 * - Remembers the last applied webview `seq`, sent as `ackSeq` with every update so the
 *   webview can ignore document states that predate its latest edit.
 *
 * Texts are compared with normalized line endings (see {@link toWebviewText}).
 */
export class WebviewSyncTracker {
  private expectedEchoText: string | undefined;
  private appliedSeq = 0;

  get lastAppliedSeq(): number {
    return this.appliedSeq;
  }

  /** Call right before applying an edit received from the webview. */
  recordWebviewEdit(text: string, seq: number | undefined): void {
    this.expectedEchoText = toWebviewText(text);
    this.acknowledgeSeq(seq);
  }

  /** Marks a webview edit as processed even if it did not change the document. */
  acknowledgeSeq(seq: number | undefined): void {
    if (typeof seq === 'number' && seq > this.appliedSeq) this.appliedSeq = seq;
  }

  /**
   * Returns true when a document change should be posted to the webview.
   * The first change matching the webview's own edit is swallowed as its echo.
   */
  shouldForward(documentText: string): boolean {
    if (this.expectedEchoText !== undefined && toWebviewText(documentText) === this.expectedEchoText) {
      this.expectedEchoText = undefined;
      return false;
    }
    return true;
  }
}
