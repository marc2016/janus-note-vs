import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { EditorState, Extension, Facet, Range, StateEffect, StateField, TransactionSpec } from '@codemirror/state';
import { mdiCodeTags, mdiSitemapOutline } from '@mdi/js';
import { FencedBlock, findFencedBlocks } from '../../../services/markdownScan';
import { syntaxVisibilityFacet } from './livePreview';

export type MermaidView = 'code' | 'diagram';

/** Turns Mermaid code into an SVG string; throws with the Mermaid error message on invalid code. */
export interface MermaidRenderer {
  render(code: string, isDark: boolean): Promise<string>;
}

export const mermaidRendererFacet = Facet.define<MermaidRenderer, MermaidRenderer | undefined>({
  combine: (values) => values[0],
});

/** Switches the view of the block that starts at the given position. */
export const toggleMermaidView = StateEffect.define<number>();
/** Sets (or clears, without `error`) the render error of the block at `blockFrom`. */
export const setMermaidError = StateEffect.define<{ blockFrom: number; error?: string }>();
export const setMermaidTheme = StateEffect.define<boolean>();

interface MermaidState {
  blocks: FencedBlock[];
  toggles: Map<number, MermaidView>;
  errors: Map<number, string>;
  isDark: boolean;
  decorations: DecorationSet;
}

export function mermaidBlocks(text: string): FencedBlock[] {
  return findFencedBlocks(text).filter((b) => b.info === 'mermaid');
}

export function viewOfBlock(state: EditorState, blockFrom: number): MermaidView {
  const field = state.field(mermaidBlocksField);
  if (field.errors.has(blockFrom)) return 'code';
  return field.toggles.get(blockFrom) ?? (state.facet(syntaxVisibilityFacet) === 'visible' ? 'code' : 'diagram');
}

// ---------------------------------------------------------------------------
// Rendering

const svgCache = new Map<string, string>();
const lastSvgByBlock = new Map<number, string>();

export function clearMermaidCache(): void {
  svgCache.clear();
  lastSvgByBlock.clear();
}

/** Renders through the cache, so an unchanged diagram is never rendered twice. */
export async function renderDiagram(
  code: string,
  isDark: boolean,
  renderer: MermaidRenderer
): Promise<{ svg?: string; error?: string }> {
  const key = `${isDark ? 'dark' : 'light'}\n${code}`;
  const cached = svgCache.get(key);
  if (cached) return { svg: cached };
  try {
    const svg = await renderer.render(code, isDark);
    svgCache.set(key, svg);
    return { svg };
  } catch (err: any) {
    return { error: String(err?.message ?? err).trim() || 'Ungültiges Mermaid-Diagramm.' };
  }
}

/** Minimal view surface for dispatching render results (a real EditorView in the editor). */
export interface MermaidDispatchView {
  state: EditorState;
  dispatch: (spec: TransactionSpec) => void;
}

/** Records a render result for the block containing `pos`, dispatching only when the error state changes. */
export function reportRenderResult(view: MermaidDispatchView, pos: number, result: { error?: string }): void {
  const field = view.state.field(mermaidBlocksField, false);
  const block = field?.blocks.find((b) => pos >= b.from && pos <= b.to);
  if (!field || !block) return;
  if (field.errors.get(block.from) !== result.error) {
    view.dispatch({ effects: setMermaidError.of({ blockFrom: block.from, error: result.error }) });
  }
}

function blockAt(view: EditorView, dom: HTMLElement): FencedBlock | undefined {
  const pos = view.posAtDOM(dom);
  return view.state.field(mermaidBlocksField).blocks.find((b) => pos >= b.from && pos <= b.to + 1);
}

function icon(pathData: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'cm-mermaid-toggle-icon');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', pathData);
  p.setAttribute('fill', 'currentColor');
  svg.appendChild(p);
  return svg;
}

