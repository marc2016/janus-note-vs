import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownToolbar } from '../src/webviews/markdown/components/MarkdownToolbar';
import { handleSaveKey, isSaveKey } from '../src/webviews/markdown/lib/saveShortcut';

const key = (k: string, mods: Partial<Record<'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey', boolean>> = {}) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
});

describe('save shortcut', () => {
  it('maps Cmd+S on Mac and Ctrl+S elsewhere', () => {
    expect(isSaveKey(key('s', { metaKey: true }), true)).toBe(true);
    expect(isSaveKey(key('s', { ctrlKey: true }), true)).toBe(false);
    expect(isSaveKey(key('s', { ctrlKey: true }), false)).toBe(true);
    expect(isSaveKey(key('S', { metaKey: true, shiftKey: true }), true)).toBe(false);
    expect(isSaveKey(key('s', { metaKey: true, altKey: true }), true)).toBe(false);
  });

  it('saves through the editor and keeps the key from VS Code', () => {
    const onSave = vi.fn();
    const event = key('s', { metaKey: true });
    expect(handleSaveKey(event as any, onSave, true)).toBe(true);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();

    const other = key('b', { metaKey: true });
    expect(handleSaveKey(other as any, onSave, true)).toBe(false);
    expect(other.stopPropagation).not.toHaveBeenCalled();
  });
});

describe('save button', () => {
  const render = (isDirty: boolean) =>
    renderToStaticMarkup(<MarkdownToolbar editorView={null} isDirty={isDirty} onSave={() => {}} />);

  it('is enabled and highlighted with unsaved changes', () => {
    const markup = render(true);
    const button = markup.match(/<button[^>]*aria-label="Speichern"[^>]*>/)![0];
    expect(button).toContain('data-dirty="true"');
    expect(button).not.toContain('disabled=""');
  });

  it('is disabled when everything is saved', () => {
    const button = render(false).match(/<button[^>]*aria-label="Speichern"[^>]*>/)![0];
    expect(button).toContain('data-dirty="false"');
    expect(button).toContain('disabled=""');
  });

  it('comes first in the toolbar', () => {
    const markup = render(true);
    expect(markup.indexOf('aria-label="Speichern"')).toBeLessThan(markup.indexOf('title="Undo'));
  });
});
