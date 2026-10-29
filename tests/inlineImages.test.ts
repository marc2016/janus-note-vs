import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { livePreview } from '../src/webviews/markdown/extensions/livePreview';
import {
  buildImageDecorations,
  buildImageLinkDecorations,
  inlineImagesField,
  resolveImageSrc,
  setImageContext,
} from '../src/webviews/markdown/extensions/inlineImages';

const context = {
  imageBaseUri: 'https://file+.vscode-resource.vscode-cdn.net/workspace/meetings',
  workspaceRoots: [{ fsPath: '/workspace', webviewUri: 'https://file+.vscode-resource.vscode-cdn.net/workspace' }],
};

function widgets(doc: string) {
  const state = EditorState.create({ doc });
  const items: Array<{ pos: number; src?: string; path: string; block: boolean }> = [];
  buildImageDecorations(state, context).between(0, doc.length, (from, _to, value) => {
    const spec = value.spec as any;
    items.push({ pos: from, src: spec.widget.src, path: spec.widget.imagePath, block: spec.block });
  });
  return items;
}

describe('resolveImageSrc', () => {
  it('resolves paths relative to the note folder', () => {
    expect(resolveImageSrc('assets/Whiteboard-Foto.jpg', context)).toBe(
      'https://file+.vscode-resource.vscode-cdn.net/workspace/meetings/assets/Whiteboard-Foto.jpg'
    );
    expect(resolveImageSrc('./assets/a.png', context)).toBe(
      'https://file+.vscode-resource.vscode-cdn.net/workspace/meetings/assets/a.png'
    );
    expect(resolveImageSrc('../projects/b c.png', context)).toBe(
      'https://file+.vscode-resource.vscode-cdn.net/workspace/projects/b%20c.png'
    );
  });

  it('maps absolute paths inside the workspace and refuses others', () => {
    expect(resolveImageSrc('/workspace/knowledge/x.png', context)).toBe(
      'https://file+.vscode-resource.vscode-cdn.net/workspace/knowledge/x.png'
    );
    expect(resolveImageSrc('/etc/x.png', context)).toBeUndefined();
  });

  it('uses https and data URLs directly and refuses other schemes', () => {
    expect(resolveImageSrc('https://example.com/a.png', context)).toBe('https://example.com/a.png');
    expect(resolveImageSrc('data:image/png;base64,AAAA', context)).toBe('data:image/png;base64,AAAA');
    expect(resolveImageSrc('http://example.com/a.png', context)).toBeUndefined();
    expect(resolveImageSrc('file:///workspace/a.png', context)).toBeUndefined();
  });
});

describe('inline image widgets', () => {
  it('shows a local image below its line and keeps the text', () => {
    const doc = 'Whiteboard:\n![Whiteboard](assets/Whiteboard-Foto.jpg)\nDanach';
    const items = widgets(doc);
    expect(items).toEqual([
      {
        pos: doc.indexOf('\nDanach'),
        src: 'https://file+.vscode-resource.vscode-cdn.net/workspace/meetings/assets/Whiteboard-Foto.jpg',
        path: 'assets/Whiteboard-Foto.jpg',
        block: true,
      },
    ]);
  });

  it('shows remote images and keeps the path of a missing image for the hint', () => {
    const items = widgets('![](assets/fehlt.png) ![Logo](https://example.com/logo.svg)');
    expect(items.map((i) => i.path)).toEqual(['assets/fehlt.png', 'https://example.com/logo.svg']);
  });

  it('shows no image for links in code blocks or inline code', () => {
    expect(widgets('```\n![](assets/bild.png)\n```\n`![](assets/inline.png)`')).toEqual([]);
  });

  it('updates the image when the link is edited', () => {
    let state = EditorState.create({ doc: '![](assets/a.png)', extensions: [inlineImagesField] });
    state = state.update({ effects: setImageContext.of(context) }).state;
    const srcOf = (s: EditorState) => {
      let src: string | undefined;
      s.field(inlineImagesField).decorations.between(0, s.doc.length, (_f, _t, v) => {
        src = (v.spec as any).widget.src;
      });
      return src;
    };
    expect(srcOf(state)).toMatch(/assets\/a\.png$/);
    state = state.update({ changes: { from: 11, to: 12, insert: 'b' } }).state;
    expect(state.doc.toString()).toBe('![](assets/b.png)');
    expect(srcOf(state)).toMatch(/assets\/b\.png$/);
  });
});

describe('image link line', () => {
  const doc = 'Text\n![](assets/project-plan-20261029-180102.png)\n![Whiteboard](assets/wb.jpg)';
  const linkDecos = (cursor: number, mode: 'auto' | 'visible' | 'hidden' = 'auto') => {
    const state = EditorState.create({ doc, selection: { anchor: cursor }, extensions: [livePreview(mode)] });
    const items: Array<{ from: number; to: number; label?: string; className?: string }> = [];
    buildImageLinkDecorations(state).between(0, doc.length, (from, to, value) => {
      const spec = value.spec as any;
      items.push({ from, to, label: spec.widget?.label, className: spec.class });
    });
    return items;
  };
  const first = { from: doc.indexOf('!['), to: doc.indexOf('.png)') + 5 };
  const second = { from: doc.lastIndexOf('!['), to: doc.length };

  it('shows a caption with the file name or alt text away from the cursor', () => {
    expect(linkDecos(0)).toEqual([
      { ...first, label: 'project-plan-20261029-180102.png', className: undefined },
      { ...second, label: 'Whiteboard', className: undefined },
    ]);
  });

  it('shows the muted raw text on the cursor line', () => {
    const items = linkDecos(first.from + 3);
    expect(items[0]).toEqual({ ...first, label: undefined, className: 'cm-image-source' });
    expect(items[1].label).toBe('Whiteboard');
  });

  it('shows raw text everywhere with syntax always visible', () => {
    expect(linkDecos(0, 'visible').every((i) => i.className === 'cm-image-source')).toBe(true);
  });
});