class MermaidWidget extends WidgetType {
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    readonly code: string,
    readonly isDark: boolean,
    readonly view: MermaidView,
    readonly blockFrom: number
  ) {
    super();
  }

  // The position is left out on purpose: moving a block must not re-render it
  eq(other: MermaidWidget): boolean {
    return other.code === this.code && other.isDark === this.isDark && other.view === this.view;
  }

  toDOM(editor: EditorView): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = `cm-mermaid cm-mermaid-${this.view}`;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'cm-mermaid-toggle';
    toggle.appendChild(icon(this.view === 'diagram' ? mdiCodeTags : mdiSitemapOutline));
    toggle.appendChild(document.createTextNode(this.view === 'diagram' ? 'Code' : 'Diagramm'));
    toggle.title = this.view === 'diagram' ? 'Mermaid-Code anzeigen' : 'Nur das Diagramm anzeigen';
    toggle.addEventListener('mousedown', (e) => e.preventDefault());
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      const block = blockAt(editor, wrap);
      if (block) editor.dispatch({ effects: toggleMermaidView.of(block.from) });
    });
    wrap.appendChild(toggle);

    const body = document.createElement('div');
    body.className = 'cm-mermaid-body';
    wrap.appendChild(body);

    const renderer = editor.state.facet(mermaidRendererFacet);
    if (!renderer) return wrap;

    const show = (result: { svg?: string; error?: string }) => {
      body.classList.remove('cm-mermaid-pending');
      if (result.svg) {
        body.innerHTML = result.svg;
        lastSvgByBlock.set(this.blockFrom, result.svg);
      } else {
        body.replaceChildren();
        const error = document.createElement('div');
        error.className = 'cm-mermaid-error';
        error.textContent = result.error ?? '';
        body.appendChild(error);
      }
      const block = blockAt(editor, wrap);
      if (block) reportRenderResult(editor, block.from, result);
    };

    const previous = lastSvgByBlock.get(this.blockFrom);
    if (previous) {
      // Keep the last diagram visible while the new one renders (no flicker while typing)
      body.innerHTML = previous;
      body.classList.add('cm-mermaid-pending');
    } else {
      body.textContent = 'Diagramm wird geladen …';
      body.classList.add('cm-mermaid-pending');
    }
    this.timer = setTimeout(
      () => {
        this.timer = undefined;
        void renderDiagram(this.code, this.isDark, renderer).then((result) => {
          if (wrap.isConnected) show(result);
        });
      },
      previous ? 300 : 0
    );
    return wrap;
  }

  destroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function buildDecorations(state: EditorState, value: Omit<MermaidState, 'decorations'>): DecorationSet {
  const mode = state.facet(syntaxVisibilityFacet);
  const decorations: Range<Decoration>[] = [];
  for (const block of value.blocks) {
    const view: MermaidView = value.errors.has(block.from)
      ? 'code'
      : value.toggles.get(block.from) ?? (mode === 'visible' ? 'code' : 'diagram');
    const widget = new MermaidWidget(block.code, value.isDark, view, block.from);
    if (view === 'diagram') {
      decorations.push(Decoration.replace({ widget, block: true }).range(block.from, block.to));
    } else {
      // Frame the code lines so they visually belong to the preview below
      const first = state.doc.lineAt(block.from).number;
      const last = state.doc.lineAt(block.to).number;
      for (let n = first; n <= last; n++) {
        const cls = ['cm-mermaid-code-line', n === first ? 'cm-mermaid-code-first' : ''].filter(Boolean).join(' ');
        decorations.push(Decoration.line({ class: cls }).range(state.doc.line(n).from));
      }
      decorations.push(Decoration.widget({ widget, block: true, side: 1 }).range(block.to));
    }
  }
  return Decoration.set(decorations, true);
}

function mapKeys<T>(map: Map<number, T>, mapPos: (pos: number) => number, blocks: FencedBlock[]): Map<number, T> {
  const starts = new Set(blocks.map((b) => b.from));
  const next = new Map<number, T>();
  for (const [pos, value] of map) {
    const mapped = mapPos(pos);
    if (starts.has(mapped)) next.set(mapped, value);
  }
  return next;
}

