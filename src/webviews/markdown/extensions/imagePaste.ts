import { EditorView } from '@codemirror/view';
import { EditorState, Extension, StateEffect, StateField, TransactionSpec } from '@codemirror/state';

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export interface SaveImageRequest {
  type: 'saveImage';
  requestId: number;
  mime: string;
  fileName?: string;
  size: number;
  /** Base64 content; left out when the webview already knows the image will be rejected. */
  data?: string;
}

export interface ImagePasteOptions {
  postMessage: (message: SaveImageRequest) => void;
  /** Reads a file as base64 (without data-URL prefix). Injectable for tests. */
  readAsBase64?: (file: File) => Promise<string>;
}

/** Minimal view surface used here, so the logic works with a real EditorView and in tests. */
export interface ImageInsertView {
  state: EditorState;
  dispatch: (spec: TransactionSpec) => void;
}

interface PendingImage {
  id: number;
  group: number;
  pos: number;
  /** Drops put every link on its own line; pastes insert at the cursor. */
  ownLine: boolean;
  relPath?: string;
  done: boolean;
}

const addPending = StateEffect.define<PendingImage[]>();
const settlePending = StateEffect.define<{ id: number; relPath?: string }>();
const removePending = StateEffect.define<number[]>();

/** Insert positions of images waiting for the host, mapped through every edit made meanwhile. */
export const pendingImagesField = StateField.define<PendingImage[]>({
  create: () => [],
  update(value, tr) {
    let next = tr.docChanged ? value.map((p) => ({ ...p, pos: tr.changes.mapPos(p.pos, 1) })) : value;
    for (const effect of tr.effects) {
      if (effect.is(addPending)) next = [...next, ...effect.value];
      if (effect.is(settlePending)) {
        next = next.map((p) => (p.id === effect.value.id ? { ...p, done: true, relPath: effect.value.relPath } : p));
      }
      if (effect.is(removePending)) next = next.filter((p) => !effect.value.includes(p.id));
    }
    return next;
  },
});

let nextRequestId = 1;
let nextGroup = 1;

function defaultReadAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function imageFiles(list: FileList | File[] | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => f.type.startsWith('image/'));
}

function sendImages(view: ImageInsertView, files: File[], pos: number, ownLine: boolean, options: ImagePasteOptions): void {
  const group = nextGroup++;
  const pending = files.map((): PendingImage => ({ id: nextRequestId++, group, pos, ownLine, done: false }));
  view.dispatch({ effects: addPending.of(pending) });

  const read = options.readAsBase64 ?? defaultReadAsBase64;
  files.forEach((file, i) => {
    const base: SaveImageRequest = {
      type: 'saveImage',
      requestId: pending[i].id,
      mime: file.type,
      fileName: ownLine ? file.name : undefined,
      size: file.size,
    };
    // The host validates too; skip reading files that cannot be accepted anyway
    if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES) {
      options.postMessage(base);
      return;
    }
    read(file).then(
      (data) => options.postMessage({ ...base, data }),
      () => options.postMessage(base)
    );
  });
}

/** Handles a paste with image content. Returns false for text so CodeMirror pastes as usual. */
export function handleImagePaste(view: ImageInsertView, data: DataTransfer | null, options: ImagePasteOptions): boolean {
  const files = imageFiles(data?.files);
  if (files.length === 0) return false;
  sendImages(view, files, view.state.selection.main.head, false, options);
  return true;
}

/** Handles dropped image files at `pos`. Returns false when no image file was dropped. */
export function handleImageDrop(view: ImageInsertView, data: DataTransfer | null, pos: number, options: ImagePasteOptions): boolean {
  const files = imageFiles(data?.files);
  if (files.length === 0) return false;
  sendImages(view, files, pos, true, options);
  return true;
}

/**
 * Inserts the links of settled images in drop order: an image is inserted once every earlier
 * image of its group is settled. Each insertion is its own transaction, so positions of the
 * remaining entries are mapped past the inserted text.
 */
function flush(view: ImageInsertView): void {
  for (;;) {
    const pending = view.state.field(pendingImagesField, false) ?? [];
    const ready = pending.find((p) => p.done && pending.find((q) => q.group === p.group) === p);
    if (!ready) return;
    if (!ready.relPath) {
      view.dispatch({ effects: removePending.of([ready.id]) });
      continue;
    }
    const line = view.state.doc.lineAt(ready.pos);
    const link = `![](${ready.relPath})`;
    const insert = ready.ownLine
      ? `${ready.pos > line.from ? '\n' : ''}${link}${ready.pos < line.to ? '\n' : ''}`
      : link;
    view.dispatch({ changes: { from: ready.pos, insert }, effects: removePending.of([ready.id]) });
  }
}

export function insertSavedImage(view: ImageInsertView, requestId: number, relPath: string): void {
  view.dispatch({ effects: settlePending.of({ id: requestId, relPath }) });
  flush(view);
}

export function rejectPendingImage(view: ImageInsertView, requestId: number): void {
  view.dispatch({ effects: settlePending.of({ id: requestId }) });
  flush(view);
}

/** Saves pasted and dropped images through the host and inserts their links. */
export function imagePaste(options: ImagePasteOptions): Extension {
  return [
    pendingImagesField,
    EditorView.domEventHandlers({
      paste(event, view) {
        if (!handleImagePaste(view, event.clipboardData, options)) return false;
        event.preventDefault();
        return true;
      },
      drop(event, view) {
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head;
        if (!handleImageDrop(view, event.dataTransfer, pos, options)) return false;
        event.preventDefault();
        return true;
      },
    }),
  ];
}
