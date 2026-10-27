import { ChangeSet, Transaction } from '@codemirror/state';

export interface TextChange {
  from: number;
  to: number;
  insert: string;
}

/**
 * Computes a single replacement turning `oldText` into `newText` by trimming the
 * common prefix and suffix. Returns null when both texts are identical.
 */
export function minimalChange(oldText: string, newText: string): TextChange | null {
  if (oldText === newText) return null;

  let start = 0;
  const maxStart = Math.min(oldText.length, newText.length);
  while (start < maxStart && oldText.charCodeAt(start) === newText.charCodeAt(start)) start++;

  let oldEnd = oldText.length;
  let newEnd = newText.length;
  while (oldEnd > start && newEnd > start && oldText.charCodeAt(oldEnd - 1) === newText.charCodeAt(newEnd - 1)) {
    oldEnd--;
    newEnd--;
  }

  // Never split a UTF-16 surrogate pair.
  if (start > 0 && isHighSurrogate(oldText.charCodeAt(start - 1))) start--;
  if (oldEnd < oldText.length && isLowSurrogate(oldText.charCodeAt(oldEnd))) {
    oldEnd++;
    newEnd++;
  }

  return { from: start, to: oldEnd, insert: newText.slice(start, newEnd) };
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

/**
 * Tracks synchronization between the editor and the host TextDocument.
 *
 * - `lastSynced` is the text both sides agreed on most recently.
 * - `pending` holds local edits made since `lastSynced` that were not sent yet.
 * - Outgoing edits carry an increasing `seq`; host updates carry the last applied
 *   `seq` as `ackSeq`, so updates produced before the latest sent edit can be ignored.
 */
export class DocumentSync {
  private lastSynced = '';
  private pending: ChangeSet = ChangeSet.empty(0);
  private seq = 0;

  get lastSentSeq(): number {
    return this.seq;
  }

  get hasPending(): boolean {
    return !this.pending.empty;
  }

  /** Starts over from a document state both sides share (initial load). */
  reset(content: string): void {
    this.lastSynced = content;
    this.pending = ChangeSet.empty(content.length);
  }

  /** Records a local (user) transaction's changes. */
  recordLocal(changes: ChangeSet): void {
    this.pending = this.pending.compose(changes);
  }

  /**
   * Records the user edits among `transactions`, skipping remote (host) changes.
   * Returns true when at least one local edit was recorded.
   */
  recordLocalTransactions(transactions: readonly Transaction[]): boolean {
    let recorded = false;
    for (const tr of transactions) {
      if (tr.docChanged && !tr.annotation(Transaction.remote)) {
        this.recordLocal(tr.changes);
        recorded = true;
      }
    }
    return recorded;
  }

  /** Marks the current editor text as sent and returns the message payload. */
  takeOutgoing(currentText: string): { content: string; seq: number } {
    this.seq++;
    this.lastSynced = currentText;
    this.pending = ChangeSet.empty(currentText.length);
    return { content: currentText, seq: this.seq };
  }

  /**
   * Converts a host update into changes to apply to the editor, or null when the update
   * is stale (does not include the latest sent edit) or brings nothing new.
   * External changes are rebased onto local edits that have not been sent yet.
   */
  applyRemote(content: string, ackSeq: number | undefined): ChangeSet | null {
    if (ackSeq !== undefined && ackSeq < this.seq) return null;

    const change = minimalChange(this.lastSynced, content);
    if (!change) return null;

    const remote = ChangeSet.of([change], this.lastSynced.length);
    this.lastSynced = content;

    if (this.pending.empty) {
      this.pending = ChangeSet.empty(content.length);
      return remote;
    }

    const rebased = remote.map(this.pending);
    this.pending = this.pending.map(remote, true);
    return rebased;
  }
}
