/**
 * Per-panel bookkeeping for editor <-> TextDocument synchronization on the host side.
 *
 * - Remembers the text just applied from the webview so the resulting document change
 *   is not echoed back (the webview already has it).
 * - Remembers the last applied webview `seq`, sent as `ackSeq` with every update so the
 *   webview can ignore document states that predate its latest edit.
 */
export class WebviewSyncTracker {
  private expectedEchoText: string | undefined;
  private appliedSeq = 0;

  get lastAppliedSeq(): number {
    return this.appliedSeq;
  }

  /** Call right before applying an edit received from the webview. */
  recordWebviewEdit(text: string, seq: number | undefined): void {
    this.expectedEchoText = text;
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
    if (this.expectedEchoText !== undefined && documentText === this.expectedEchoText) {
      this.expectedEchoText = undefined;
      return false;
    }
    return true;
  }
}