export const mermaidBlocksField = StateField.define<MermaidState>({
  create(state) {
    const base = { blocks: mermaidBlocks(state.doc.toString()), toggles: new Map(), errors: new Map(), isDark: true };
    return { ...base, decorations: buildDecorations(state, base) };
  },
  update(value, tr) {
    let { blocks, toggles, errors, isDark } = value;
    let changed = tr.startState.facet(syntaxVisibilityFacet) !== tr.state.facet(syntaxVisibilityFacet);

    if (tr.docChanged) {
      blocks = mermaidBlocks(tr.state.doc.toString());
      const mapPos = (pos: number) => tr.changes.mapPos(pos, 1);
      toggles = mapKeys(toggles, mapPos, blocks);
      errors = mapKeys(errors, mapPos, blocks);
      changed = true;
    }

    for (const effect of tr.effects) {
      if (effect.is(toggleMermaidView)) {
        const current = viewOfBlock(tr.startState, effect.value);
        toggles = new Map(toggles).set(effect.value, current === 'diagram' ? 'code' : 'diagram');
        if (current === 'code') {
          errors = new Map(errors);
          errors.delete(effect.value);
        }
        changed = true;
      } else if (effect.is(setMermaidError)) {
        errors = new Map(errors);
        if (effect.value.error) errors.set(effect.value.blockFrom, effect.value.error);
        else errors.delete(effect.value.blockFrom);
        changed = true;
      } else if (effect.is(setMermaidTheme) && effect.value !== isDark) {
        isDark = effect.value;
        changed = true;
      }
    }

    // Moving into a collapsed block by keyboard or search shows its code
    if (tr.selection && tr.isUserEvent('select') && !tr.isUserEvent('select.pointer')) {
      const head = tr.state.selection.main.head;
      const mode = tr.state.facet(syntaxVisibilityFacet);
      for (const block of blocks) {
        const view = errors.has(block.from) ? 'code' : toggles.get(block.from) ?? (mode === 'visible' ? 'code' : 'diagram');
        if (view === 'diagram' && head >= block.from && head <= block.to) {
          toggles = new Map(toggles).set(block.from, 'code');
          changed = true;
        }
      }
    }

    if (!changed) return value;
    const next = { blocks, toggles, errors, isDark };
    return { ...next, decorations: buildDecorations(tr.state, next) };
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

// ---------------------------------------------------------------------------
// Loading Mermaid

/** Renderer backed by the shipped `mermaid.min.js`, loaded on first use only. */
export function createMermaidRenderer(scriptUri: string): MermaidRenderer {
  let loading: Promise<any> | undefined;
  let initializedFor: boolean | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  let counter = 0;

  const load = () =>
    (loading ??= new Promise((resolve, reject) => {
      const existing = (window as any).mermaid;
      if (existing) return resolve(existing);
      const script = document.createElement('script');
      script.src = scriptUri;
      script.onload = () => resolve((window as any).mermaid);
      script.onerror = () => {
        loading = undefined;
        reject(new Error('Mermaid konnte nicht geladen werden.'));
      };
      document.head.appendChild(script);
    }));

  return {
    render(code, isDark) {
      // Mermaid renders one diagram at a time and is configured globally, so runs are serialized
      const run = async () => {
        const mermaid = await load();
        if (initializedFor !== isDark) {
          mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: isDark ? 'dark' : 'default' });
          initializedFor = isDark;
        }
        // parse() throws on invalid code without leaving error output in the page
        await mermaid.parse(code);
        const { svg } = await mermaid.render(`janus-mermaid-${++counter}`, code);
        return svg as string;
      };
      const result = queue.then(run, run);
      queue = result.catch(() => undefined);
      return result;
    },
  };
}

/** Renders ```mermaid blocks as diagrams with a per-block `Code`/`Diagramm` toggle. */
export function mermaidDiagrams(renderer: MermaidRenderer): Extension {
  return [mermaidRendererFacet.of(renderer), mermaidBlocksField];
}
