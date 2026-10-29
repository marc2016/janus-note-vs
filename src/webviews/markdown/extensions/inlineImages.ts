import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { EditorState, Extension, Range, StateEffect, StateField } from '@codemirror/state';
import { mdiImageOutline } from '@mdi/js';
import { findCodeRanges, findLinkOccurrences } from '../../../services/markdownScan';
import { syntaxVisibilityFacet } from './livePreview';

/** Base URIs from the host to turn image paths of this note into webview URLs. */
export interface ImageContext {
  imageBaseUri: string;
  workspaceRoots: Array<{ fsPath: string; webviewUri: string }>;
}

export const setImageContext = StateEffect.define<ImageContext>();

const EXTERNAL_IMAGE_RE = /!\[([^\]]*)\]\(\s*((?:https:|data:)[^)\s]+)[^)]*\)/g;

interface ImageLink {
  start: number;
  end: number;
  path: string;
  alt: string;
}

/** All Markdown image links outside code: local ones from the link scanner, plus `https:`/`data:` images. */
export function findImageLinks(text: string): ImageLink[] {
  const images: ImageLink[] = findLinkOccurrences(text, { includeImages: true })
    .filter((o) => o.type === 'image')
    .map((o) => ({ start: o.start, end: o.end, path: o.path, alt: o.label ?? '' }));

  const codeRanges = findCodeRanges(text);
  let match: RegExpExecArray | null;
  EXTERNAL_IMAGE_RE.lastIndex = 0;
  while ((match = EXTERNAL_IMAGE_RE.exec(text)) !== null) {
    const start = match.index;
    if (!codeRanges.some(([s, e]) => start >= s && start < e)) {
      images.push({ start, end: start + match[0].length, path: match[2], alt: match[1].trim() });
    }
  }
  return images.sort((a, b) => a.start - b.start);
}

/** Resolves an image path to a URL the webview may load, or undefined if it cannot be shown. */
export function resolveImageSrc(imagePath: string, context: ImageContext | undefined): string | undefined {
  const target = imagePath.trim();
  if (/^(https:|data:image\/)/i.test(target)) {
    return target;
  }
  if (!context) {
    return undefined;
  }

  const normalized = target.replace(/\\/g, '/');
  const isAbsolute = normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized);
  // Other schemes (`http:`, `file:`, …) are not shown
  if (!isAbsolute && /^[a-z][a-z0-9+.-]*:/i.test(normalized)) {
    return undefined;
  }
  if (isAbsolute) {
    const root = context.workspaceRoots.find((r) => {
      const rootPath = r.fsPath.replace(/\\/g, '/').replace(/\/$/, '');
      return normalized === rootPath || normalized.startsWith(`${rootPath}/`);
    });
    if (!root) return undefined;
    const rest = normalized.slice(root.fsPath.replace(/\\/g, '/').replace(/\/$/, '').length + 1);
    return new URL(encodeURI(rest), `${root.webviewUri.replace(/\/$/, '')}/`).toString();
  }

  try {
    return new URL(encodeURI(normalized.replace(/^\.\//, '')), `${context.imageBaseUri.replace(/\/$/, '')}/`).toString();
  } catch {
    return undefined;
  }
}

class ImageWidget extends WidgetType {
  constructor(
    readonly src: string | undefined,
    readonly imagePath: string
  ) {
    super();
  }

  eq(other: ImageWidget): boolean {
    return other.src === this.src && other.imagePath === this.imagePath;
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cm-inline-image';
    const showHint = () => {
      wrap.replaceChildren();
      wrap.className = 'cm-inline-image cm-inline-image-missing';
      wrap.textContent = `Bild nicht gefunden: ${this.imagePath}`;
    };
    if (!this.src) {
      showHint();
      return wrap;
    }
    const img = document.createElement('img');
    img.src = this.src;
    img.alt = this.imagePath;
    img.addEventListener('error', showHint);
    wrap.appendChild(img);
    return wrap;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/** One block widget below each line that contains an image link, outside code. */
export function buildImageDecorations(state: EditorState, context: ImageContext | undefined): DecorationSet {
  const decorations: Range<Decoration>[] = findImageLinks(state.doc.toString()).map((image) =>
    Decoration.widget({
      widget: new ImageWidget(resolveImageSrc(image.path, context), image.path),
      block: true,
      side: 1,
    }).range(state.doc.lineAt(image.start).to)
  );
  return Decoration.set(decorations, true);
}

class ImageCaptionWidget extends WidgetType {
  constructor(readonly label: string) {
    super();
  }

  eq(other: ImageCaptionWidget): boolean {
    return other.label === this.label;
  }

  toDOM(): HTMLElement {
    const caption = document.createElement('span');
    caption.className = 'cm-image-caption';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'cm-image-caption-icon');
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', mdiImageOutline);
    pathEl.setAttribute('fill', 'currentColor');
    svg.appendChild(pathEl);
    caption.appendChild(svg);
    caption.appendChild(document.createTextNode(this.label));
    return caption;
  }

  // Let clicks through so CodeMirror puts the cursor on the line and reveals the raw text
  ignoreEvent(): boolean {
    return false;
  }
}

/** Caption away from the cursor, muted raw text on the cursor's line or with syntax always visible. */
export function buildImageLinkDecorations(state: EditorState): DecorationSet {
  const mode = state.facet(syntaxVisibilityFacet);
  const { head, anchor } = state.selection.main;
  const decorations: Range<Decoration>[] = [];
  for (const image of findImageLinks(state.doc.toString())) {
    const line = state.doc.lineAt(image.start);
    const cursorOnLine = (head >= line.from && head <= line.to) || (anchor >= line.from && anchor <= line.to);
    if (mode === 'visible' || cursorOnLine) {
      decorations.push(Decoration.mark({ class: 'cm-image-source' }).range(image.start, image.end));
    } else {
      const label = image.alt || image.path.split('/').pop() || image.path;
      decorations.push(Decoration.replace({ widget: new ImageCaptionWidget(label) }).range(image.start, image.end));
    }
  }
  return Decoration.set(decorations, true);
}

const imageLinkPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildImageLinkDecorations(view.state);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.startState.facet(syntaxVisibilityFacet) !== update.state.facet(syntaxVisibilityFacet)
      ) {
        this.decorations = buildImageLinkDecorations(update.state);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

interface InlineImagesState {
  context?: ImageContext;
  decorations: DecorationSet;
}

export const inlineImagesField = StateField.define<InlineImagesState>({
  create: (state) => ({ decorations: buildImageDecorations(state, undefined) }),
  update(value, tr) {
    let context = value.context;
    for (const effect of tr.effects) {
      if (effect.is(setImageContext)) context = effect.value;
    }
    if (!tr.docChanged && context === value.context) {
      return value;
    }
    return { context, decorations: buildImageDecorations(tr.state, context) };
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

/** Shows the images of Markdown image links below their lines; the link text stays editable. */
export function inlineImages(): Extension {
  return [inlineImagesField, imageLinkPlugin];
}
