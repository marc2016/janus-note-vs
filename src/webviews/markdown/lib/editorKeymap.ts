import { KeyBinding } from '@codemirror/view';
import { defaultKeymap, historyKeymap } from '@codemirror/commands';
import { formattingKeymap } from './formatting';
import { listIndentationKeymap } from './listIndentation';

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
