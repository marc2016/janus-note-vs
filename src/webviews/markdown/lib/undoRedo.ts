import { EditorView } from '@codemirror/view';
import { Extension, Prec } from '@codemirror/state';
import { redo, undo } from '@codemirror/commands';

type KeyLike = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>;

/** `undo`/`redo` for the editor's undo and redo shortcuts, otherwise undefined. */
export function undoRedoCommand(event: KeyLike, isMac: boolean): 'undo' | 'redo' | undefined {
  if (event.altKey) return undefined;
  const mod = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  if (!mod) return undefined;
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && !isMac && !event.shiftKey) return 'redo';
  return undefined;
}

const isMacPlatform = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Runs undo/redo in the editor and keeps the key press from reaching VS Code, which would
 * otherwise also undo the TextDocument and duplicate content through the sync.
 */
export function handleUndoRedoKey(view: EditorView, event: KeyboardEvent, isMac = isMacPlatform()): boolean {
  const command = undoRedoCommand(event, isMac);
  if (!command) return false;
  (command === 'undo' ? undo : redo)(view);
  event.preventDefault();
  event.stopPropagation();
  return true;
}

export function singleUndoHistory(): Extension {
  return Prec.highest(
    EditorView.domEventHandlers({
      keydown: (event, view) => handleUndoRedoKey(view, event),
    })
  );
}
