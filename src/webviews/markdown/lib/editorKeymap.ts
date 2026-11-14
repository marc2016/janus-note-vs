import { Extension, Prec } from '@codemirror/state';
import { KeyBinding, keymap } from '@codemirror/view';
import { defaultKeymap, historyKeymap } from '@codemirror/commands';
import { formattingKeymap } from './formatting';
import { listEnterKeymap, listIndentationKeymap } from './listIndentation';

/**
 * Key bindings of the Janus Markdown Editor, in lookup order.
 * `defaultKeymap` intentionally leaves Tab unbound; the list-aware indentation bindings come last
 * so that more specific handlers (tables, autocomplete) keep priority.
 */
export const markdownEditorKeymap: readonly KeyBinding[] = [
  ...formattingKeymap,
  ...defaultKeymap,
  ...historyKeymap,
  ...listIndentationKeymap,
];

/**
 * Key binding extensions of the editor. Must be registered before `markdown()`: the list Enter
 * bindings share `Prec.high` with the Markdown keymap and win only because they come first.
 */
export function markdownEditorKeymapExtensions(): Extension {
  return [keymap.of(markdownEditorKeymap), Prec.high(keymap.of(listEnterKeymap))];
}
