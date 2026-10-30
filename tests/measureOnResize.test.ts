import { describe, it, expect, vi, afterEach } from 'vitest';
import { measureOnResize, stopMeasuring } from '../src/webviews/markdown/lib/measureOnResize';

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed: unknown[] = [];
  disconnected = false;
  constructor(readonly callback: () => void) {
    FakeResizeObserver.instances.push(this);
  }
  observe(el: unknown) {
    this.observed.push(el);
  }
  disconnect() {
    this.disconnected = true;
  }
}

describe('measureOnResize', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeResizeObserver.instances = [];
  });

  it('requests one measure per frame when the widget changes size', async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const view = { requestMeasure: vi.fn() };
    const dom = {} as HTMLElement;
    measureOnResize(dom, view);
    const observer = FakeResizeObserver.instances[0];
    expect(observer.observed).toEqual([dom]);

    observer.callback();
    observer.callback();
    await new Promise((r) => setTimeout(r, 5));
    expect(view.requestMeasure).toHaveBeenCalledTimes(1);

    observer.callback();
    await new Promise((r) => setTimeout(r, 5));
    expect(view.requestMeasure).toHaveBeenCalledTimes(2);
  });

  it('disconnects when the widget is destroyed', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const dom = {} as HTMLElement;
    measureOnResize(dom, { requestMeasure: vi.fn() });
    stopMeasuring(dom);
    expect(FakeResizeObserver.instances[0].disconnected).toBe(true);
  });

  it('does nothing without ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    expect(() => measureOnResize({} as HTMLElement, { requestMeasure: vi.fn() })).not.toThrow();
  });
});

import { EditorState } from '@codemirror/state';
import { buildImageDecorations } from '../src/webviews/markdown/extensions/inlineImages';
import { livePreview } from '../src/webviews/markdown/extensions/livePreview';
import { mermaidBlocksField, mermaidDiagrams, toggleMermaidView } from '../src/webviews/markdown/extensions/mermaidBlocks';

describe('widget height estimates', () => {
  const widgetsOf = (set: any, length: number) => {
    const widgets: any[] = [];
    set.between(0, length, (_f: number, _t: number, v: any) => {
      if (v.spec.widget) widgets.push(v.spec.widget);
    });
    return widgets;
  };

  it('estimates images and missing images', () => {
    const doc = '![](assets/a.png)\n![](/etc/b.png)';
    const context = { imageBaseUri: 'https://x/notes', workspaceRoots: [] };
    const [image, missing] = widgetsOf(buildImageDecorations(EditorState.create({ doc }), context), doc.length);
    expect(image.estimatedHeight).toBe(200);
    expect(missing.estimatedHeight).toBe(24);
  });

  it('estimates diagram and preview', () => {
    const doc = '```mermaid\ngraph TD; A-->B\n```\n';
    const renderer = { render: vi.fn(async () => '<svg/>'), validate: vi.fn(async () => {}) };
    let state = EditorState.create({ doc, extensions: [livePreview('auto'), mermaidDiagrams(renderer)] });
    expect(widgetsOf(state.field(mermaidBlocksField).decorations, doc.length)[0].estimatedHeight).toBe(220);
    state = state.update({ effects: toggleMermaidView.of(0) }).state;
    expect(widgetsOf(state.field(mermaidBlocksField).decorations, doc.length)[0].estimatedHeight).toBe(180);
  });
});
