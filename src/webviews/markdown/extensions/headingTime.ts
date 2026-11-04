import { Command, EditorView, keymap } from '@codemirror/view';
import { Compartment, EditorState, Extension, Prec, StateEffect, StateField, Transaction } from '@codemirror/state';
import { isolateHistory } from '@codemirror/commands';

/**
 * Adds the time a heading was started to newly typed headings in daily notes.
 *
 * A line that becomes a `#` or `##` heading through typing is remembered together with the
 * current time. Pressing Enter at the end of that heading appends ` (HH:mm)` once; afterwards the
 * time is plain text of the heading.
 */

const HEADING_RE = /^#{1,2}\s/;
const HEADING_TEXT_RE = /^#{1,2}\s+(.*)$/;
/** A heading that already ends with a time or a sort timestamp gets no further time. */
const TIME_SUFFIX_RE = /\((?:\d{4}-\d{2}-\d{2} )?\d{2}:\d{2}\)\s*$/;

interface HeadingMarker {
  /** Start of the heading line. */
  pos: number;
  /** Local time the line became a heading, `HH:mm`. */
  time: string;
}

const removeHeadingMarker = StateEffect.define<number>();

export function formatHeadingTime(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isTypedInput(tr: Transaction): boolean {
  return (
    tr.docChanged &&
    !tr.annotation(Transaction.remote) &&
    tr.isUserEvent('input') &&
    !tr.isUserEvent('input.paste') &&
    !tr.isUserEvent('input.drop')
  );
}

export const headingTimeField = StateField.define<readonly HeadingMarker[]>({
  create: () => [],
  update(markers, tr) {
    let next = markers;
    if (tr.docChanged) {
      const doc = tr.state.doc;
      next = markers
        .map((m) => ({ ...m, pos: tr.changes.mapPos(m.pos, 1) }))
        .filter((m) => {
          const line = doc.lineAt(m.pos);
          return line.from === m.pos && HEADING_RE.test(line.text);
        });

      if (isTypedInput(tr)) {
        const inverted = tr.changes.invertedDesc;
        const time = formatHeadingTime();
        const added: HeadingMarker[] = [];
        tr.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
          for (let pos = fromB; pos <= toB; ) {
            const line = doc.lineAt(pos);
            const known = next.some((m) => m.pos === line.from) || added.some((m) => m.pos === line.from);
            if (!known && HEADING_RE.test(line.text)) {
              const oldLine = tr.startState.doc.lineAt(inverted.mapPos(line.from, -1));
              if (!HEADING_RE.test(oldLine.text)) {
                added.push({ pos: line.from, time });
              }
            }
            if (line.to >= toB) break;
            pos = line.to + 1;
          }
        });
        if (added.length) next = [...next, ...added];
      }
    }
    for (const effect of tr.effects) {
      if (effect.is(removeHeadingMarker)) {
        next = next.filter((m) => m.pos !== effect.value);
      }
    }
    return next;
  },
});

/**
 * Enter at the end of a newly typed heading: appends ` (HH:mm)` and the line break in one
 * isolated undo step. Returns false (default Enter) in every other case.
 */
export const insertHeadingTime: Command = (view: EditorView) => {
  const { state } = view;
  const markers = state.field(headingTimeField, false);
  if (!markers || state.selection.ranges.length !== 1 || !state.selection.main.empty) return false;
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  if (head !== line.to) return false;
  const marker = markers.find((m) => m.pos === line.from);
  if (!marker) return false;
  const textMatch = HEADING_TEXT_RE.exec(line.text);
  if (!textMatch || !textMatch[1].trim() || TIME_SUFFIX_RE.test(line.text)) return false;

  const end = line.from + line.text.replace(/\s+$/, '').length;
  const insert = ` (${marker.time})`;
  view.dispatch({
    changes: { from: end, to: line.to, insert: insert + state.lineBreak },
    selection: { anchor: end + insert.length + state.lineBreak.length },
    effects: removeHeadingMarker.of(line.from),
    annotations: isolateHistory.of('full'),
    userEvent: 'input',
    scrollIntoView: true,
  });
  return true;
};

/** Holds the heading time extension; enabled only for daily notes. */
export const headingTimeCompartment = new Compartment();

export function headingTime(): Extension {
  return [headingTimeField, Prec.high(keymap.of([{ key: 'Enter', run: insertHeadingTime }]))];
}

/** Exported for tests. */
export function headingMarkers(state: EditorState): readonly HeadingMarker[] {
  return state.field(headingTimeField, false) ?? [];
}
