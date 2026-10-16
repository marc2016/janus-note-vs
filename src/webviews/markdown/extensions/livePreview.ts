import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view';
import { Range, Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  {
    tag: tags.monospace,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    backgroundColor: 'var(--vscode-textCodeBlock-background, rgba(128, 128, 128, 0.18))',
    padding: '1px 5px',
    borderRadius: '4px',
    fontSize: '0.9em',
  },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: 'var(--vscode-textLink-foreground, #3b82f6)', textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--vscode-textLink-foreground, #3b82f6)' },
  {
    tag: tags.processingInstruction,
    opacity: '0.4',
    fontWeight: 'normal',
    fontStyle: 'normal',
  },
]);

export const livePreviewTheme = EditorView.baseTheme({
  '.cm-line.cm-heading': {
    fontFamily: 'inherit',
  },
  '.cm-line.cm-heading-1': {
    fontSize: '1.875rem',
    fontWeight: '700',
    lineHeight: '2.25rem',
    paddingTop: '0.85rem',
    paddingBottom: '0.25rem',
  },
  '.cm-line.cm-heading-2': {
    fontSize: '1.5rem',
    fontWeight: '600',
    lineHeight: '2rem',
    paddingTop: '0.65rem',
    paddingBottom: '0.2rem',
  },
  '.cm-line.cm-heading-3': {
    fontSize: '1.25rem',
    fontWeight: '600',
    lineHeight: '1.75rem',
    paddingTop: '0.5rem',
    paddingBottom: '0.15rem',
  },
  '.cm-line.cm-heading-4': {
    fontSize: '1.125rem',
    fontWeight: '600',
    lineHeight: '1.5rem',
    paddingTop: '0.4rem',
    paddingBottom: '0.1rem',
  },
  '.cm-line.cm-heading-5': {
    fontSize: '1rem',
    fontWeight: '600',
    lineHeight: '1.35rem',
    paddingTop: '0.3rem',
    paddingBottom: '0.1rem',
  },
  '.cm-line.cm-heading-6': {
    fontSize: '0.875rem',
    fontWeight: '600',
    lineHeight: '1.25rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    paddingTop: '0.25rem',
    paddingBottom: '0.1rem',
  },
  '.cm-heading-mark': {
    opacity: '0.35',
    fontWeight: 'normal',
    letterSpacing: '0',
    transition: 'opacity 0.15s ease',
  },
  '.cm-heading-mark.cm-heading-mark-active': {
    opacity: '0.85',
  },
  '.cm-line.cm-blockquote': {
    borderLeft: '3px solid var(--vscode-textBlockQuote-border, rgba(128, 128, 128, 0.4))',
    paddingLeft: '0.75rem',
    color: 'var(--vscode-textBlockQuote-foreground, rgba(200, 200, 200, 0.85))',
    fontStyle: 'italic',
  },
  '.cm-line.cm-hr': {
    borderBottom: '1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.3))',
    color: 'transparent',
    lineHeight: '0.5rem',
    margin: '0.5rem 0',
  },
});

function buildDecorations(view: EditorView): DecorationSet {
  const builder: Range<Decoration>[] = [];
  const selection = view.state.selection.main;
  const cursorHead = selection.head;
  const cursorAnchor = selection.anchor;

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      const isCursorOnLine =
        (cursorHead >= line.from && cursorHead <= line.to) ||
        (cursorAnchor >= line.from && cursorAnchor <= line.to);

      const headingMatch = line.text.match(/^(#{1,6}\s)/);
      if (headingMatch) {
        const markerLength = headingMatch[1].length;
        const level = markerLength - 1; // hashes count

        // Line decoration for heading typography
        builder.push(
          Decoration.line({
            class: `cm-heading cm-heading-${level}`,
          }).range(line.from)
        );

        // Subtly mark the '# ' prefix without layout shift
        builder.push(
          Decoration.mark({
            class: isCursorOnLine
              ? 'cm-heading-mark cm-heading-mark-active'
              : 'cm-heading-mark',
          }).range(line.from, line.from + markerLength)
        );
      } else if (line.text.startsWith('> ') || line.text === '>') {
        builder.push(
          Decoration.line({
            class: 'cm-blockquote',
          }).range(line.from)
        );
      } else if (/^---+$/.test(line.text.trim()) || /^___+$/.test(line.text.trim()) || /^\*\*\*+$/.test(line.text.trim())) {
        builder.push(
          Decoration.line({
            class: 'cm-hr',
          }).range(line.from)
        );
      }

      if (line.to >= view.state.doc.length) break;
      pos = line.to + 1;
    }
  }

  return Decoration.set(builder, true);
}

export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

export function livePreview(): Extension {
  return [
    livePreviewTheme,
    livePreviewPlugin,
    syntaxHighlighting(markdownHighlightStyle),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  ];
}
