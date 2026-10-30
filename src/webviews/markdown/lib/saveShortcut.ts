import { EditorView } from '@codemirror/view';
import { Extension, Prec } from '@codemirror/state';

type KeyLike = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>;

/** True for `Cmd+S` on macOS and `Ctrl+S` elsewhere (no Shift/Alt). */
export function isSaveKey(event: KeyLike, isMac: boolean): boolean {
  if (event.altKey || event.shiftKey || event.key.toLowerCase() !== 's') return false;
  return isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

const isMacPlatform = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Saves through the editor (pending edits first) and keeps the key press from VS Code, which
 * would otherwise save the document before the editor's last edits arrived.
 */
export function handleSaveKey(event: KeyboardEvent, onSave: () => void, isMac = isMacPlatform()): boolean {
  if (!isSaveKey(event, isMac)) return false;
  event.preventDefault();
  event.stopPropagation();
  onSave();
  return true;
}

export function saveShortcut(onSave: () => void): Extension {
  return Prec.highest(EditorView.domEventHandlers({ keydown: (event) => handleSaveKey(event, onSave) }));
}
