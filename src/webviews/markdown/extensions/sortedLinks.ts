import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { Compartment, Extension, Range, StateEffect, StateField } from '@codemirror/state';
import { mdiCheck, mdiInboxArrowDown, mdiLinkOff } from '@mdi/js';
import { findSortedLinks } from '../../../services/sortedLinkScan';
import type { SortedLinkInfo } from '../../../services/sortedLinkService';
import { syntaxVisibilityFacet } from './livePreview';

/** Replaces the resolved display data for the link lines (sent by the host). */
export const setSortedLinks = StateEffect.define<SortedLinkInfo[]>();

export const sortedLinksField = StateField.define<Map<string, SortedLinkInfo>>({
  create: () => new Map(),
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSortedLinks)) {
        value = new Map(effect.value.map((info) => [info.target, info]));
      }
    }
    return value;
  },
});

/** Holds the card rendering; enabled only for daily notes. */
export const sortedLinksCompartment = new Compartment();

type OpenHandler = (target: string, line?: number) => void;

/** Display data before the host has answered: title from the last path segment. */
function fallbackInfo(target: string): SortedLinkInfo {
  const segments = target.split('/');
  return {
    target,
    title: segments[segments.length - 1],
    folder: segments.slice(0, -1).join(' / '),
    exists: true,
  };
}

function icon(pathData: string, className: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', className);
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', pathData);
  p.setAttribute('fill', 'currentColor');
  svg.appendChild(p);
  return svg;
}

