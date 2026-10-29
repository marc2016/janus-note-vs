import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { DecorationSet } from '@codemirror/view';
import { livePreview } from '../src/webviews/markdown/extensions/livePreview';
import {
  buildSortedLinkDecorations,
  setSortedLinks,
  sortedLinksField,
} from '../src/webviews/markdown/extensions/sortedLinks';
import { MarkdownEditorProvider } from '../src/editors/markdownEditorProvider';
import { CompanionManager } from '../src/companion/companionManager';
import { AiModelService } from '../src/services/aiModelService';

const doc = '# Donnerstag\n\n## Call mit Anna\nSentry\n\n-> [[projects/App-Launch/app-launch]]\n';

function createView(cursor: number, mode: 'auto' | 'visible' | 'hidden' = 'auto', links?: any[]) {
  let state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [markdown(), livePreview(mode), sortedLinksField],
  });
  if (links) {
    state = state.update({ effects: setSortedLinks.of(links) }).state;
  }
  return { state, visibleRanges: [{ from: 0, to: state.doc.length }] } as any;
}

function collect(set: DecorationSet) {
  const items: Array<{ from: number; to: number; widget?: string; info?: any; className?: string }> = [];
  set.between(0, doc.length, (from, to, value) => {
    const widget = (value.spec as any).widget;
    items.push({
      from,
      to,
      widget: widget?.constructor.name,
      info: widget?.info,
      className: (value.spec as any).class,
    });
  });
  return items;
}

const linkLineFrom = doc.indexOf('->');
const linkLineTo = doc.indexOf(']]') + 2;
const headingEnd = doc.indexOf('\nSentry');

describe('sorted link cards', () => {
  const resolved = {
    target: 'projects/App-Launch/app-launch',
    title: 'Projekt: Mobile App-Launch (v2.0)',
    folder: 'projects / App-Launch',
    exists: true,
    line: 30,
  };

  it('replaces the link line with a card and marks the heading', () => {
    const items = collect(buildSortedLinkDecorations(createView(0, 'auto', [resolved]), vi.fn()));

    expect(items).toContainEqual(
      expect.objectContaining({ from: linkLineFrom, to: linkLineTo, widget: 'SortedLinkCardWidget', info: resolved })
    );
    expect(items).toContainEqual(
      expect.objectContaining({ from: headingEnd, to: headingEnd, widget: 'SortedLinkBadgeWidget', info: resolved })
    );
  });

  it('shows the last path segment before the host has answered', () => {
    const card = collect(buildSortedLinkDecorations(createView(0), vi.fn())).find(
      (i) => i.widget === 'SortedLinkCardWidget'
    );
    expect(card?.info).toEqual({
      target: 'projects/App-Launch/app-launch',
      title: 'app-launch',
      folder: 'projects / App-Launch',
      exists: true,
    });
  });

  it('marks a missing target', () => {
    const missing = { target: 'projects/App-Launch/app-launch', title: 'app-launch', folder: 'projects / App-Launch', exists: false };
    const card = collect(buildSortedLinkDecorations(createView(0, 'auto', [missing]), vi.fn())).find(
      (i) => i.widget === 'SortedLinkCardWidget'
    );
    expect(card?.info.exists).toBe(false);
  });

  it('shows the raw line while the cursor is on it or syntax is always visible', () => {
    const onLine = collect(buildSortedLinkDecorations(createView(linkLineFrom + 3), vi.fn()));
    expect(onLine.some((i) => i.widget === 'SortedLinkCardWidget')).toBe(false);
    expect(onLine.some((i) => i.widget === 'SortedLinkBadgeWidget')).toBe(true);

    const visible = collect(buildSortedLinkDecorations(createView(0, 'visible'), vi.fn()));
    expect(visible.some((i) => i.widget === 'SortedLinkCardWidget')).toBe(false);
  });

  it('opens the target at the copied section', () => {
    const onOpen = vi.fn();
    let card: any;
    buildSortedLinkDecorations(createView(0, 'auto', [resolved]), onOpen).between(0, doc.length, (_f, _t, value) => {
      const widget = (value.spec as any).widget;
      if (widget?.constructor.name === 'SortedLinkCardWidget') card = widget;
    });
    card.onOpen(card.info.target, card.info.line);
    expect(onOpen).toHaveBeenCalledWith('projects/App-Launch/app-launch', 30);
  });
});

describe('MarkdownEditorProvider.sendSortedLinks', () => {
  const mockContext = { extensionUri: vscode.Uri.file('/ext'), secrets: { get: vi.fn(), store: vi.fn(), delete: vi.fn() } } as any;

  it('sends link data for daily notes only', async () => {
    (vscode.workspace as any).workspaceFolders = [{ uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 }];
    vi.spyOn(vscode.workspace.fs, 'readFile').mockRejectedValue(new Error('Not found'));
    const provider = new MarkdownEditorProvider(mockContext, new CompanionManager(), new AiModelService(mockContext));
    const panel = { webview: { postMessage: vi.fn() } } as any;
    const text = '## A\nx\n\n-> [[knowledge/x]]\n';

    await provider.sendSortedLinks({ uri: vscode.Uri.file('/workspace/projects/a.md'), getText: () => text } as any, panel);
    expect(panel.webview.postMessage).not.toHaveBeenCalled();

    await provider.sendSortedLinks({ uri: vscode.Uri.file('/workspace/journal/2026-10-29.md'), getText: () => text } as any, panel);
    expect(panel.webview.postMessage).toHaveBeenCalledWith({
      type: 'sortedLinks',
      links: [{ target: 'knowledge/x', title: 'x', folder: 'knowledge', exists: false }],
    });
  });
});
