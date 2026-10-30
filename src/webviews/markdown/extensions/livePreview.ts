import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view';
import { Range, Extension, Compartment, Facet } from '@codemirror/state';
import {
  HighlightStyle,
  syntaxHighlighting,
  defaultHighlightStyle,
  syntaxTree,
  ensureSyntaxTree,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';

export type SyntaxVisibilityMode = 'auto' | 'visible' | 'hidden';

export const syntaxVisibilityCompartment = new Compartment();
export const syntaxVisibilityFacet = Facet.define<SyntaxVisibilityMode, SyntaxVisibilityMode>({
  combine: (values) => values[0] || 'auto',
});

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
  '.cm-syntax-hidden': {
    display: 'none',
  },
  '.cm-line.cm-blockquote': {
    borderLeft: '3px solid var(--vscode-textBlockQuote-border, rgba(128, 128, 128, 0.4))',
    paddingLeft: '0.75rem',
    color: 'var(--vscode-textBlockQuote-foreground, rgba(200, 200, 200, 0.85))',
    fontStyle: 'italic',
  },
  // No vertical margins on lines: CodeMirror leaves them out of its height map, which shifts
  // clicks and cursor movement below. The rule is drawn as a centered background line instead.
  '.cm-line.cm-hr': {
    color: 'transparent',
    lineHeight: '0.5rem',
    padding: '0.5rem 0',
    background:
      'linear-gradient(var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.3)), var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.3))) center / 100% 1px no-repeat',
  },
  '.cm-link-text': {
    color: 'var(--vscode-textLink-foreground, #3b82f6)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    cursor: 'pointer',
    transition: 'color 0.15s ease',
  },
  '.cm-link-text:hover': {
    color: 'var(--vscode-textLink-activeForeground, #60a5fa)',
  },
  '.cm-link-editing': {
    // Keep cursor as pointer so users can always click links directly
    cursor: 'pointer',
  },
});