function span(className: string, text: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

abstract class SortedLinkWidget extends WidgetType {
  constructor(
    readonly info: SortedLinkInfo,
    readonly onOpen: OpenHandler
  ) {
    super();
  }

  eq(other: SortedLinkWidget): boolean {
    return JSON.stringify(this.info) === JSON.stringify(other.info);
  }

  protected wireClick(el: HTMLElement): void {
    el.addEventListener('mousedown', (e) => {
      if (e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
    });
    el.addEventListener('click', (e) => {
      if (e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      this.onOpen(this.info.target, this.info.exists ? this.info.line : undefined);
    });
  }

  // Alt+Click places the cursor (and reveals the raw line) like on links
  ignoreEvent(event: Event): boolean {
    return event instanceof MouseEvent ? !event.altKey : false;
  }
}

class SortedLinkCardWidget extends SortedLinkWidget {
  toDOM(): HTMLElement {
    const card = document.createElement('span');
    card.className = this.info.exists ? 'cm-sorted-card' : 'cm-sorted-card cm-sorted-card-missing';
    card.title = this.info.exists ? `${this.info.target} öffnen` : `${this.info.target} existiert nicht`;
    card.setAttribute('data-sorted-target', this.info.target);
    card.appendChild(icon(this.info.exists ? mdiInboxArrowDown : mdiLinkOff, 'cm-sorted-card-icon'));
    if (this.info.exists) {
      card.appendChild(span('cm-sorted-card-label', 'Einsortiert in'));
      card.appendChild(span('cm-sorted-card-title', this.info.title));
      if (this.info.folder) card.appendChild(span('cm-sorted-card-folder', this.info.folder));
    } else {
      card.appendChild(span('cm-sorted-card-label', 'Ziel nicht gefunden'));
      card.appendChild(span('cm-sorted-card-folder', this.info.target));
    }
    this.wireClick(card);
    return card;
  }
}

class SortedLinkBadgeWidget extends SortedLinkWidget {
  toDOM(): HTMLElement {
    const badge = document.createElement('span');
    badge.className = this.info.exists ? 'cm-sorted-badge' : 'cm-sorted-badge cm-sorted-badge-missing';
    badge.title = `Einsortiert in ${this.info.title}`;
    badge.appendChild(icon(this.info.exists ? mdiCheck : mdiLinkOff, 'cm-sorted-badge-icon'));
    badge.appendChild(span('cm-sorted-badge-title', this.info.title));
    this.wireClick(badge);
    return badge;
  }
}

export function buildSortedLinkDecorations(view: EditorView, onOpen: OpenHandler): DecorationSet {
  const { state } = view;
  const mode = state.facet(syntaxVisibilityFacet);
  const infos = state.field(sortedLinksField, false) ?? new Map<string, SortedLinkInfo>();
  const { head, anchor } = state.selection.main;
  const decorations: Range<Decoration>[] = [];

  for (const link of findSortedLinks(state.doc.toString())) {
    const info = infos.get(link.target) ?? fallbackInfo(link.target);
    const line = state.doc.line(link.line + 1);
    const cursorOnLine = (head >= line.from && head <= line.to) || (anchor >= line.from && anchor <= line.to);

    decorations.push(Decoration.line({ class: 'cm-sorted-link-line' }).range(line.from));
    if (mode !== 'visible' && !cursorOnLine) {
      decorations.push(
        Decoration.replace({ widget: new SortedLinkCardWidget(info, onOpen) }).range(line.from, line.to)
      );
    }
    if (link.headingLine !== undefined) {
      const headingLine = state.doc.line(link.headingLine + 1);
      decorations.push(
        Decoration.widget({ widget: new SortedLinkBadgeWidget(info, onOpen), side: 1 }).range(headingLine.to)
      );
    }
  }

  return Decoration.set(decorations, true);
}

const sortedLinksTheme = EditorView.baseTheme({
  '.cm-sorted-card': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 10px 3px 8px',
    borderRadius: '6px',
    borderLeft: '3px solid var(--vscode-testing-iconPassed, #3fb950)',
    background: 'var(--vscode-textBlockQuote-background, rgba(127,127,127,0.1))',
    fontSize: '0.9em',
    lineHeight: '1.5',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background 120ms ease',
  },
  '.cm-sorted-card:hover': {
    background: 'var(--vscode-list-hoverBackground, rgba(127,127,127,0.2))',
  },
  '.cm-sorted-card-icon': {
    width: '15px',
    height: '15px',
    color: 'var(--vscode-testing-iconPassed, #3fb950)',
    flexShrink: '0',
  },
  '.cm-sorted-card-label': {
    opacity: '0.7',
  },
  '.cm-sorted-card-title': {
    fontWeight: '600',
    color: 'var(--vscode-textLink-foreground, #3794ff)',
  },
  '.cm-sorted-card-folder': {
    opacity: '0.55',
    fontSize: '0.9em',
  },
  '.cm-sorted-card-missing': {
    borderLeft: '3px dashed var(--vscode-errorForeground, #f14c4c)',
    cursor: 'default',
  },
  '.cm-sorted-card-missing .cm-sorted-card-icon': {
    color: 'var(--vscode-errorForeground, #f14c4c)',
  },
  '.cm-sorted-badge': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    marginLeft: '10px',
    padding: '0 7px 0 4px',
    borderRadius: '999px',
    verticalAlign: 'middle',
    fontSize: '11px',
    fontWeight: '500',
    lineHeight: '18px',
    background: 'var(--vscode-badge-background, rgba(63,185,80,0.18))',
    color: 'var(--vscode-badge-foreground, inherit)',
    cursor: 'pointer',
    userSelect: 'none',
  },
  '.cm-sorted-badge-icon': {
    width: '12px',
    height: '12px',
  },
  '.cm-sorted-badge-missing': {
    background: 'transparent',
    border: '1px dashed var(--vscode-errorForeground, #f14c4c)',
  },
});

/** Renders `-> [[target]]` lines of a daily note as cards and marks the block headings. */
export function sortedLinks(options: { onOpen: OpenHandler }): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildSortedLinkDecorations(view, options.onOpen);
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged ||
          update.startState.field(sortedLinksField, false) !== update.state.field(sortedLinksField, false) ||
          update.startState.facet(syntaxVisibilityFacet) !== update.state.facet(syntaxVisibilityFacet)
        ) {
          this.decorations = buildSortedLinkDecorations(update.view, options.onOpen);
        }
      }
    },
    { decorations: (v) => v.decorations }
  );
  return [sortedLinksTheme, plugin];
}
