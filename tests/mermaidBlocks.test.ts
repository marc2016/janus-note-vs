import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorState, TransactionSpec } from '@codemirror/state';
import { livePreview } from '../src/webviews/markdown/extensions/livePreview';
import {
  clearMermaidCache,
  mermaidBlocksField,
  mermaidDiagrams,
  renderDiagram,
  reportRenderResult,
  setMermaidTheme,
  toggleMermaidView,
  viewOfBlock,
} from '../src/webviews/markdown/extensions/mermaidBlocks';

const doc = '# Notiz\n\n```mermaid\ngraph TD;\n    A-->B;\n```\n\nEnde\n```js\nconst a = 1;\n```\n';
const blockFrom = doc.indexOf('```mermaid');
const blockTo = doc.indexOf('```\n\nEnde') + 3;

const renderer = { render: vi.fn(async (code: string) => `<svg>${code}</svg>`) };

function create(mode: 'auto' | 'visible' | 'hidden' = 'auto', text = doc) {
  return EditorState.create({ doc: text, extensions: [livePreview(mode), mermaidDiagrams(renderer)] });
}

function decos(state: EditorState) {
  const items: Array<{ from: number; to: number; view: string; code: string; isDark: boolean; replace: boolean }> = [];
  state.field(mermaidBlocksField).decorations.between(0, state.doc.length, (from, to, value) => {
    const spec = value.spec as any;
    if (!spec.widget) return;
    items.push({ from, to, view: spec.widget.view, code: spec.widget.code, isDark: spec.widget.isDark, replace: from !== to });
  });
  return items;
}

describe('mermaid blocks', () => {
  beforeEach(() => {
    clearMermaidCache();
    renderer.render.mockClear();
  });

  it('replaces only mermaid blocks with a diagram by default', () => {
    expect(decos(create())).toEqual([
      { from: blockFrom, to: blockTo, view: 'diagram', code: 'graph TD;\n    A-->B;', isDark: true, replace: true },
    ]);
  });

  it('shows code with a preview below after toggling, without changing the document', () => {
    let state = create();
    state = state.update({ effects: toggleMermaidView.of(blockFrom) }).state;
    expect(state.doc.toString()).toBe(doc);
    expect(decos(state)).toEqual([
      { from: blockTo, to: blockTo, view: 'code', code: 'graph TD;\n    A-->B;', isDark: true, replace: false },
    ]);

    state = state.update({ effects: toggleMermaidView.of(blockFrom) }).state;
    expect(viewOfBlock(state, blockFrom)).toBe('diagram');
  });

  it('frames the code lines in code view', () => {
    const state = create().update({ effects: toggleMermaidView.of(blockFrom) }).state;
    const classes: string[] = [];
    state.field(mermaidBlocksField).decorations.between(0, state.doc.length, (_f, _t, value) => {
      const cls = (value.spec as any).class;
      if (cls) classes.push(cls);
    });
    expect(classes).toEqual([
      'cm-mermaid-code-line cm-mermaid-code-first',
      'cm-mermaid-code-line',
      'cm-mermaid-code-line',
      'cm-mermaid-code-line',
    ]);
  });

  it('keeps the toggle when text above the block changes and updates the preview code', () => {
    let state = create().update({ effects: toggleMermaidView.of(blockFrom) }).state;
    state = state.update({ changes: { from: 0, insert: 'Neu\n' } }).state;
    expect(viewOfBlock(state, blockFrom + 4)).toBe('code');

    const arrow = state.doc.toString().indexOf('A-->B') + 4;
    state = state.update({ changes: { from: arrow, to: arrow + 1, insert: 'C' } }).state;
    expect(decos(state)[0]).toMatchObject({ view: 'code', code: 'graph TD;\n    A-->C;' });
  });

  it('switches to code when the cursor moves into a collapsed block by keyboard', () => {
    let state = create();
    state = state.update({ selection: { anchor: blockFrom }, userEvent: 'select' }).state;
    expect(viewOfBlock(state, blockFrom)).toBe('code');
  });

  it('does not switch on pointer selection', () => {
    let state = create();
    state = state.update({ selection: { anchor: blockFrom }, userEvent: 'select.pointer' }).state;
    expect(viewOfBlock(state, blockFrom)).toBe('diagram');
  });

  it('starts in code view with syntax always visible, and fresh state starts as diagram', () => {
    expect(viewOfBlock(create('visible'), blockFrom)).toBe('code');
    const toggled = create().update({ effects: toggleMermaidView.of(blockFrom) }).state;
    expect(viewOfBlock(toggled, blockFrom)).toBe('code');
    expect(viewOfBlock(create(), blockFrom)).toBe('diagram');
  });

  it('ignores mermaid examples nested in another fenced block', () => {
    expect(decos(create('auto', '````md\n```mermaid\ngraph TD; A-->B\n```\n````\n'))).toEqual([]);
  });

  it('passes the theme to the widgets', () => {
    const state = create().update({ effects: setMermaidTheme.of(false) }).state;
    expect(decos(state)[0].isDark).toBe(false);
  });
});

describe('mermaid rendering', () => {
  beforeEach(() => {
    clearMermaidCache();
    renderer.render.mockClear();
  });

  it('renders each diagram once per theme', async () => {
    expect(await renderDiagram('graph TD; A-->B', true, renderer)).toEqual({ svg: '<svg>graph TD; A-->B</svg>' });
    await renderDiagram('graph TD; A-->B', true, renderer);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    await renderDiagram('graph TD; A-->B', false, renderer);
    expect(renderer.render).toHaveBeenCalledTimes(2);
  });

  it('shows a syntax error in code view and returns to the diagram once fixed', async () => {
    const failing = { render: vi.fn(async () => { throw new Error('Parse error on line 1: graph TD; A-->'); }) };
    const result = await renderDiagram('graph TD; A-->', true, failing);
    expect(result).toEqual({ error: 'Parse error on line 1: graph TD; A-->' });

    const view = {
      state: create(),
      dispatch(spec: TransactionSpec) {
        view.state = view.state.update(spec).state;
      },
    };
    reportRenderResult(view, blockFrom, result);
    expect(viewOfBlock(view.state, blockFrom)).toBe('code');

    const dispatch = vi.spyOn(view, 'dispatch');
    reportRenderResult(view, blockFrom, result);
    expect(dispatch).not.toHaveBeenCalled();

    reportRenderResult(view, blockFrom, {});
    expect(viewOfBlock(view.state, blockFrom)).toBe('diagram');
  });
});
