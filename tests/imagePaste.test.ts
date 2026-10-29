import { describe, it, expect, vi } from 'vitest';
import { EditorState, TransactionSpec } from '@codemirror/state';
import {
  handleImageDrop,
  handleImagePaste,
  insertSavedImage,
  pendingImagesField,
  rejectPendingImage,
  SaveImageRequest,
} from '../src/webviews/markdown/extensions/imagePaste';

function createView(doc: string, cursor: number) {
  const view = {
    state: EditorState.create({ doc, selection: { anchor: cursor }, extensions: [pendingImagesField] }),
    dispatch(spec: TransactionSpec) {
      view.state = view.state.update(spec).state;
    },
  };
  return view;
}

const file = (name: string, type: string, size = 10) => ({ name, type, size }) as File;
const transfer = (...files: File[]) => ({ files }) as unknown as DataTransfer;
const flushPromises = () => new Promise((r) => setTimeout(r, 0));

describe('imagePaste', () => {
  it('posts saveImage for a pasted image and inserts the link at the cursor', async () => {
    const view = createView('Vorher  Nachher', 7);
    const messages: SaveImageRequest[] = [];
    const handled = handleImagePaste(view, transfer(file('image.png', 'image/png')), {
      postMessage: (m) => messages.push(m),
      readAsBase64: async () => 'AQI=',
    });
    await flushPromises();

    expect(handled).toBe(true);
    expect(messages).toEqual([
      { type: 'saveImage', requestId: messages[0].requestId, mime: 'image/png', fileName: undefined, size: 10, data: 'AQI=' },
    ]);

    insertSavedImage(view, messages[0].requestId, 'assets/note-20261029-071205.png');
    expect(view.state.doc.toString()).toBe('Vorher ![](assets/note-20261029-071205.png) Nachher');
  });

  it('leaves a text paste to CodeMirror', () => {
    const view = createView('Text', 0);
    const post = vi.fn();
    expect(handleImagePaste(view, transfer(), { postMessage: post })).toBe(false);
    expect(handleImagePaste(view, transfer(file('a.txt', 'text/plain')), { postMessage: post })).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  it('inserts at the mapped position after typing in between', async () => {
    const view = createView('Hallo Welt', 10);
    const messages: SaveImageRequest[] = [];
    handleImagePaste(view, transfer(file('image.png', 'image/png')), {
      postMessage: (m) => messages.push(m),
      readAsBase64: async () => 'AA==',
    });
    await flushPromises();

    view.dispatch({ changes: { from: 0, insert: 'Neu: ' } });
    insertSavedImage(view, messages[0].requestId, 'assets/x.png');
    expect(view.state.doc.toString()).toBe('Neu: Hallo Welt![](assets/x.png)');
  });

  it('puts dropped images on their own lines in drop order, even if replies arrive out of order', async () => {
    const view = createView('Zeile eins\nZeile zwei', 5);
    const messages: SaveImageRequest[] = [];
    handleImageDrop(view, transfer(file('Whiteboard Foto.jpg', 'image/jpeg'), file('skizze.svg', 'image/svg+xml')), 5, {
      postMessage: (m) => messages.push(m),
      readAsBase64: async () => 'AA==',
    });
    await flushPromises();
    expect(messages.map((m) => m.fileName)).toEqual(['Whiteboard Foto.jpg', 'skizze.svg']);

    insertSavedImage(view, messages[1].requestId, 'assets/skizze.svg');
    expect(view.state.doc.toString()).toBe('Zeile eins\nZeile zwei');
    insertSavedImage(view, messages[0].requestId, 'assets/Whiteboard-Foto.jpg');
    expect(view.state.doc.toString()).toBe(
      'Zeile\n![](assets/Whiteboard-Foto.jpg)\n![](assets/skizze.svg)\n eins\nZeile zwei'
    );
  });

  it('sends unacceptable images without data and inserts nothing on rejection', async () => {
    const view = createView('Text', 4);
    const read = vi.fn();
    const messages: SaveImageRequest[] = [];
    handleImageDrop(view, transfer(file('foto.heic', 'image/heic'), file('gross.png', 'image/png', 25 * 1024 * 1024)), 4, {
      postMessage: (m) => messages.push(m),
      readAsBase64: read,
    });
    await flushPromises();

    expect(read).not.toHaveBeenCalled();
    expect(messages.every((m) => m.data === undefined)).toBe(true);
    messages.forEach((m) => rejectPendingImage(view, m.requestId));
    expect(view.state.doc.toString()).toBe('Text');
    expect(view.state.field(pendingImagesField)).toEqual([]);
  });
});