export function buildDecorations(view: EditorView): DecorationSet {
  const mode = view.state.facet(syntaxVisibilityFacet);
  const builder: Range<Decoration>[] = [];
  const selection = view.state.selection.main;
  const cursorHead = selection.head;
  const cursorAnchor = selection.anchor;

  for (const { from, to } of view.visibleRanges) {
    // 1. Line-level decorations (headings, blockquotes, hr)
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

        const shouldHide =
          mode === 'hidden' || (mode === 'auto' && !isCursorOnLine);

        // Subtly mark the '# ' prefix or conceal it
        builder.push(
          Decoration.mark({
            class: shouldHide
              ? 'cm-heading-mark cm-syntax-hidden'
              : isCursorOnLine
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

      // Inline Link Decorations: wiki-links [[Target]] or [[Target|Alias]]
      const wikiRe = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g;
      let wikiMatch: RegExpExecArray | null;
      const coveredLinkRanges: { from: number; to: number }[] = [];

      while ((wikiMatch = wikiRe.exec(line.text)) !== null) {
        const matchStart = line.from + wikiMatch.index;
        const matchEnd = matchStart + wikiMatch[0].length;
        coveredLinkRanges.push({ from: matchStart, to: matchEnd });

        const target = wikiMatch[1].trim();
        const hasAlias = Boolean(wikiMatch[2] && wikiMatch[2].trim());
        const isCursorInside =
          (cursorHead >= matchStart && cursorHead <= matchEnd) ||
          (cursorAnchor >= matchStart && cursorAnchor <= matchEnd);
        const shouldHide = mode === 'hidden' || (mode === 'auto' && !isCursorInside);

        if (hasAlias) {
          const pipeIndex = wikiMatch[0].indexOf('|');
          const pipePos = matchStart + pipeIndex;

          if (shouldHide) {
            builder.push(
              Decoration.mark({ class: 'cm-syntax-hidden' }).range(matchStart, pipePos + 1)
            );
            builder.push(
              Decoration.mark({
                class: 'cm-link-text',
                attributes: {
                  'data-link-target': target,
                  'data-link-type': 'wiki',
                },
              }).range(pipePos + 1, matchEnd - 2)
            );
            builder.push(
              Decoration.mark({ class: 'cm-syntax-hidden' }).range(matchEnd - 2, matchEnd)
            );
          } else {
            builder.push(
              Decoration.mark({
                class: isCursorInside ? 'cm-link-text cm-link-editing' : 'cm-link-text',
                attributes: {
                  'data-link-target': target,
                  'data-link-type': 'wiki',
                },
              }).range(matchStart + 2, matchEnd - 2)
            );
          }
        } else {
          if (shouldHide) {
            builder.push(
              Decoration.mark({ class: 'cm-syntax-hidden' }).range(matchStart, matchStart + 2)
            );
            builder.push(
              Decoration.mark({
                class: 'cm-link-text',
                attributes: {
                  'data-link-target': target,
                  'data-link-type': 'wiki',
                },
              }).range(matchStart + 2, matchEnd - 2)
            );
            builder.push(
              Decoration.mark({ class: 'cm-syntax-hidden' }).range(matchEnd - 2, matchEnd)
            );
          } else {
            builder.push(
              Decoration.mark({
                class: isCursorInside ? 'cm-link-text cm-link-editing' : 'cm-link-text',
                attributes: {
                  'data-link-target': target,
                  'data-link-type': 'wiki',
                },
              }).range(matchStart + 2, matchEnd - 2)
            );
          }
        }
      }

      // Inline Link Decorations: Markdown links [Label](target)
      const mdLinkRe = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;
      let mdMatch: RegExpExecArray | null;
      while ((mdMatch = mdLinkRe.exec(line.text)) !== null) {
        const matchStart = line.from + mdMatch.index;
        const matchEnd = matchStart + mdMatch[0].length;
        coveredLinkRanges.push({ from: matchStart, to: matchEnd });

        const label = mdMatch[1];
        const target = mdMatch[2].trim();
        const labelStart = matchStart + 1;
        const labelEnd = labelStart + label.length;

        const isCursorInside =
          (cursorHead >= matchStart && cursorHead <= matchEnd) ||
          (cursorAnchor >= matchStart && cursorAnchor <= matchEnd);
        const shouldHide = mode === 'hidden' || (mode === 'auto' && !isCursorInside);
        const linkType = target.startsWith('http') ? 'external' : 'markdown';

        if (shouldHide) {
          builder.push(
            Decoration.mark({ class: 'cm-syntax-hidden' }).range(matchStart, labelStart)
          );
          builder.push(
            Decoration.mark({
              class: 'cm-link-text',
              attributes: {
                'data-link-target': target,
                'data-link-type': linkType,
              },
            }).range(labelStart, labelEnd)
          );
          builder.push(
            Decoration.mark({ class: 'cm-syntax-hidden' }).range(labelEnd, matchEnd)
          );
        } else {
          builder.push(
            Decoration.mark({
              class: isCursorInside ? 'cm-link-text cm-link-editing' : 'cm-link-text',
              attributes: {
                'data-link-target': target,
                'data-link-type': linkType,
              },
            }).range(labelStart, labelEnd)
          );
        }
      }

      // Inline Link Decorations: Bare external URLs https://... or http://...
      const bareUrlRe = /(?<![(\[="])\bhttps?:\/\/[^\s<>)\]]+/g;
      let urlMatch: RegExpExecArray | null;
      while ((urlMatch = bareUrlRe.exec(line.text)) !== null) {
        const urlStart = line.from + urlMatch.index;
        const urlEnd = urlStart + urlMatch[0].length;
        const isCovered = coveredLinkRanges.some((r) => urlStart >= r.from && urlEnd <= r.to);
        if (!isCovered) {
          builder.push(
            Decoration.mark({
              class: 'cm-link-text',
              attributes: {
                'data-link-target': urlMatch[0],
                'data-link-type': 'external',
              },
            }).range(urlStart, urlEnd)
          );
        }
      }

      if (line.to >= view.state.doc.length) break;
      pos = line.to + 1;
    }

    // 2. Inline token decorations via syntax tree
    const tree = ensureSyntaxTree(view.state, to, 50) || syntaxTree(view.state);
    tree.iterate({
      from,
      to,
      enter: (node) => {
        if (node.name === 'StrongEmphasis') {
          const isCursorInside =
            (cursorHead >= node.from && cursorHead <= node.to) ||
            (cursorAnchor >= node.from && cursorAnchor <= node.to);
          const shouldHide =
            mode === 'hidden' || (mode === 'auto' && !isCursorInside);

          if (shouldHide && node.to - node.from >= 4) {
            builder.push(
              Decoration.mark({ class: 'cm-inline-mark cm-syntax-hidden' }).range(
                node.from,
                node.from + 2
              )
            );
            builder.push(
              Decoration.mark({ class: 'cm-inline-mark cm-syntax-hidden' }).range(
                node.to - 2,
                node.to
              )
            );
          }
        } else if (node.name === 'Emphasis') {
          const isCursorInside =
            (cursorHead >= node.from && cursorHead <= node.to) ||
            (cursorAnchor >= node.from && cursorAnchor <= node.to);
          const shouldHide =
            mode === 'hidden' || (mode === 'auto' && !isCursorInside);

          if (shouldHide && node.to - node.from >= 2) {
            builder.push(
              Decoration.mark({ class: 'cm-inline-mark cm-syntax-hidden' }).range(
                node.from,
                node.from + 1
              )
            );
            builder.push(
              Decoration.mark({ class: 'cm-inline-mark cm-syntax-hidden' }).range(
                node.to - 1,
                node.to
              )
            );
          }
        } else if (node.name === 'Strikethrough') {
          const isCursorInside =
            (cursorHead >= node.from && cursorHead <= node.to) ||
            (cursorAnchor >= node.from && cursorAnchor <= node.to);
          const shouldHide =
            mode === 'hidden' || (mode === 'auto' && !isCursorInside);

          if (shouldHide && node.to - node.from >= 4) {
            builder.push(
              Decoration.mark({ class: 'cm-inline-mark cm-syntax-hidden' }).range(
                node.from,
                node.from + 2
              )
            );
            builder.push(
              Decoration.mark({ class: 'cm-inline-mark cm-syntax-hidden' }).range(
                node.to - 2,
                node.to
              )
            );
          }
        } else if (node.name === 'InlineCode') {
          const isCursorInside =
            (cursorHead >= node.from && cursorHead <= node.to) ||
            (cursorAnchor >= node.from && cursorAnchor <= node.to);
          const shouldHide =
            mode === 'hidden' || (mode === 'auto' && !isCursorInside);

          if (shouldHide && node.to - node.from >= 2) {
            let backticks = 1;
            while (
              node.from + backticks < node.to &&
              view.state.sliceDoc(node.from + backticks, node.from + backticks + 1) === '`'
            ) {
              backticks++;
            }
            builder.push(
              Decoration.mark({ class: 'cm-inline-mark cm-syntax-hidden' }).range(
                node.from,
                node.from + backticks
              )
            );
            builder.push(
              Decoration.mark({ class: 'cm-inline-mark cm-syntax-hidden' }).range(
                node.to - backticks,
                node.to
              )
            );
          }
        }
      },
    });
  }

  builder.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(builder, true);
}

export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        update.state.facet(syntaxVisibilityFacet) !== update.startState.facet(syntaxVisibilityFacet)
      ) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

export function livePreview(initialMode: SyntaxVisibilityMode = 'auto'): Extension {
  return [
    livePreviewTheme,
    livePreviewPlugin,
    syntaxVisibilityCompartment.of(syntaxVisibilityFacet.of(initialMode)),
    syntaxHighlighting(markdownHighlightStyle),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  ];
}
